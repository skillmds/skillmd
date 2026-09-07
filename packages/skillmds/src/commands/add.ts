import { Command, Option } from "commander";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import pc from "picocolors";
import { lint } from "@skillmds/core";
import { createClient, skillMdFor, fetchBundle, IntegrityError, RegistryError } from "../api.js";
import type { RegistrySkill } from "../api.js";
import { resolveSource, resolveTree } from "../source.js";
import type { TreeFile } from "../source.js";
import { agentDir, detectAgents, writeSkill } from "../agents.js";
import type { SkillFileInput } from "../agents.js";

export interface AddFlags {
  global?: boolean;
  agent?: string[];
  skill?: string[];
  copy?: boolean;
  yes?: boolean;
  allowUnverified?: boolean;
  skipLint?: boolean;
  deny?: string[];
  token?: string;
  api?: string;
  /** Internal: project root override (tests). */
  cwd?: string;
  /** Internal: home dir override for agent detection (tests). */
  home?: string;
}

export interface AddCandidate {
  name: string;
  raw: string;
  slug: string;
  registrySlug?: string;
  verified?: boolean;
  type?: "single" | "pack";
  securityFlags?: string[];
  files?: SkillFileInput[];
  /** The pinned commit was unreachable upstream; files came from the default branch. */
  pinMiss?: boolean;
  /** Non-fatal caveat about how this candidate was resolved, shown as a ⚠ line. */
  note?: string;
}

export interface AddDeps {
  resolve: (arg: string, flags: AddFlags) => Promise<AddCandidate[]>;
  fireInstall: (registrySlug: string, flags: AddFlags) => void;
}

function isLocalish(arg: string): boolean {
  return arg === "." || arg.startsWith("./") || arg.startsWith("../") || arg.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(arg) || existsSync(arg);
}

export interface PackResolution {
  raw: string;
  files: SkillFileInput[];
  pinMiss: boolean;
}

/** Fetch a pack's full file tree, degrading in two steps: pinned commit →
 *  default branch (source repos force-push; bad pins are a real-world
 *  condition) → null, letting the caller fall back to the registry copy.
 *  An unpinned fetch is acceptable degradation: the fetched SKILL.md is still
 *  linted before install and the unverified gate still applies. */
export async function resolvePackFiles(
  skill: Pick<RegistrySkill, "source_repo" | "commit_sha">,
  fetchTree: (url: string, ref?: string) => Promise<TreeFile[]> = resolveTree,
): Promise<PackResolution | null> {
  if (!skill.source_repo) return null;
  const attempts: { ref?: string; pinMiss: boolean }[] = [{ ref: skill.commit_sha ?? undefined, pinMiss: false }];
  if (skill.commit_sha) attempts.push({ ref: undefined, pinMiss: true });
  for (const attempt of attempts) {
    try {
      const files = await fetchTree(skill.source_repo, attempt.ref);
      const sk = files.find((f) => f.path === "SKILL.md");
      if (sk) return { raw: sk.contents.toString("utf8"), files, pinMiss: attempt.pinMiss };
    } catch {
      // pinned commit gone (force-push) or network/repo failure → next step
    }
  }
  return null;
}

/** Caveat attached when a registry slug ends up installed from GitHub only
 *  because the registry itself couldn't be reached. */
export function registryFallbackNote(host: string): string {
  return `installed from GitHub because the SkillMD registry (${host}) was unreachable — this copy is not the registry-reviewed version`;
}

/** Both the registry and the GitHub fallback failed. Name the real cause
 *  (blocked/unreachable registry) instead of letting the fallback's GitHub 404
 *  stand as the visible error, and say what fixes it. */
export function registryUnreachableError(arg: string, host: string, e: RegistryError): Error {
  const why = e.status ? `HTTP ${e.status}` : "network error";
  return new Error(
    `could not reach the SkillMD registry at ${host} (${why}), and "${arg}" was not found on GitHub either.\n` +
    `If this environment restricts network access (sandbox, proxy, CI), ask an administrator to allow ${host} — ` +
    `or install through the SkillMD MCP server, which many sandboxed agents can already reach.\n` +
    `Registry error: ${e.message}`,
  );
}

