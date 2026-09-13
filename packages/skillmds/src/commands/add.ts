import { Command, Option } from "commander";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import * as p from "@clack/prompts";
import { dirname, join, resolve } from "node:path";
import pc from "picocolors";
import { lint, parseSkillMd } from "@skillmds/core";
import { createClient, skillMdFor, fetchBundle, IntegrityError, RegistryError } from "../api.js";
import type { RegistrySkill } from "../api.js";
import { collectFiles, resolveSource, resolveTree } from "../source.js";
import type { TreeFile } from "../source.js";
import { AGENTS, agentDir, agentSupportsGlobal, detectAgents } from "../agents.js";
import { installSkill } from "../installer.js";
import type { InstallResult, InstallTarget, SkillFileInput } from "../installer.js";
import { parseSource, sourceId } from "../sources.js";
import { detectHostAgent, isInteractive, nonInteractiveHint, realTerminal } from "../env.js";
import type { Terminal } from "../env.js";
import { readConfig, writeConfig, telemetryDisabled } from "../config.js";
import { safeText } from "../sanitize.js";
import { GLYPH, banner, renderInstallSummary } from "../ui.js";
import type { PathCtx } from "../ui.js";

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

// ---------------------------------------------------------------------------
// Notices — every non-fatal remark this command can make. The text is written
// once, in plain words: --json reports it verbatim in `warnings[]`, and the
// human renderer is the only thing that ever colours or decorates it.
// ---------------------------------------------------------------------------

// `style` decides how a notice is drawn; `suppressInSummary` decides whether
// the human renderer draws it at all. The "replaced" remark is a warning like
// any other in --json's warnings[], but the install summary already prints that
// line under the skill, so the human path skips the duplicate.
interface Notice { text: string; style: "info" | "warn" | "skip"; suppressInSummary?: boolean }
const infoNotice = (text: string): Notice => ({ text, style: "info" });
const warnNotice = (text: string): Notice => ({ text, style: "warn" });
const skipNotice = (text: string): Notice => ({ text, style: "skip" });
const replacedNotice = (text: string): Notice => ({ text, style: "warn", suppressInSummary: true });

function noticeLine(n: Notice): string {
  switch (n.style) {
    case "info": return pc.dim(`${GLYPH.info} ${n.text}`);
    case "skip": return pc.dim(`${GLYPH.skip} ${n.text}`);
    case "warn": return pc.yellow(`${GLYPH.warn} ${n.text}`);
  }
}

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
 *  Only done when --ref was actually passed, and only for GitHub sources: every
 *  other argument reaches resolveSource() exactly as the user typed it. */
export function argWithRef(arg: string, ref?: string): string {
  if (!ref) return arg;
  try {
    const spec = parseSource(arg, { ref });
    return spec.kind === "github" ? sourceId(spec) : arg;
  } catch {
    return arg;
  }
}

/** Provenance for a candidate the resolver left unattributed: re-read the
 *  argument the user typed instead of inventing a `local:` id for something
 *  that is just as likely a registry slug or a GitHub repo. */
function provenanceFor(arg: string): string {
  try {
    return sourceId(parseSource(arg));
  } catch {
    return `unknown:${arg}`;
  }
}

/** The real deps. Built per run, because whether a prompt may be opened is a
 *  property of *this* invocation's flags (-y, --json, host agent, TTY). */
