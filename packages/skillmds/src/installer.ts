// src/installer.ts
// One canonical copy per skill (.agents/skills/<name>), a link from every
// agent dir that differs, a lock entry saying where it came from. Writes are
// staged and swapped in so a failure never leaves a half-written skill.
import { createHash } from "node:crypto";
import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { platform } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { AGENTS, agentById, agentDir, agentRootExists, agentSupportsGlobal, canonicalDir } from "./agents.js";
import type { ScopeOptions } from "./agents.js";
import { WINDOWS_RESERVED } from "./limits.js";
import { readLock, removeEntry, upsertEntry } from "./lock.js";
import type { LockEntry } from "./lock.js";

export interface SkillFileInput { path: string; contents: string | Buffer }
export type LinkMode = "junction" | "symlink" | "copy" | "canonical";

export interface InstallRequest {
  name: string;
  files: SkillFileInput[];
  /** sourceId() from sources.ts. */
  source: string;
  commit_sha?: string;
  scope: ScopeOptions;
  agents: string[];
  /** Agents were named with -a: write their dirs even if absent from the project. */
  explicitAgents?: boolean;
  /** "link" (default): junction/symlink with copy fallback; "copy": always copy. */
  mode?: "link" | "copy";
  /** Replace a skill that came from a different source, or an untracked dir. */
  force?: boolean;
  /** Injected for tests: create a link at `linkPath` pointing at `target`. */
  link?: (target: string, linkPath: string) => LinkMode;
}

export interface InstallTarget { agent: string; path: string; mode: LinkMode }
export interface InstallResult {
  canonical: string;
  targets: InstallTarget[];
  skipped: { agent: string; reason: string }[];
  /** Source of the entry that was replaced under --force, if any. */
  replaced?: string;
  digest: string;
}

const NAME_OK = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

export function assertSafeName(name: string): void {
  if (!NAME_OK.test(name) || name.includes("..")) throw new Error(`refused unsafe skill name: "${name}"`);
  if (WINDOWS_RESERVED.test(name)) throw new Error(`refused reserved name "${name}" (not writable on Windows)`);
}

export function digestOf(files: SkillFileInput[]): string {
  const h = createHash("sha256");
  for (const f of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    h.update(f.path).update("\0").update(typeof f.contents === "string" ? Buffer.from(f.contents) : f.contents).update("\0");
  }
  return `sha256:${h.digest("hex")}`;
}

/** Write files into `dest` (must not exist), refusing anything that escapes it. */
function writeTree(dest: string, files: SkillFileInput[]): void {
  mkdirSync(dest, { recursive: true });
  const root = resolve(dest);
  for (const f of files) {
    const fp = resolve(dest, f.path);
    if (fp !== root && !fp.startsWith(root + sep)) throw new Error(`refused unsafe path in skill: ${f.path}`);
    const parts = relative(root, fp).split(sep);
    if (parts.some((p) => WINDOWS_RESERVED.test(p))) throw new Error(`refused reserved file name in skill: ${f.path}`);
    mkdirSync(dirname(fp), { recursive: true });
    writeFileSync(fp, f.contents);
  }
}

/** Default link strategy: junction on Windows (no privilege needed), relative symlink elsewhere. */
export function defaultLink(target: string, linkPath: string): LinkMode {
  mkdirSync(dirname(linkPath), { recursive: true });
  if (platform() === "win32") {
    symlinkSync(resolve(target), linkPath, "junction");
    return "junction";
  }
  symlinkSync(relative(dirname(linkPath), target) || ".", linkPath, "dir");
  return "symlink";
}

function isSkillDirOrLink(p: string): boolean {
  try {
    const st = lstatSync(p);
    return st.isSymbolicLink() || (st.isDirectory() && existsSync(join(p, "SKILL.md")));
  } catch { return false; }
}

/** Remove `p` only if it is a link or a directory that holds a SKILL.md. */
function removeSkillPath(p: string): boolean {
  if (!isSkillDirOrLink(p)) return false;
  rmSync(p, { recursive: true, force: true });
  return true;
}