const defaultDeps: AddDeps = {
  async resolve(arg, flags) {
    if (isLocalish(arg)) {
      const rs = await resolveSource(arg);
      return rs.map((r) => ({ name: r.slug, raw: r.raw, slug: r.slug }));
    }
    // Registry failure other than a 404. A 404 means "not a registry slug" and
    // the GitHub fallback is the intended path; anything else (DNS failure,
    // egress proxy 403, 5xx) means the registry couldn't be reached — remember
    // it so the fallback's own failure doesn't mask the real cause behind a
    // confusing GitHub 404.
    let registryDown: RegistryError | null = null;
    const registryHost = (() => { try { return new URL(createClient(flags).base).host; } catch { return "api.skillmd.com"; } })();
    // owner/name → registry skill (the registry-native default)
    if (/^[^/\s:]+\/[^/\s:]+$/.test(arg)) {
      const { api, base: apiBase, token } = createClient(flags);
      const [owner, name] = arg.split("/");
      try {
        const skill = await api<RegistrySkill>(`/api/skills/${owner}/${name}`);
        const skillName = skill.slug.split("/")[1] || name!;
        const meta = {
          name: skillName, slug: skillName, registrySlug: arg,
          verified: skill.verified, type: skill.type, securityFlags: skill.security_flags,
        };
        if (skill.type === "pack") {
          // Prefer the registry bundle: registry-stored, SHA-pinned, and survives
          // upstream deletion/force-push. Fall back to a live GitHub fetch.
          const bundle = await fetchBundle(apiBase, arg, token);
          if (bundle && bundle.length) {
            const sk = bundle.find((f) => f.path === "SKILL.md");
            return [{ ...meta, raw: sk ? sk.contents.toString("utf8") : skillMdFor(skill), files: bundle }];
          }
          const pack = await resolvePackFiles(skill);
          if (pack) return [{ ...meta, ...pack }];
        }
        return [{ ...meta, raw: skillMdFor(skill) }];
      } catch (e) {
        // A failed integrity check must never silently downgrade to an
        // unverified GitHub fetch — surface it so the install hard-blocks.
        if (e instanceof IntegrityError) throw e;
        if (e instanceof RegistryError && e.status !== 404) registryDown = e;
        // otherwise fall through to a git fetch
      }
    }
    try {
      const rs = await resolveSource(arg);
      const note = registryDown ? registryFallbackNote(registryHost) : undefined;
      return rs.map((r) => ({ name: r.slug, raw: r.raw, slug: r.slug, note }));
    } catch (e) {
      if (registryDown) throw registryUnreachableError(arg, registryHost, registryDown);
      throw e;
    }
  },
  fireInstall(registrySlug, flags) {
    const { api } = createClient(flags);
    const [owner, name] = registrySlug.split("/");
    void api(`/api/skills/${owner}/${name}/install`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ via: "cli" }),
    }).catch(() => {});
  },
};

export interface AddResult {
  written: { name: string; dir: string }[];
  blocked: { name: string; reason: string }[];
  exitCode: 0 | 1;
  output: string;
}