function makeDefaultDeps(flags: AddFlags): AddDeps {
  const canPrompt = (): boolean => isInteractive(flags, {
    stdinTTY: Boolean(process.stdin.isTTY),
    stdoutTTY: Boolean(process.stdout.isTTY),
    env: flags.env ?? process.env,
  });
  return {
    async resolve(arg, f) {
      const spec = parseSource(arg, { ref: f.ref });
      const source = sourceId(spec);
      // Everything that is not a bare owner/name is fetched directly; only a
      // registry slug gets the registry-first treatment below.
      if (spec.kind !== "slug") {
        const rs = await resolveSource(argWithRef(arg, f.ref));
        // A local skill is a directory on disk, so install the whole of it —
        // references/, scripts/, assets — not just its SKILL.md. Remote sources
        // (gist, GitHub) carry no `file` and still install SKILL.md only;
        // resolveTree() is the path to giving them full trees as well.
        return rs.map((r) => ({
          name: r.slug, raw: r.raw, slug: r.slug, source,
          ...(spec.kind === "local" && r.file ? { files: collectFiles(dirname(r.file), dirname(r.file)) } : {}),
        }));
      }
      // Registry failure other than a 404. A 404 means "not a registry slug" and
      // the GitHub fallback is the intended path; anything else (DNS failure,
      // egress proxy 403, 5xx) means the registry couldn't be reached — remember
      // it so the fallback's own failure doesn't mask the real cause behind a
      // confusing GitHub 404.
      let registryDown: RegistryError | null = null;
      const { api, base: apiBase, token } = createClient(f);
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
            const sk = bundle.find((file) => file.path === "SKILL.md");
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
    get promptScope() { return canPrompt() ? promptScopeInteractive : undefined; },
    get promptAgents() { return canPrompt() ? promptAgentsInteractive : undefined; },
    fireInstall(registrySlug, f) {
      const { api } = createClient(f);
      const [owner, name] = registrySlug.split("/");
      void api(`/api/skills/${owner}/${name}/install`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ via: "cli" }),
      }).catch(() => {});
    },
  };
}

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
 * A scope decision is needed and nobody is there to answer it. Inside a host
 * agent — or in CI — the scope is auto-detected rather than refused: an
 * operator chose to run us unattended, and a hanging prompt would be worse
 * than a sensible default. That leaves exactly one case: a run that looks
 * interactive but is not — a human shell with stdin piped or redirected, no -y
 * and no scope flag. Guessing there is how a piped run ends up writing agent
 * dirs somewhere nobody wanted them, so the caller exits 1 with a hint.
 */
export function defaultNeedsPrompt(flags: AddFlags): boolean {
  const env = flags.env ?? process.env;
  if (flags.yes || flags.json || flags.global || flags.project || flags.list) return false;
  if (detectHostAgent(env)) return false;
  if (resolve(flags.cwd ?? process.cwd()) === resolve(flags.home ?? homedir())) return false;
  return !isInteractive(flags, { stdinTTY: Boolean(process.stdin.isTTY), stdoutTTY: Boolean(process.stdout.isTTY), env });
}

interface InstalledDoc {
  name: string;
  canonical: string;
  targets: InstallTarget[];
  skipped: { agent: string; reason: string }[];
  digest: string;
}

type CandidateRecord =
  | { kind: "installed"; doc: InstalledDoc; score: number; securityFlags: string[]; notices: Notice[]; source: string; replaced?: string }
  | { kind: "blocked"; name: string; reason: string; message: string };

type AddOutcome =
  | { kind: "install"; scope: "global" | "project"; records: CandidateRecord[]; notices: Notice[]; paths: PathCtx }
  | { kind: "list"; skills: { name: string; description: string }[] }
  | { kind: "fail"; error: string; blocked?: AddResult["blocked"]; notices?: Notice[] }
  | { kind: "cancel" };

const CANCELLED_TEXT = "installation cancelled — nothing was installed";

/**
 * The single exit of runAdd(). `--json` is a contract with a program: stdout
 * carries exactly one document, success or failure, and every human-only
 * remark is repeated there as plain text under `warnings`.
 */
