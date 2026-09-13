// Lock-driven: every tracked skill is re-fetched from the exact source the
// lock recorded (never by name search), re-linted, and swapped in as a full
// bundle. Untracked skills are reported and left alone.
import { Command } from "commander";
import pc from "picocolors";
import { lint } from "@skillmds/core";
import { createClient, fetchBundle, skillMdFor } from "../api.js";
import type { RegistrySkill } from "../api.js";
import { resolvePackFiles, resolveSource, resolveTree } from "../source.js";
import { gigetInput, parseSource } from "../sources.js";
import { digestOf, installSkill, listInstalled } from "../installer.js";
import type { SkillFileInput } from "../installer.js";
import { readLock } from "../lock.js";
import { scopesFor } from "../env.js";
import { GLYPH } from "../ui.js";

export interface UpdateFlags { global?: boolean; project?: boolean; check?: boolean; yes?: boolean; json?: boolean; token?: string; api?: string; insecureHttp?: boolean; cwd?: string; home?: string }
export interface Latest { files: SkillFileInput[]; commit_sha?: string }
export interface UpdateDeps { fetchLatest: (source: string, flags: UpdateFlags, name: string) => Promise<Latest | null>; }
export interface UpdateResult { updated: string[]; available: string[]; failed: string[]; exitCode: 0 | 1; output: string }

/** Pick one skill's own directory out of a fetched repo tree. A repo of skills
 *  gives `skills/<want>/SKILL.md`; a single-skill repo has SKILL.md at the root.
 *  Returns the files under that dir with the prefix stripped, or null. */
export function pickSkillTree(files: SkillFileInput[], want: string): SkillFileInput[] | null {
  const norm = files.map((f) => ({ path: f.path.replace(/\\/g, "/"), contents: f.contents }));
  const match = norm.find((f) => f.path.endsWith("/SKILL.md") && f.path.split("/").at(-2) === want);
  if (match) {
    const prefix = match.path.slice(0, -"SKILL.md".length);
    return norm.filter((f) => f.path.startsWith(prefix)).map((f) => ({ path: f.path.slice(prefix.length), contents: f.contents }));
  }
  // A tree that is itself one skill: the dir name upstream need not match ours.
  if (norm.some((f) => f.path === "SKILL.md")) return norm;
  return null;
}

export interface DefaultUpdateDepsOptions {
  resolveTree?: (input: string) => Promise<SkillFileInput[]>;
  resolveSource?: (url: string) => Promise<{ raw: string }[]>;
  client?: typeof createClient;
}

/** The production deps, with every network call injectable so the dispatch
 *  itself can be tested without touching the network. */
export function makeDefaultUpdateDeps(opts: DefaultUpdateDepsOptions = {}): UpdateDeps {
  const tree = opts.resolveTree ?? ((input: string) => resolveTree(input));
  const one = opts.resolveSource ?? ((url: string) => resolveSource(url));
  const client = opts.client ?? createClient;
  return {
    async fetchLatest(source, flags, name) {
      if (source.startsWith("registry:")) {
        const slug = source.slice("registry:".length);
        const { api, base, token } = client(flags);
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
        // gigetInput() drops the `@skill` selector without touching a ref that
        // happens to contain "@" — the tree is the repo/subpath, never the skill.
        const files = await tree(gigetInput(spec));
        const picked = pickSkillTree(files, spec.skill ?? name);
        return picked ? { files: picked } : null;
      }
      if (source.startsWith("gist:")) {
        const [user, id] = source.slice("gist:".length).split("/");
        const rs = await one(`https://gist.github.com/${user}/${id}`);
        return rs[0] ? { files: [{ path: "SKILL.md", contents: rs[0].raw }] } : null;
      }
      return null; // local: sources are never auto-updated
    },
  };
}

export const defaultUpdateDeps: UpdateDeps = makeDefaultUpdateDeps();