export async function runAdd(arg: string, flags: AddFlags, deps: AddDeps = defaultDeps): Promise<AddResult> {
  let candidates: AddCandidate[];
  try {
    candidates = await deps.resolve(arg, flags);
  } catch (e) {
    // An integrity failure blocks the install cleanly (never writes the bytes).
    if (e instanceof IntegrityError) {
      return {
        written: [],
        blocked: [{ name: arg, reason: e.message }],
        exitCode: 1,
        output: pc.red(`✗ ${arg} blocked — ${e.message}`),
      };
    }
    throw e;
  }
  if (flags.skill?.length) candidates = candidates.filter((c) => flags.skill!.includes(c.name) || flags.skill!.includes("*"));

  const deny = new Set(flags.deny ?? []);
  const written: AddResult["written"] = [];
  const blocked: AddResult["blocked"] = [];
  const lines: string[] = [];

  // Running from the home dir means "project scope" IS the home dir — use the
  // global layout there (agents like antigravity/gemini-cli keep their global
  // skills somewhere other than <root>/<project-dir>).
  const home = flags.home ?? homedir();
  const isGlobal = flags.global || resolve(flags.cwd ?? process.cwd()) === resolve(home);
  const scope = { global: isGlobal, cwd: flags.cwd, home: flags.home };
  const detected = detectAgents(scope);
  const targets = flags.agent?.length ? flags.agent : (detected.length ? detected : ["claude-code"]);
  // Several agents share a skills dir (the `.agents/skills` convention) — write
  // each physical dir once, labelled with every agent it serves.
  const dirAgents = new Map<string, string[]>();
  for (const agentId of targets) {
    const dir = agentDir(agentId, scope);
    dirAgents.set(dir, [...(dirAgents.get(dir) ?? []), agentId]);
  }

  for (const c of candidates) {
    const result = lint(c.raw, { slug: c.slug });
    const allFlags = [...new Set([...result.security.flags, ...(c.securityFlags ?? [])])];
    const deniedFlags = allFlags.filter((f) => deny.has(f));

    if (!flags.skipLint && !result.ok) {
      blocked.push({ name: c.name, reason: `lint errors: ${result.diagnostics.filter((d) => d.severity === "error").map((d) => d.id).join(", ")}` });
      lines.push(pc.red(`✗ ${c.name} blocked — failed lint (use --skip-lint to override)`));
      continue;
    }
    // --deny is opt-in: only blocks when the user explicitly asks to exclude a
    // flag. Verification status never blocks — any skill installs (flags are
    // shown on the success line as information, not a gate).
    if (deniedFlags.length) {
      blocked.push({ name: c.name, reason: `denied security flags: ${deniedFlags.join(", ")}` });
      lines.push(pc.red(`✗ ${c.name} blocked — you passed --deny ${deniedFlags.join(", ")}`));
      continue;
    }

    const files = c.files ?? [{ path: "SKILL.md", contents: c.raw }];
    for (const [dir, agentIds] of dirAgents) {
      const out = writeSkill(c.name, files, dir, { mode: "copy" });
      written.push({ name: c.name, dir: out });
      lines.push(pc.green(`✓ ${c.name} → ${out}`) + pc.dim(` (${agentIds.join(", ")}; score ${result.score}${allFlags.length ? `; ${allFlags.join(", ")}` : ""})`));
    }
    if (c.pinMiss) {
      lines.push(pc.yellow(`⚠ ${c.name}: pinned commit unavailable upstream — fetched the source repo's default branch instead`));
    }
    if (c.note) {
      lines.push(pc.yellow(`⚠ ${c.name}: ${c.note}`));
    }
    if (c.type === "pack" && !c.files) {
      lines.push(pc.yellow(`⚠ ${c.name} is a pack but its asset files could not be fetched — only SKILL.md was installed. It may reference missing files.`));
    }
    if (c.registrySlug) deps.fireInstall(c.registrySlug, flags);
  }

  const exitCode: 0 | 1 = written.length === 0 ? 1 : 0;
  return { written, blocked, exitCode, output: lines.join("\n") };
}

export function addCommand(): Command {
  return new Command("add")
    .description("Install a skill from the registry, a GitHub repo, or a local path (lints before writing)")
    .argument("<source>", "registry slug (owner/name), GitHub source, or local path")
    .option("-g, --global", "install to the user directory instead of the project")
    .option("-a, --agent <agents...>", "target specific agents (default: every agent detected on this machine)")
    .option("-s, --skill <names...>", "install only specific skills by name ('*' for all)")
    .option("--copy", "copy files (default)", true)
    .option("-y, --yes", "skip confirmation prompts")
    // deprecated no-op: installs are no longer gated on verification. Kept so
    // older install snippets that pass it don't error.
    .addOption(new Option("--allow-unverified").hideHelp())
    .option("--skip-lint", "install even if the skill fails lint")
    .option("--deny <flags...>", "refuse skills carrying any of these security flags (opt-in)")
    .action(async (source: string, opts: AddFlags, cmd: Command) => {
      const merged = { ...cmd.parent?.opts(), ...opts };
      const run = await runAdd(source, merged);
      console.log(run.output);
      process.exitCode = run.exitCode;
    });
}