function finish(flags: AddFlags, outcome: AddOutcome): AddResult {
  const json = Boolean(flags.json);
  switch (outcome.kind) {
    case "install": {
      const installed = outcome.records.flatMap((r) => (r.kind === "installed" ? [r.doc] : []));
      const blocked = outcome.records.flatMap((r) => (r.kind === "blocked" ? [{ name: r.name, reason: r.reason }] : []));
      const written = installed.flatMap((d) => d.targets.map((t) => ({ name: d.name, dir: t.path })));
      const warnings = [
        ...outcome.notices,
        ...outcome.records.flatMap((r) => (r.kind === "installed" ? r.notices : [])),
      ].map((n) => n.text);
      const exitCode: 0 | 1 = blocked.length > 0 || installed.length === 0 ? 1 : 0;
      const doc = { ok: exitCode === 0, scope: outcome.scope, installed, blocked, warnings };
      return {
        written, blocked, exitCode,
        output: json ? JSON.stringify(doc, null, 2) : renderHuman(outcome.notices, outcome.records, outcome.paths),
      };
    }
    case "list": {
      const human = outcome.skills.length
        ? outcome.skills.map((s) => `${pc.bold(s.name)}  ${pc.dim(s.description)}`).join("\n")
        : "No skills found.";
      return { written: [], blocked: [], exitCode: 0, output: json ? JSON.stringify({ ok: true, skills: outcome.skills }, null, 2) : human };
    }
    case "cancel": {
      const doc = { ok: false, error: CANCELLED_TEXT };
      return {
        written: [], blocked: [], exitCode: 0, cancelled: true,
        output: json ? JSON.stringify(doc, null, 2) : pc.dim("Installation cancelled — nothing was installed."),
      };
    }
    case "fail": {
      const warnings = (outcome.notices ?? []).map((n) => n.text);
      const doc: { ok: false; error: string; blocked?: AddResult["blocked"]; warnings?: string[] } = { ok: false, error: outcome.error };
      if (outcome.blocked?.length) doc.blocked = outcome.blocked;
      if (warnings.length) doc.warnings = warnings;
      const human = [
        ...(outcome.notices ?? []).map(noticeLine),
        ...(outcome.blocked?.length
          ? outcome.blocked.map((b) => pc.red(`${GLYPH.blocked} ${b.name} blocked — ${b.reason}`))
          : [pc.red(outcome.error)]),
      ].join("\n");
      return { written: [], blocked: outcome.blocked ?? [], exitCode: 1, output: json ? JSON.stringify(doc, null, 2) : human };
    }
  }
}

/** The only place that turns a finished run into terminal text. */
function renderHuman(notices: Notice[], records: CandidateRecord[], paths: PathCtx): string {
  const lines = notices.map(noticeLine);
  for (const r of records) {
    if (r.kind === "blocked") { lines.push(pc.red(r.message)); continue; }
    const { doc } = r;
    lines.push(renderInstallSummary({
      name: doc.name,
      score: r.score,
      flags: r.securityFlags,
      source: r.source,
      canonical: doc.canonical,
      targets: doc.targets,
      skipped: doc.skipped,
      ...(r.replaced ? { replaced: r.replaced } : {}),
    }, paths));
    // The summary already carries the skipped agents and the "replaced" line;
    // everything else the install had to say still gets its own notice line.
    for (const n of r.notices) if (!n.suppressInSummary) lines.push(noticeLine(n));
  }
  return lines.join("\n");
}

/** Ask the deps what the argument contains, then narrow it with --skill. */
async function resolveCandidates(arg: string, flags: AddFlags, deps: AddDeps): Promise<AddCandidate[]> {
  const candidates = await deps.resolve(arg, flags);
  if (!flags.skill?.length) return candidates;
  return candidates.filter((c) => flags.skill!.includes(c.name) || flags.skill!.includes("*"));
}

/** Everything that ends a run before a single byte is written. Returns the
 *  finished result, or null to carry on with the install. */
function gate(flags: AddFlags, deps: AddDeps, candidates: AddCandidate[]): AddResult | null {
  if (flags.list) {
    return finish(flags, {
      kind: "list",
      skills: candidates.map((c) => {
        const parsed = parseSkillMd(c.raw);
        const description = "error" in parsed ? `(invalid SKILL.md — ${parsed.error})` : parsed.description;
        return { name: c.name, description: safeText(description, 80) };
      }),
    });
  }
  // --json is a contract with a program: stdout carries one document and no
  // prompt can ever be shown, so the scope must be stated rather than guessed.
  if (flags.json && !flags.yes) {
    return finish(flags, { kind: "fail", error: "--json requires -y (no prompts can be shown in JSON mode)" });
  }
  // An injected promptScope (tests, callers that drive their own UI) counts as
  // "someone can answer", whatever the real stdin looks like.
  if (deps.needsPrompt ?? (!deps.promptScope && defaultNeedsPrompt(flags))) {
    return finish(flags, { kind: "fail", error: nonInteractiveHint("-y (auto-detects the scope) or -g / -p") });
  }
  return null;
}

