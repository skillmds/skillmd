// Lock-driven: every tracked skill is re-fetched from the exact source the
// lock recorded (never by name search), re-linted, and swapped in as a full
// bundle. Untracked skills are reported and left alone.
import { Command } from "commander";
import pc from "picocolors";
import { lint } from "@skillmds/core";
import { createClient, fetchBundle, skillMdFor } from "../api.js";
import type { RegistrySkill } from "../api.js";
import { resolveSource, resolveTree } from "../source.js";
import { parseSource } from "../sources.js";
import { digestOf, installSkill, listInstalled } from "../installer.js";
import type { SkillFileInput } from "../installer.js";
import { readLock } from "../lock.js";
import { resolvePackFiles } from "./add.js";

export interface UpdateFlags { global?: boolean; project?: boolean; check?: boolean; yes?: boolean; json?: boolean; token?: string; api?: string; insecureHttp?: boolean; cwd?: string; home?: string }
export interface Latest { files: SkillFileInput[]; commit_sha?: string }
export interface UpdateDeps { fetchLatest: (source: string, flags: UpdateFlags) => Promise<Latest | null>; }
export interface UpdateResult { updated: string[]; available: string[]; failed: string[]; exitCode: 0 | 1; output: string }

export const defaultUpdateDeps: UpdateDeps = {
  async fetchLatest(source, flags) {
    if (source.startsWith("registry:")) {
      const slug = source.slice("registry:".length);
      const { api, base, token } = createClient(flags);
      let skill: RegistrySkill;
      try { skill = await api<RegistrySkill>(`/api/skills/${slug}`); }
      catch (e) { if ((e as { status?: number }).status === 404) return null; throw e; }
      if (skill.type === "pack") {
        const bundle = await fetchBundle(base, slug, token);
        if (bundle?.length) return { files: bundle, commit_sha: skill.commit_sha ?? undefined };
        const pack = await resolvePackFiles(skill);
        if (pack) return { files: pack.files, commit_sha: skill.commit_sha ?? undefined };
      }
      return { files: [{ path: "SKILL.md", contents: skillMdFor(skill) }], commit_sha: skill.commit_sha ?? undefined };
    }
    if (source.startsWith("github:")) {
      const spec = parseSource(source);
      if (spec.kind !== "github") return null;
      const files = await resolveTree(source.replace(/@[^@]+$/, ""));
      if (spec.skill) {
        const prefix = files.find((f) => f.path.endsWith("/SKILL.md") && f.path.split("/").at(-2) === spec.skill)?.path.replace(/SKILL\.md$/, "");
        if (!prefix) return null;
        return { files: files.filter((f) => f.path.startsWith(prefix)).map((f) => ({ path: f.path.slice(prefix.length), contents: f.contents })) };
      }
      return { files };
    }
    if (source.startsWith("gist:")) {
      const [user, id] = source.slice("gist:".length).split("/");
      const rs = await resolveSource(`https://gist.github.com/${user}/${id}`);
      return rs[0] ? { files: [{ path: "SKILL.md", contents: rs[0].raw }] } : null;
    }
    return null; // local: sources are never auto-updated
  },
};

export async function runUpdate(names: string[], flags: UpdateFlags, deps: UpdateDeps = defaultUpdateDeps): Promise<UpdateResult> {
  const scopes = flags.global && !flags.project ? [true] : flags.project && !flags.global ? [false] : [false, true];
  const updated: string[] = []; const available: string[] = []; const failed: string[] = []; const lines: string[] = [];
  for (const global of scopes) {
    const scope = { global, cwd: flags.cwd, home: flags.home };
    const lock = readLock(scope);
    const installed = listInstalled(scope).filter((s) => names.length === 0 || names.includes(s.name));
    for (const s of installed) {
      const label = `${s.name}${scopes.length > 1 ? pc.dim(` [${s.scope}]`) : ""}`;
      const entry = lock.skills[s.name];
      if (!entry) { lines.push(pc.dim(`- ${label} untracked — reinstall with \`skillmd add\` to track updates`)); continue; }
      if (entry.source.startsWith("local:")) { lines.push(pc.dim(`- ${label} local source — not auto-updated`)); continue; }
      try {
        const latest = await deps.fetchLatest(entry.source, flags);
        if (!latest) { failed.push(s.name); lines.push(pc.red(`✗ ${label} no longer available upstream (${entry.source})`)); continue; }
        if (digestOf(latest.files) === entry.digest) { lines.push(pc.dim(`- ${label} up to date`)); continue; }
        if (flags.check) { available.push(s.name); lines.push(pc.yellow(`↑ ${label} update available`)); continue; }
        const md = latest.files.find((f) => f.path === "SKILL.md");
        const raw = md ? (typeof md.contents === "string" ? md.contents : md.contents.toString("utf8")) : "";
        const result = lint(raw, { slug: s.name });
        if (!result.ok) { failed.push(s.name); lines.push(pc.red(`✗ ${label} update failed lint (${result.diagnostics.filter((d) => d.severity === "error").map((d) => d.id).join(", ")}) — kept the installed version`)); continue; }
        await installSkill({ name: s.name, files: latest.files, source: entry.source, commit_sha: latest.commit_sha, scope, agents: entry.agents, explicitAgents: true, mode: Object.values(entry.mode).includes("copy") ? "copy" : "link" });
        updated.push(s.name);
        lines.push(pc.green(`✓ ${label} updated`));
      } catch (e) {
        failed.push(s.name);
        lines.push(pc.red(`✗ ${label} ${e instanceof Error ? e.message : String(e)}`));
      }
    }
  }
  const exitCode: 0 | 1 = failed.length ? 1 : 0;
  if (flags.json) return { updated, available, failed, exitCode, output: JSON.stringify({ ok: exitCode === 0, updated, available, failed }, null, 2) };
  if (lines.length === 0) lines.push(pc.dim("No installed skills found."));
  return { updated, available, failed, exitCode, output: lines.join("\n") };
}

function scopeOptions(cmd: Command): Command {
  return cmd.option("-g, --global", "only user-level skills").option("-p, --project", "only this project's skills").option("-y, --yes", "no prompts").option("--json", "machine-readable output");
}
export function updateCommand(): Command {
  return scopeOptions(new Command("update").description("Update installed skills from the source recorded in the lock file (re-lints before writing)").argument("[names...]", "specific skills (default: all tracked)").option("--check", "only report which skills have updates"))
    .action(async (names: string[], opts: UpdateFlags, cmd: Command) => { const run = await runUpdate(names, { ...cmd.parent?.opts(), ...opts }); console.log(run.output); process.exitCode = run.exitCode; });
}
export function checkCommand(): Command {
  return scopeOptions(new Command("check").description("Report installed skills that have updates (alias of `update --check`)").argument("[names...]", "specific skills (default: all tracked)"))
    .action(async (names: string[], opts: UpdateFlags, cmd: Command) => { const run = await runUpdate(names, { ...cmd.parent?.opts(), ...opts, check: true }); console.log(run.output); process.exitCode = run.exitCode; });
}