export async function runUpdate(names: string[], flags: UpdateFlags, deps: UpdateDeps = defaultUpdateDeps): Promise<UpdateResult> {
  const scopes = scopesFor(flags);
  const updated: string[] = []; const available: string[] = []; const failed: string[] = []; const lines: string[] = [];
  const seen = new Set<string>();
  for (const global of scopes) {
    const scope = { global, cwd: flags.cwd, home: flags.home };
    const lock = readLock(scope);
    const installed = listInstalled(scope).filter((s) => names.length === 0 || names.includes(s.name));
    for (const s of installed) {
      seen.add(s.name);
      const label = `${s.name}${scopes.length > 1 ? pc.dim(` [${s.scope}]`) : ""}`;
      const entry = lock.skills[s.name];
      if (!entry) { lines.push(pc.dim(`- ${label} untracked — reinstall with \`skillmd add\` to track updates`)); continue; }
      if (entry.source.startsWith("local:")) { lines.push(pc.dim(`- ${label} local source — not auto-updated`)); continue; }
      try {
        const latest = await deps.fetchLatest(entry.source, flags, s.name);
        if (!latest) { failed.push(s.name); lines.push(pc.red(`${GLYPH.blocked} ${label} no longer available upstream (${entry.source})`)); continue; }
        // A registry pin is authoritative: same commit, same skill, no digest needed.
        if (entry.source.startsWith("registry:") && latest.commit_sha && entry.commit_sha && latest.commit_sha === entry.commit_sha) { lines.push(pc.dim(`- ${label} up to date`)); continue; }
        if (digestOf(latest.files) === entry.digest) { lines.push(pc.dim(`- ${label} up to date`)); continue; }
        if (flags.check) { available.push(s.name); lines.push(pc.yellow(`↑ ${label} update available`)); continue; }
        const md = latest.files.find((f) => f.path === "SKILL.md");
        const raw = md ? (typeof md.contents === "string" ? md.contents : md.contents.toString("utf8")) : "";
        const result = lint(raw, { slug: s.name });
        if (!result.ok) { failed.push(s.name); lines.push(pc.red(`${GLYPH.blocked} ${label} update failed lint (${result.diagnostics.filter((d) => d.severity === "error").map((d) => d.id).join(", ")}) — kept the installed version`)); continue; }
        await installSkill({ name: s.name, files: latest.files, source: entry.source, commit_sha: latest.commit_sha, scope, agents: entry.agents, explicitAgents: true, mode: Object.values(entry.mode).includes("copy") ? "copy" : "link" });
        updated.push(s.name);
        lines.push(pc.green(`${GLYPH.ok} ${label} updated`));
      } catch (e) {
        failed.push(s.name);
        lines.push(pc.red(`${GLYPH.blocked} ${label} ${e instanceof Error ? e.message : String(e)}`));
      }
    }
  }
  // A name that matches nothing in any scope is a user error, not a no-op.
  for (const n of names) {
    if (seen.has(n)) continue;
    failed.push(n);
    lines.push(pc.yellow(`- ${n} not installed`));
  }
  const exitCode: 0 | 1 = failed.length ? 1 : 0;
  // The same skill can be installed in both scopes; the document lists it once.
  if (flags.json) return { updated, available, failed, exitCode, output: JSON.stringify({ ok: exitCode === 0, updated: [...new Set(updated)], available: [...new Set(available)], failed: [...new Set(failed)] }, null, 2) };
  if (lines.length === 0) lines.push(pc.dim("No installed skills found."));
  return { updated, available, failed, exitCode, output: lines.join("\n") };
}

function scopeOptions(cmd: Command): Command {
  return cmd.option("-g, --global", "only user-level skills").option("-p, --project", "only this project's skills").option("--json", "machine-readable output");
}
export function updateCommand(): Command {
  return scopeOptions(new Command("update").description("Update installed skills from the source recorded in the lock file (re-lints before writing)").argument("[names...]", "specific skills (default: all tracked)").option("--check", "only report which skills have updates"))
    .action(async (names: string[], opts: UpdateFlags, cmd: Command) => { const run = await runUpdate(names, { ...cmd.parent?.opts(), ...opts }); console.log(run.output); process.exitCode = run.exitCode; });
}
export function checkCommand(): Command {
  return scopeOptions(new Command("check").description("Report installed skills that have updates (alias of `update --check`)").argument("[names...]", "specific skills (default: all tracked)"))
    .action(async (names: string[], opts: UpdateFlags, cmd: Command) => { const run = await runUpdate(names, { ...cmd.parent?.opts(), ...opts, check: true }); console.log(run.output); process.exitCode = run.exitCode; });
}