/** Which agent dirs this install writes to. null = the user cancelled. */
async function chooseTargets(
  flags: AddFlags,
  deps: AddDeps,
  scope: Scope,
  detected: string[],
): Promise<{ targets: string[]; notices: Notice[] } | null> {
  const notices: Notice[] = [];
  let targets = flags.agent?.length ? flags.agent : (detected.length ? detected : ["claude-code"]);
  // Project-only agents have no global dir at all — drop them before anything
  // asks agentDir() for one (it throws), and say why they were dropped.
  if (scope.global) {
    const kept: string[] = [];
    for (const id of targets) {
      if (agentSupportsGlobal(id)) kept.push(id);
      else notices.push(skipNotice(`${id}: project-only agent`));
    }
    targets = kept;
  }
  if (!flags.agent?.length && deps.promptAgents && !flags.yes && !flags.json && !detectHostAgent(flags.env ?? process.env)) {
    const picked = await deps.promptAgents({ detected: targets, dirFor: (id) => agentDir(id, scope) });
    if (picked === null) return null;
    targets = picked;
    // Remember the pick for next time — but never from a test run, which points
    // `home` at a temp dir while readConfig/writeConfig use the real one.
    if (flags.home === undefined && picked.length) {
      try { writeConfig({ ...readConfig(), lastAgents: picked }); } catch { /* remembering is best-effort */ }
    }
  }
  return { targets, notices };
}

interface InstallContext {
  arg: string;
  flags: AddFlags;
  deny: Set<string>;
  scope: Scope;
  targets: string[];
  env: NodeJS.ProcessEnv;
  deps: AddDeps;
}

/** Lint gate, --deny gate, then the write. Never throws: a failure becomes a
 *  blocked record so the remaining candidates still get their turn. */
async function installOne(c: AddCandidate, ctx: InstallContext): Promise<CandidateRecord> {
  const result = lint(c.raw, { slug: c.slug });
  const securityFlags = [...new Set([...result.security.flags, ...(c.securityFlags ?? [])])];
  const deniedFlags = securityFlags.filter((f) => ctx.deny.has(f));

  if (!ctx.flags.skipLint && !result.ok) {
    return {
      kind: "blocked",
      name: c.name,
      reason: `lint errors: ${result.diagnostics.filter((d) => d.severity === "error").map((d) => d.id).join(", ")}`,
      message: `${GLYPH.blocked} ${c.name} blocked — failed lint (use --skip-lint to override)`,
    };
  }
  // --deny is opt-in: only blocks when the user explicitly asks to exclude a
  // flag. Verification status never blocks — any skill installs (flags are
  // shown on the success line as information, not a gate).
  if (deniedFlags.length) {
    return {
      kind: "blocked",
      name: c.name,
      reason: `denied security flags: ${deniedFlags.join(", ")}`,
      message: `${GLYPH.blocked} ${c.name} blocked — you passed --deny ${deniedFlags.join(", ")}`,
    };
  }

  const source = c.source ?? (c.registrySlug ? `registry:${c.registrySlug}` : provenanceFor(ctx.arg));
  let out: InstallResult;
  try {
    out = await installSkill({
      name: c.name,
      files: c.files ?? [{ path: "SKILL.md", contents: c.raw }],
      source,
      commit_sha: c.commit_sha,
      scope: ctx.scope,
      agents: ctx.targets,
      explicitAgents: Boolean(ctx.flags.agent?.length),
      mode: ctx.flags.mode,
      force: ctx.flags.force,
    });
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    return { kind: "blocked", name: c.name, reason, message: `${GLYPH.blocked} ${c.name} — ${reason}` };
  }

  const notices: Notice[] = [];
  if (out.replaced) notices.push(replacedNotice(`${c.name}: replaced previous install (${out.replaced})`));
  if (c.pinMiss) notices.push(warnNotice(`${c.name}: pinned commit unavailable upstream — fetched the source repo's default branch instead`));
  if (c.note) notices.push(warnNotice(`${c.name}: ${c.note}`));
  if (c.type === "pack" && !c.files) {
    notices.push(warnNotice(`${c.name} is a pack but its asset files could not be fetched — only SKILL.md was installed. It may reference missing files.`));
  }
  // Install counts are a registry-side number, and opting out must be honoured
  // before the request is built, not inside it.
  if (c.registrySlug && !telemetryDisabled(ctx.env)) ctx.deps.fireInstall(c.registrySlug, ctx.flags);

  return {
    kind: "installed",
    doc: { name: c.name, canonical: out.canonical, targets: out.targets, skipped: out.skipped, digest: out.digest },
    score: result.score,
    securityFlags,
    notices,
    source,
    ...(out.replaced ? { replaced: out.replaced } : {}),
  };
}

