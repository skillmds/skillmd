// src/lock.ts
// Where did each installed skill come from? Two lock files answer that:
//   project  <root>/skills-lock.json    committed with the project; sorted, no timestamps
//   global   ~/.skillmd/lock.json       one per machine; timestamps allowed
// list/update/check/remove read them; add writes them. Skills on disk that are
// not in a lock are "untracked" (installed by 1.1.x or by hand) and are never
// auto-updated.
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, renameSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export interface LockEntry {
  /** From sources.ts sourceId(): "registry:o/n" | "github:o/r#ref/sub@skill" | "gist:u/id" | "local:/abs" */
  source: string;
  commit_sha?: string;
  /** sha256 over the sorted (path + contents) of the installed files. */
  digest?: string;
  agents: string[];
  /** Per-agent link mode actually used. */
  mode: Record<string, "junction" | "symlink" | "copy" | "canonical">;
  installedAt?: string;
  updatedAt?: string;
}

export interface LockFile { version: 1; skills: Record<string, LockEntry> }

export interface LockScope { global: boolean; cwd?: string; home?: string }

export function lockPath(scope: LockScope): string {
  return scope.global
    ? join(scope.home ?? homedir(), ".skillmd", "lock.json")
    : join(scope.cwd ?? process.cwd(), "skills-lock.json");
}

const EMPTY = (): LockFile => ({ version: 1, skills: {} });
const corruptSeen = new Set<string>();

export function readLock(scope: LockScope, opts: { warn?: (msg: string) => void } = {}): LockFile {
  const file = lockPath(scope);
  if (!existsSync(file)) return EMPTY();
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as Partial<LockFile>;
    if (!parsed || typeof parsed !== "object" || typeof parsed.skills !== "object" || parsed.skills === null) throw new Error("unexpected shape");
    return { version: 1, skills: parsed.skills as Record<string, LockEntry> };
  } catch (e) {
    corruptSeen.add(file);
    opts.warn?.(`could not parse ${file} (${e instanceof Error ? e.message : String(e)}) — treating it as empty; a backup is written before it is next rewritten`);
    return EMPTY();
  }
}

function stripTimestamps(e: LockEntry): LockEntry {
  const rest = { ...e };
  delete rest.installedAt;
  delete rest.updatedAt;
  return rest;
}

export function writeLock(scope: LockScope, lock: LockFile): void {
  const file = lockPath(scope);
  mkdirSync(dirname(file), { recursive: true });
  if (corruptSeen.has(file) && existsSync(file)) {
    copyFileSync(file, `${file}.bak`);
    corruptSeen.delete(file);
  }
  const names = Object.keys(lock.skills).sort();
  const skills: Record<string, LockEntry> = {};
  for (const n of names) skills[n] = scope.global ? lock.skills[n]! : stripTimestamps(lock.skills[n]!);
  const tmp = `${file}.tmp-${process.pid}`;
  writeFileSync(tmp, `${JSON.stringify({ version: 1, skills }, null, 2)}\n`, "utf8");
  try {
    renameSync(tmp, file);
  } catch {
    // Windows can refuse a rename over an existing file (EPERM) when it is held open.
    rmSync(file, { force: true });
    renameSync(tmp, file);
  }
}

export function upsertEntry(scope: LockScope, name: string, entry: LockEntry): void {
  const lock = readLock(scope);
  const prev = lock.skills[name];
  const now = new Date().toISOString();
  lock.skills[name] = { ...entry, installedAt: entry.installedAt ?? prev?.installedAt ?? now, updatedAt: prev ? now : (entry.updatedAt ?? now) };
  writeLock(scope, lock);
}

export function removeEntry(scope: LockScope, name: string): boolean {
  const lock = readLock(scope);
  if (!(name in lock.skills)) return false;
  delete lock.skills[name];
  writeLock(scope, lock);
  return true;
}
