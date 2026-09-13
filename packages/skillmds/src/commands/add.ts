import { Command, Option } from "commander";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import * as p from "@clack/prompts";
import { join, relative, resolve } from "node:path";
import pc from "picocolors";
import { lint, parseSkillMd } from "@skillmds/core";
import { createClient, skillMdFor, fetchBundle, IntegrityError, RegistryError } from "../api.js";
import type { RegistrySkill } from "../api.js";
import { resolveSource, resolveTree } from "../source.js";
import type { TreeFile } from "../source.js";
import { AGENTS, agentDir, agentSupportsGlobal, detectAgents } from "../agents.js";
import { installSkill } from "../installer.js";
import type { InstallResult, InstallTarget, SkillFileInput } from "../installer.js";
import { parseSource, sourceId } from "../sources.js";
import type { SourceSpec } from "../sources.js";
import { detectHostAgent, isInteractive, nonInteractiveHint } from "../env.js";
import { readConfig, writeConfig, telemetryDisabled } from "../config.js";
import { safeText } from "../sanitize.js";

export interface AddFlags {
  global?: boolean;
  /** Force project scope (the current directory) even when it doesn't look like a project. */
  project?: boolean;
  agent?: string[];
  skill?: string[];
  /** Git ref (branch, tag, commit) for GitHub sources. Forces the GitHub route for `owner/name`. */
  ref?: string;
  /** Show what a source contains and install nothing. */
  list?: boolean;
  /** How each agent dir gets the skill: a link to the canonical copy, or its own copy. */
  mode?: "link" | "copy";
  /** Replace a skill installed from a different source, or an untracked directory. */
  force?: boolean;
  yes?: boolean;
  allowUnverified?: boolean;
  skipLint?: boolean;
  deny?: string[];
  json?: boolean;
  token?: string;
  api?: string;
  /** Allow an http:// --api base (local development). */
  insecureHttp?: boolean;
  /** Internal: project root override (tests). */
  cwd?: string;
  /** Internal: home dir override for agent detection (tests). */
  home?: string;
  /** Internal: environment override (tests) — host-agent, CI and telemetry detection. */
  env?: NodeJS.ProcessEnv;
}

export interface AddCandidate {
  name: string;
  raw: string;
  slug: string;
  /** sourceId() provenance written to the lock file. Defaults from registrySlug/arg. */
  source?: string;
  commit_sha?: string;
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
  /**
   * Ask the user where to install when neither scope flag was given. Returns
   * true for global, false for project, null when the user cancelled. Absent
   * (tests, non-interactive callers) → scope is auto-detected instead.
   */
  promptScope?: (ctx: { cwd: string; suggestGlobal: boolean }) => Promise<boolean | null>;
  /** Let the user narrow the detected agents. null = cancelled. Absent → all detected. */
  promptAgents?: (ctx: { detected: string[]; dirFor: (id: string) => string }) => Promise<string[] | null>;
  /** Test hook: a prompt is required but cannot be shown. Overrides defaultNeedsPrompt(). */
  needsPrompt?: boolean;
}

/** Files or dirs whose presence marks a directory as a project root. Mirrors the
 *  `skills` CLI's auto-detect rule ("project if in a project, else global"). */
const PROJECT_MARKERS = [".git", "package.json", "pyproject.toml", "Cargo.toml", "go.mod", "AGENTS.md", "CLAUDE.md", "skills-lock.json"];

/** Every dot-directory that marks an agent as present in a project, current and
 *  legacy alike (`.codex`, `.kilocode`, …). Non-dot roots (`agent`, `skills`) are
 *  too generic to imply "this is a project". */
const AGENT_PROJECT_ROOTS = [...new Set(AGENTS.flatMap((a) => a.projectRoots))].filter((r) => r.startsWith("."));

/** Does `dir` look like a project root? True when it carries a common project
 *  marker or already has an agent's dot-directory (`.claude`, `.cursor`, `.agents`, …). */
export function looksLikeProject(dir: string): boolean {
  if (PROJECT_MARKERS.some((m) => existsSync(join(dir, m)))) return true;
  return AGENT_PROJECT_ROOTS.some((seg) => existsSync(join(dir, seg)));
}

const interactive = () => Boolean(process.stdin.isTTY && process.stdout.isTTY);

/** Same choice the `skills` CLI offers: Project vs Global, before anything is written. */
async function promptScopeInteractive(ctx: { cwd: string; suggestGlobal: boolean }): Promise<boolean | null> {
  const choice = await p.select({
    message: "Installation scope",
    initialValue: ctx.suggestGlobal,
    options: [
      { value: false, label: "Project", hint: `install in ${ctx.cwd} (committed with your project)` },
      { value: true, label: "Global", hint: "install in your home directory (available across all projects)" },
    ],
  });
  return p.isCancel(choice) ? null : (choice as boolean);
}