export async function runAdd(arg: string, flags: AddFlags, deps?: AddDeps): Promise<AddResult> {
  const d = deps ?? makeDefaultDeps(flags);
  const env = flags.env ?? process.env;

  let candidates: AddCandidate[];
  try {
    candidates = await resolveCandidates(arg, flags, d);
  } catch (e) {
    // An integrity failure blocks the install cleanly (never writes the bytes).
    if (e instanceof IntegrityError) {
      return finish(flags, { kind: "fail", error: e.message, blocked: [{ name: arg, reason: e.message }] });
    }
    // In JSON mode the caller gets the failure as the one document it was
    // promised; in human mode the top-level handler is the better printer.
    if (flags.json) return finish(flags, { kind: "fail", error: e instanceof Error ? e.message : String(e) });
    throw e;
  }

  const early = gate(flags, d, candidates);
  if (early) return early;

  const resolved = await resolveScope(flags, d);
  if (!resolved) return finish(flags, { kind: "cancel" });
  const scope = resolved.scope;
  const notices: Notice[] = resolved.note ? [infoNotice(resolved.note)] : [];

  const chosen = await chooseTargets(flags, d, scope, detectAgents(scope));
  if (!chosen) return finish(flags, { kind: "cancel" });
  notices.push(...chosen.notices);

  const ctx: InstallContext = { arg, flags, deny: new Set(flags.deny ?? []), scope, targets: chosen.targets, env, deps: d };
  const records: CandidateRecord[] = [];
  for (const c of candidates) records.push(await installOne(c, ctx));

  const paths: PathCtx = { home: flags.home ?? homedir(), cwd: flags.cwd ?? process.cwd() };
  return finish(flags, { kind: "install", scope: scope.global ? "global" : "project", records, notices, paths });
}

/** `--copy` is the deprecated spelling of `--mode copy`; fold the two together
 *  here so the action body has a single notion of the mode. */
export function addFlags(opts: AddFlags & { copy?: boolean }, parent?: AddFlags): AddFlags {
  const merged: AddFlags = { ...parent, ...opts };
  if (opts.copy) merged.mode = "copy";
  return merged;
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
    .addOption(new Option("--copy", "alias of --mode copy").hideHelp())
    .option("-y, --yes", "skip prompts; scope is auto-detected (project if this folder looks like a project, else global)")
    // deprecated no-op: installs are no longer gated on verification. Kept so
    // older install snippets that pass it don't error.
    .addOption(new Option("--allow-unverified").hideHelp())
    .option("--skip-lint", "install even if the skill fails lint")
    .option("--deny <flags...>", "refuse skills carrying any of these security flags (opt-in)")
    .action(async (source: string, opts: AddFlags & { copy?: boolean }, cmd: Command) => {
      const merged = addFlags(opts, cmd.parent?.opts() as AddFlags | undefined);
      const { run, printed } = await runAddWithUI(source, merged);
      // On the interactive path the document is already inside the clack frame;
      // printing it again here would repeat the whole summary below the box.
      if (!printed) {
        // A failure belongs on stderr: a human piping stdout somewhere still
        // sees why nothing was installed instead of losing it into the pipe.
        if (run.exitCode === 1 && !merged.json) console.error(run.output);
        else console.log(run.output);
      }
      process.exitCode = run.exitCode;
    });
}