export async function installSkill(req: InstallRequest): Promise<InstallResult> {
  assertSafeName(req.name);
  const scope = req.scope;
  const cwd = resolve(scope.cwd ?? process.cwd());
  const canonRoot = canonicalDir(scope);
  const canonical = join(canonRoot, req.name);
  const lockScope = { global: Boolean(scope.global), cwd: scope.cwd, home: scope.home };

  // Force gate: a different provenance (or none) must be an explicit decision.
  const lock = readLock(lockScope);
  const prev = lock.skills[req.name];
  let replaced: string | undefined;
  if (prev && prev.source !== req.source) {
    if (!req.force) throw new Error(`"${req.name}" is already installed from ${prev.source}; pass --force to replace it with ${req.source}`);
    replaced = prev.source;
  } else if (!prev && existsSync(canonical)) {
    if (!req.force) throw new Error(`"${req.name}" exists at ${canonical} but is not tracked by skillmd; pass --force to replace it`);
    replaced = "untracked";
  }

  // Stage, verify, swap.
  const staging = `${canonical}.tmp-${process.pid}`;
  rmSync(staging, { recursive: true, force: true });
  try {
    writeTree(staging, req.files);
  } catch (e) {
    rmSync(staging, { recursive: true, force: true });
    throw e;
  }
  rmSync(canonical, { recursive: true, force: true });
  mkdirSync(canonRoot, { recursive: true });
  renameSync(staging, canonical);

  const link = req.link ?? defaultLink;
  const targets: InstallTarget[] = [];
  const skipped: InstallResult["skipped"] = [];
  const modes: LockEntry["mode"] = {};
  const seenDirs = new Map<string, InstallTarget>();   // resolved agent dir → first target written there

  for (const agentId of req.agents) {
    if (scope.global && !agentSupportsGlobal(agentId)) { skipped.push({ agent: agentId, reason: "project-only agent" }); continue; }
    const dir = agentDir(agentId, scope);
    if (resolve(dir) === resolve(canonRoot)) { targets.push({ agent: agentId, path: canonical, mode: "canonical" }); modes[agentId] = "canonical"; continue; }
    if (!scope.global && !req.explicitAgents && !agentRootExists(agentId, cwd)) {
      skipped.push({ agent: agentId, reason: `not present in this project (no ${agentById(agentId).projectRoots[0]}/ dir) — pass -a ${agentId} to add it` });
      continue;
    }
    const first = seenDirs.get(resolve(dir));
    if (first) { targets.push({ agent: agentId, path: first.path, mode: first.mode }); modes[agentId] = first.mode; continue; }
    const linkPath = join(dir, req.name);
    removeSkillPath(linkPath);
    let mode: LinkMode;
    if (req.mode === "copy") {
      mkdirSync(dir, { recursive: true });
      cpSync(canonical, linkPath, { recursive: true });
      mode = "copy";
    } else {
      try {
        mode = link(canonical, linkPath);
      } catch {
        rmSync(linkPath, { recursive: true, force: true });
        mkdirSync(dir, { recursive: true });
        cpSync(canonical, linkPath, { recursive: true });
        mode = "copy";
      }
    }
    const t = { agent: agentId, path: linkPath, mode };
    targets.push(t);
    seenDirs.set(resolve(dir), t);
    modes[agentId] = mode;
  }

  const digest = digestOf(req.files);
  upsertEntry(lockScope, req.name, {
    source: req.source, commit_sha: req.commit_sha, digest, agents: targets.map((t) => t.agent), mode: modes,
  });
  return { canonical, targets, skipped, replaced, digest };
}

export interface UninstallResult { removed: string[]; untracked: boolean }

/** Remove a skill from every agent dir in scope plus the canonical copy and lock entry.
 *  Only paths that are links or hold a SKILL.md are touched. */
export function uninstallSkill(name: string, scope: ScopeOptions): UninstallResult {
  assertSafeName(name);
  const removed: string[] = [];
  const dirs = new Set<string>();
  for (const a of AGENTS) {
    if (scope.global && a.global === null) continue;
    dirs.add(agentDir(a.id, scope));
  }
  for (const d of dirs) {
    const p = join(d, name);
    if (removeSkillPath(p)) removed.push(p);
  }
  const canonical = join(canonicalDir(scope), name);
  if (removeSkillPath(canonical) && !removed.includes(canonical)) removed.push(canonical);
  const hadEntry = removeEntry({ global: Boolean(scope.global), cwd: scope.cwd, home: scope.home }, name);
  return { removed, untracked: !hadEntry };
}

/** Skills visible in one scope: lock entries + untracked dirs found on disk. */
export interface InstalledSkillInfo { name: string; scope: "project" | "global"; path: string; agents: string[]; source?: string; mode: Record<string, LinkMode>; tracked: boolean }

export function listInstalled(scope: ScopeOptions): InstalledSkillInfo[] {
  const lock = readLock({ global: Boolean(scope.global), cwd: scope.cwd, home: scope.home });
  const out = new Map<string, InstalledSkillInfo>();
  const kind = scope.global ? "global" : "project";
  for (const [name, e] of Object.entries(lock.skills)) {
    out.set(name, { name, scope: kind, path: join(canonicalDir(scope), name), agents: [...e.agents], source: e.source, mode: e.mode, tracked: true });
  }
  const seen = new Set<string>();
  for (const a of AGENTS) {
    if (scope.global && a.global === null) continue;
    const dir = agentDir(a.id, scope);
    if (seen.has(dir) || !existsSync(dir)) continue;
    seen.add(dir);
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry);
      if (!existsSync(join(p, "SKILL.md"))) continue;
      const known = out.get(entry);
      if (known) { if (!known.agents.includes(a.id) && lstatSync(p).isSymbolicLink()) known.agents.push(a.id); continue; }
      out.set(entry, { name: entry, scope: kind, path: p, agents: [a.id], mode: { [a.id]: "copy" }, tracked: false });
    }
  }
  return [...out.values()].sort((x, y) => x.name.localeCompare(y.name));
}