async function promptAgentsInteractive(ctx: { detected: string[]; dirFor: (id: string) => string }): Promise<string[] | null> {
  if (ctx.detected.length < 2) return ctx.detected;
  // Most people install to the same agents every time — pre-select last run's
  // pick (minus any agent that is no longer detected) instead of everything.
  const remembered = (readConfig().lastAgents ?? []).filter((id) => ctx.detected.includes(id));
  const picked = await p.multiselect({
    message: "Which agents do you want to install to?",
    options: ctx.detected.map((id) => ({ value: id, label: id, hint: ctx.dirFor(id) })),
    initialValues: remembered.length ? remembered : ctx.detected,
    required: true,
  });
  return p.isCancel(picked) ? null : (picked as string[]);
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

/** resolveSource() re-parses the raw argument and knows nothing about --ref, so
 *  a ref given on the command line is folded back into a shorthand it can parse.
 *  Only done when --ref was actually passed: every other argument reaches
 *  resolveSource() exactly as the user typed it. */
function argWithRef(spec: SourceSpec, original: string, ref?: string): string {
  if (!ref || spec.kind !== "github") return original;
  return `github:${spec.owner}/${spec.repo}${spec.subpath ? `/${spec.subpath}` : ""}#${ref}${spec.skill ? `@${spec.skill}` : ""}`;
}

const defaultDeps: AddDeps = {
  async resolve(arg, flags) {
    const spec = parseSource(arg, { ref: flags.ref });
    const source = sourceId(spec);
    // Everything that is not a bare owner/name is fetched directly; only a
    // registry slug gets the registry-first treatment below.
    if (spec.kind !== "slug") {
      const rs = await resolveSource(argWithRef(spec, arg, flags.ref));
      return rs.map((r) => ({ name: r.slug, raw: r.raw, slug: r.slug, source }));
    }
    // Registry failure other than a 404. A 404 means "not a registry slug" and
    // the GitHub fallback is the intended path; anything else (DNS failure,
    // egress proxy 403, 5xx) means the registry couldn't be reached — remember
    // it so the fallback's own failure doesn't mask the real cause behind a
    // confusing GitHub 404.
    let registryDown: RegistryError | null = null;
    const { api, base: apiBase, token } = createClient(flags);
    const registryHost = (() => { try { return new URL(apiBase).host; } catch { return "api.skillmd.com"; } })();
    const registrySlug = `${spec.owner}/${spec.name}`;
    try {
      const skill = await api<RegistrySkill>(`/api/skills/${spec.owner}/${spec.name}`);
      const skillName = skill.slug.split("/")[1] || spec.name;
      const meta = {
        name: skillName, slug: skillName, registrySlug, source, commit_sha: skill.commit_sha ?? undefined,
        verified: skill.verified, type: skill.type, securityFlags: skill.security_flags,
      };
      if (skill.type === "pack") {
        // Prefer the registry bundle: registry-stored, SHA-pinned, and survives
        // upstream deletion/force-push. Fall back to a live GitHub fetch.
        const bundle = await fetchBundle(apiBase, registrySlug, token);
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
    // The fallback is a GitHub fetch, so the provenance recorded is GitHub's —
    // never the registry slug the user typed.
    const ghSource = sourceId({ kind: "github", owner: spec.owner, repo: spec.name, display: arg });
    try {
      const rs = await resolveSource(arg);
      const note = registryDown ? registryFallbackNote(registryHost) : undefined;
      return rs.map((r) => ({ name: r.slug, raw: r.raw, slug: r.slug, source: ghSource, note }));
    } catch (e) {
      if (registryDown) throw registryUnreachableError(arg, registryHost, registryDown);
      throw e;
    }
  },
  get promptScope() { return interactive() ? promptScopeInteractive : undefined; },
  get promptAgents() { return interactive() ? promptAgentsInteractive : undefined; },
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
  /** The user backed out of a prompt; nothing was written. */
  cancelled?: boolean;
}

export type Scope = { global: boolean; cwd?: string; home?: string; env?: NodeJS.ProcessEnv };

/**
 * Decide project vs global. Explicit flags win; the home dir is always global
 * (project scope rooted at $HOME *is* the global layout). Otherwise a terminal
 * user is asked — the way `npx skills add` does — and non-interactive callers
 * (-y, --json, a host agent's shell, piped stdin) get the auto-detect rule:
 * project if the current directory looks like a project, else global. Running
 * `add` from the Desktop or any stray folder must never litter it with a dozen
 * agent directories.
 */
export async function resolveScope(flags: AddFlags, deps: AddDeps): Promise<{ scope: Scope; note?: string } | null> {
  const home = resolve(flags.home ?? homedir());
  const cwd = resolve(flags.cwd ?? process.cwd());
  const base = { cwd: flags.cwd, home: flags.home, env: flags.env };
  if (flags.global) return { scope: { global: true, ...base } };
  if (flags.project) return { scope: { global: false, ...base } };
  if (cwd === home) return { scope: { global: true, ...base } };

  const isProject = looksLikeProject(cwd);
  // Inside a host agent a prompt would hang the agent's shell: behave like -y.
  const hosted = detectHostAgent(flags.env ?? process.env) !== null;
  if (deps.promptScope && !flags.yes && !flags.json && !hosted) {
    const global = await deps.promptScope({ cwd, suggestGlobal: !isProject });
    if (global === null) return null;
    return { scope: { global, ...base } };
  }
  if (isProject) return { scope: { global: false, ...base } };
  return {
    scope: { global: true, ...base },
    note: `no project detected in ${cwd} — installing to your user-level agent folders (pass --project to install here)`,
  };
}

/**
 * A scope decision is needed and nobody can answer it: no scope flag, no -y, no
 * host agent to imply one, and no terminal to ask on. Guessing here is how a
 * piped or CI run ends up writing agent dirs somewhere nobody wanted them, so
 * the caller exits 1 with a hint instead.
 */
export function defaultNeedsPrompt(flags: AddFlags): boolean {
  const env = flags.env ?? process.env;
  if (flags.yes || flags.json || flags.global || flags.project || flags.list) return false;
  if (detectHostAgent(env)) return false;
  if (resolve(flags.cwd ?? process.cwd()) === resolve(flags.home ?? homedir())) return false;
  return !isInteractive(flags, { stdinTTY: Boolean(process.stdin.isTTY), stdoutTTY: Boolean(process.stdout.isTTY), env });
}

const CANCELLED: AddResult = { written: [], blocked: [], exitCode: 0, cancelled: true, output: pc.dim("Installation cancelled — nothing was installed.") };

interface InstalledDoc {
  name: string;
  canonical: string;
  targets: InstallTarget[];
  skipped: { agent: string; reason: string }[];
  digest: string;
}

export async function runAdd(arg: string, flags: AddFlags, deps: AddDeps = defaultDeps): Promise<AddResult> {
  const env = flags.env ?? process.env;
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

  // --json is a contract with a program: stdout carries one document and no
  // prompt can ever be shown, so the scope must be stated rather than guessed.
  if (flags.json && !flags.yes) {
    return {
      written: [], blocked: [], exitCode: 1,
      output: JSON.stringify({ ok: false, error: "--json requires -y (no prompts can be shown in JSON mode)" }),
    };
  }
  // An injected promptScope (tests, callers that drive their own UI) counts as
  // "someone can answer", whatever the real stdin looks like.
  if (deps.needsPrompt ?? (!deps.promptScope && defaultNeedsPrompt(flags))) {
    return {
      written: [], blocked: [], exitCode: 1,
      output: pc.red(nonInteractiveHint("-y (auto-detects the scope) or -g / -p")),
    };
  }

  if (flags.list) {
    const preview = candidates.map((c) => {
      const parsed = parseSkillMd(c.raw);
      const desc = "error" in parsed ? `(invalid SKILL.md — ${parsed.error})` : parsed.description;
      return `${pc.bold(c.name)}  ${pc.dim(safeText(desc, 80))}`;
    });
    return { written: [], blocked: [], exitCode: 0, output: preview.length ? preview.join("\n") : "No skills found." };
  }

  const deny = new Set(flags.deny ?? []);
  const written: AddResult["written"] = [];
  const blocked: AddResult["blocked"] = [];
  const installed: InstalledDoc[] = [];
  const lines: string[] = [];

  const resolved = await resolveScope(flags, deps);
  if (!resolved) return CANCELLED;
  const scope = resolved.scope;
  const isGlobal = scope.global;
  if (resolved.note) lines.push(pc.dim(`ℹ ${resolved.note}`));

  const detected = detectAgents(scope);
  let targets = flags.agent?.length ? flags.agent : (detected.length ? detected : ["claude-code"]);
  // Project-only agents have no global dir at all — drop them before anything
  // asks agentDir() for one (it throws), and say why they were dropped.
  if (isGlobal) {
    const kept: string[] = [];
    for (const id of targets) {
      if (agentSupportsGlobal(id)) kept.push(id);
      else lines.push(pc.dim(`↷ ${id}: project-only agent`));
    }
    targets = kept;
  }
  if (!flags.agent?.length && deps.promptAgents && !flags.yes && !flags.json && !detectHostAgent(env)) {
    const picked = await deps.promptAgents({ detected: targets, dirFor: (id) => agentDir(id, scope) });
    if (picked === null) return CANCELLED;
    targets = picked;
    // Remember the pick for next time — but never from a test run, which points
    // `home` at a temp dir while readConfig/writeConfig use the real one.
    if (flags.home === undefined && picked.length) {
      try { writeConfig({ ...readConfig(), lastAgents: picked }); } catch { /* remembering is best-effort */ }
    }
  }

  const scopeRoot = isGlobal ? (flags.home ?? homedir()) : (flags.cwd ?? process.cwd());
  const rel = (abs: string): string => {
    const r = relative(scopeRoot, abs);
    return r && !r.startsWith("..") ? r : abs;
  };

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

    const source = c.source ?? (c.registrySlug ? `registry:${c.registrySlug}` : `local:${arg}`);
    let out: InstallResult;
    try {
      out = await installSkill({
        name: c.name,
        files: c.files ?? [{ path: "SKILL.md", contents: c.raw }],
        source,
        commit_sha: c.commit_sha,
        scope,
        agents: targets,
        explicitAgents: Boolean(flags.agent?.length),
        mode: flags.mode,
        force: flags.force,
      });
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      blocked.push({ name: c.name, reason });
      lines.push(pc.red(`✗ ${c.name} — ${reason}`));
      continue;
    }

    lines.push(`${pc.green("✓")} ${pc.bold(c.name)}  ${pc.dim(`score ${result.score}`)}${allFlags.length ? `  ${pc.yellow(allFlags.join(", "))}` : ""}`);
    for (const t of out.targets) {
      written.push({ name: c.name, dir: t.path });
      lines.push(`  ${t.agent.padEnd(14)} ${rel(t.path)} ${pc.dim(t.mode)}`);
    }
    for (const s of out.skipped) lines.push(pc.dim(`  ↷ ${s.agent}: ${s.reason}`));
    if (out.replaced) lines.push(pc.yellow(`  ⚠ replaced previous install (${out.replaced})`));
    installed.push({ name: c.name, canonical: out.canonical, targets: out.targets, skipped: out.skipped, digest: out.digest });

    if (c.pinMiss) {
      lines.push(pc.yellow(`⚠ ${c.name}: pinned commit unavailable upstream — fetched the source repo's default branch instead`));
    }
    if (c.note) {
      lines.push(pc.yellow(`⚠ ${c.name}: ${c.note}`));
    }
    if (c.type === "pack" && !c.files) {
      lines.push(pc.yellow(`⚠ ${c.name} is a pack but its asset files could not be fetched — only SKILL.md was installed. It may reference missing files.`));
    }
    // Install counts are a registry-side number, and opting out must be honoured
    // before the request is built, not inside it.
    if (c.registrySlug && !telemetryDisabled(env)) deps.fireInstall(c.registrySlug, flags);
  }

  const exitCode: 0 | 1 = blocked.length > 0 || installed.length === 0 ? 1 : 0;
  if (flags.json) {
    const doc = { ok: exitCode === 0, scope: isGlobal ? "global" : "project", installed, blocked };
    return { written, blocked, exitCode, output: JSON.stringify(doc, null, 2) };
  }
  return { written, blocked, exitCode, output: lines.join("\n") };
}

export function addCommand(): Command {
  return new Command("add")
    .description("Install a skill from the registry, a GitHub repo, or a local path (lints before writing)")
    .argument("<source>", "registry slug (owner/name), GitHub source, or local path")
    .option("-g, --global", "install to your user-level agent folders (available in every project)")
    .option("-p, --project", "install into the current directory's agent folders (committed with the project)")
    .option("-a, --agent <agents...>", "target specific agents (default: every agent detected on this machine)")
    .option("-s, --skill <names...>", "install only specific skills by name ('*' for all)")
    .option("--ref <ref>", "git ref (branch, tag or commit) for GitHub sources")
    .option("-l, --list", "list the skills a source contains without installing")
    .addOption(new Option("--mode <mode>", "link (junction/symlink into each agent dir, default) or copy").choices(["link", "copy"]).default("link"))
    .option("--force", "replace a skill installed from a different source, or an untracked directory")
    .option("--insecure-http", "allow an http:// --api base (local development)")
    // deprecated spelling of --mode copy, kept so older install snippets work.
    .addOption(new Option("--copy").hideHelp())
    .option("-y, --yes", "skip prompts; scope is auto-detected (project if this folder looks like a project, else global)")
    // deprecated no-op: installs are no longer gated on verification. Kept so
    // older install snippets that pass it don't error.
    .addOption(new Option("--allow-unverified").hideHelp())
    .option("--skip-lint", "install even if the skill fails lint")
    .option("--deny <flags...>", "refuse skills carrying any of these security flags (opt-in)")
    .action(async (source: string, opts: AddFlags & { copy?: boolean }, cmd: Command) => {
      const merged: AddFlags = { ...cmd.parent?.opts(), ...opts };
      if (opts.copy) merged.mode = "copy";
      const run = await runAdd(source, merged);
      console.log(run.output);
      process.exitCode = run.exitCode;
    });
}