/** The slice of clack `runAddWithUI` drives. Injectable so the frame's ORDER —
 *  the thing that decides whether the install document lands inside the box —
 *  is testable without a terminal. */
export interface AddUI {
  intro: (message: string) => void;
  spinner: () => { start: (message?: string) => void; stop: (message?: string) => void };
  message: (message: string) => void;
  outro: (message: string) => void;
  cancel: (message: string) => void;
}

const clackUI: AddUI = {
  intro: (m) => p.intro(m),
  spinner: () => p.spinner(),
  message: (m) => p.log.message(m),
  outro: (m) => p.outro(m),
  cancel: (m) => p.cancel(m),
};

export interface AddUIOptions {
  /** Terminal-drawing calls. Defaults to clack. */
  ui?: AddUI;
  /** Where we're running. Defaults to the real process streams and env. */
  term?: Terminal;
  /** Resolver/telemetry deps. Defaults to the real ones built from `flags`. */
  deps?: AddDeps;
}

/**
 * runAdd() is print-free on purpose — it returns a document. This is the one
 * place that dresses it up: on a real terminal the run is framed by clack
 * (intro, a spinner while the source is resolved, the install document, then an
 * outro that says what to do next). Piped, -y and --json runs get the plain
 * document back with `printed: false` and the caller prints it.
 *
 * `printed` says whether this function already put `run.output` on screen —
 * without it the caller would print the summary a second time, outside the box.
 */
export async function runAddWithUI(
  source: string,
  flags: AddFlags,
  opts: AddUIOptions = {},
): Promise<{ run: AddResult; printed: boolean }> {
  const term: Terminal = opts.term ?? { ...realTerminal(), env: flags.env ?? process.env };
  const base = opts.deps ?? makeDefaultDeps(flags);
  if (!isInteractive(flags, term)) return { run: await runAdd(source, flags, base), printed: false };
  const ui = opts.ui ?? clackUI;
  ui.intro(banner());
  try {
    const run = await runAdd(source, flags, {
      // NOTE: spreading `base` reads makeDefaultDeps()'s promptScope/promptAgents
      // getters right here, freezing their values for this run. That is exactly
      // what we want (interactivity is decided once, up front), but it does mean
      // a getter added to AddDeps later stops being lazy the moment it crosses
      // this spread.
      ...base,
      resolve: async (arg, f) => {
        const s = ui.spinner();
        s.start(`Resolving ${arg}`);
        try {
          const c = await base.resolve(arg, f);
          s.stop(`${c.length} skill${c.length === 1 ? "" : "s"} found`);
          return c;
        } catch (e) {
          s.stop(pc.red("Could not resolve the source"));
          throw e;
        }
      },
    });
    // A cancelled run has nothing to report — close the frame with clack's own
    // cancel bar instead of printing a document that just says "cancelled".
    if (run.cancelled) {
      ui.cancel("Installation cancelled — nothing was installed.");
      return { run, printed: true };
    }
    // The document goes INSIDE the frame, before the outro closes it.
    ui.message(run.output);
    ui.outro(run.exitCode === 0
      ? `Done. Run ${pc.cyan("skillmd list")} to see everything installed.`
      : pc.red("Some skills were not installed."));
    return { run, printed: true };
  } catch (e) {
    // Close the clack frame before the top-level handler prints the message,
    // so the error doesn't land inside a half-drawn box.
    ui.outro(pc.red("Nothing was installed."));
    throw e;
  }
}
