// Resolve a source argument into one or more SKILL.md documents.
// The grammar of what a `<source>` may look like lives in ./sources.ts; this
// module turns a parsed spec into files (local walk, gist fetch, or a giget
// download into a temp dir that is always cleaned up).
import { existsSync, statSync, lstatSync, readFileSync, readdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename, dirname, relative, sep } from "node:path";
import { parseSource, gigetInput } from "./sources.js";
import type { SourceSpec } from "./sources.js";
import { FETCH_TIMEOUT_MS, MAX_PACK_BYTES, MAX_PACK_FILES } from "./limits.js";
import { timedFetch } from "./api.js";

export interface ResolvedSkill {
  /** Display label / relative path used in reports. */
  path: string;
  /** Raw SKILL.md contents. */
  raw: string;
  /** Directory name the skill lives under (drives the SK040 slug rule). */
  slug: string;
  /** Absolute path on disk if local (enables --fix). */
  file?: string;
}

const IGNORE_DIRS = new Set([
  // build/dependency dirs
  "node_modules", ".git", "dist", "build", "out", ".next", ".wrangler",
  ".cache", ".npm", ".pnpm-store", ".venv", "venv", "__pycache__", "target", "vendor",
  // large OS / user dirs (mostly relevant when run from a home directory)
  "AppData", "Library", "$Recycle.Bin", "System Volume Information", "Windows", "Program Files",
]);

// Skill trees are shallow; cap recursion so an accidental scan of a huge tree
// (e.g. a home directory) terminates instead of grinding for minutes.
const MAX_DEPTH = 12;

export function findSkillFiles(dir: string, depth = 0): string[] {
  const out: string[] = [];
  if (depth > MAX_DEPTH) return out;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    // Skip directories we can't read (EPERM/EACCES on system folders, ENOENT, etc.)
    return out;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      out.push(...findSkillFiles(join(dir, entry.name), depth + 1));
    } else if (entry.name === "SKILL.md") {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

function loadLocal(file: string): ResolvedSkill {
  return { path: file, raw: readFileSync(file, "utf8"), slug: basename(dirname(file)), file };
}

export interface RemoteOptions { fetch?: typeof fetch }

/** Ask GitHub how big the target subtree is before downloading it. Best-effort:
 *  unauthenticated API limits or a missing ref just skip the check (the
 *  post-download collectFiles caps still apply). */
export async function precheckTreeSize(spec: Extract<SourceSpec, { kind: "github" }>, opts: RemoteOptions = {}): Promise<void> {
  const f = timedFetch(opts.fetch ?? fetch, FETCH_TIMEOUT_MS);
  const ref = spec.ref ?? "HEAD";
  const res = await f(`https://api.github.com/repos/${spec.owner}/${spec.repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`, {
    headers: { accept: "application/vnd.github+json", "user-agent": "skillmd-cli" },
  }).catch(() => null);
  if (!res || !res.ok) return;
  const data = (await res.json().catch(() => null)) as { truncated?: boolean; tree?: { path: string; type: string; size?: number }[] } | null;
  if (!data?.tree || data.truncated) return;
  const prefix = spec.subpath ? `${spec.subpath}/` : "";
  const blobs = data.tree.filter((t) => t.type === "blob" && (!prefix || t.path.startsWith(prefix)));
  const bytes = blobs.reduce((n, t) => n + (t.size ?? 0), 0);
  if (blobs.length > MAX_PACK_FILES) throw new Error(`pack too large: ${blobs.length} files (limit ${MAX_PACK_FILES}) — point at the skill's own directory`);
  if (bytes > MAX_PACK_BYTES) throw new Error(`pack too large: ${Math.round(bytes / (1024 * 1024))}MB (limit ${Math.round(MAX_PACK_BYTES / (1024 * 1024))}MB)`);
}

async function downloadGithub(spec: Extract<SourceSpec, { kind: "github" }>, prefix: string, opts: RemoteOptions): Promise<{ dir: string; cleanup: () => void }> {
  await precheckTreeSize(spec, opts);
  const { downloadTemplate } = await import("giget");
  const tmp = mkdtempSync(join(tmpdir(), prefix));
  const cleanup = () => rmSync(tmp, { recursive: true, force: true });
  try {
    const { dir } = await downloadTemplate(gigetInput(spec), { dir: tmp, forceClean: true });
    return { dir, cleanup };
  } catch (e) {
    cleanup();
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`could not download ${spec.display}: ${msg}${/404|Not Found/i.test(msg) ? " (repo, ref or subpath not found — is it private?)" : ""}`);
  }
}

export async function resolveSource(arg: string, opts: RemoteOptions = {}): Promise<ResolvedSkill[]> {
  const spec = parseSource(arg);
  if (spec.kind === "local") {
    if (!existsSync(spec.path)) throw new Error(`Path not found: ${spec.path}`);
    const st = statSync(spec.path);
    if (st.isFile()) return [loadLocal(spec.path)];
    const files = findSkillFiles(spec.path);
    if (files.length === 0) {
      throw new Error(`No SKILL.md found under ${spec.path}. Point at a skill directory, e.g. "skillmd lint ./my-skill", or run "skillmd init" to create one.`);
    }
    return files.map(loadLocal);
  }
  if (spec.kind === "gist") {
    const f = timedFetch(opts.fetch ?? fetch, FETCH_TIMEOUT_MS);
    const res = await f(`https://gist.githubusercontent.com/${spec.user}/${spec.id}/raw/SKILL.md`);
    if (!res.ok) throw new Error(`gist ${spec.id} has no SKILL.md (HTTP ${res.status})`);
    return [{ path: spec.display, raw: await res.text(), slug: `gist-${spec.id.slice(0, 8)}` }];
  }
  const gh: Extract<SourceSpec, { kind: "github" }> = spec.kind === "slug"
    ? { kind: "github", owner: spec.owner, repo: spec.name, display: spec.display }
    : spec;
  const { dir, cleanup } = await downloadGithub(gh, "skillmd-src-", opts);
  try {
    let files = findSkillFiles(dir);
    if (gh.skill) files = files.filter((f) => basename(dirname(f)) === gh.skill);
    if (files.length === 0) throw new Error(`No SKILL.md found in ${gh.display}${gh.skill ? ` for skill "${gh.skill}"` : ""}`);
    // Contents are read into memory before the temp dir goes away.
    return files.map((f) => ({ ...loadLocal(f), path: relative(dir, f).split(sep).join("/"), file: undefined }));
  } finally {
    cleanup();
  }
}

export interface TreeFile {
  path: string; // forward-slash, relative to the skill root
  contents: Buffer;
}

export interface CollectLimits {
  maxFiles?: number;
  maxBytes?: number;
}

export function collectFiles(root: string, dir: string, limits: CollectLimits = {}): TreeFile[] {
  const maxFiles = limits.maxFiles ?? MAX_PACK_FILES;
  const maxBytes = limits.maxBytes ?? MAX_PACK_BYTES;
  const out: TreeFile[] = [];
  let bytes = 0;
  const walk = (d: string, depth: number): void => {
    if (depth > MAX_DEPTH) return;
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const fp = join(d, entry.name);
      // Don't trust dirent type info: tarballs can smuggle symlink entries, and
      // on Windows dirents can report a symlink as a plain file/dir — following
      // one would read files OUTSIDE the pack root. lstat and skip links outright.
      const st = lstatSync(fp);
      if (st.isSymbolicLink()) continue;
      if (st.isDirectory()) {
        if (entry.name === ".git" || entry.name === "node_modules") continue;
        walk(fp, depth + 1);
      } else if (st.isFile()) {
        if (out.length >= maxFiles) throw new Error(`pack too large: > ${maxFiles} files`);
        bytes += st.size;
        if (bytes > maxBytes) throw new Error(`pack too large: > ${Math.round(maxBytes / (1024 * 1024))}MB`);
        out.push({ path: relative(root, fp).split(sep).join("/"), contents: readFileSync(fp) });
      }
    }
  };
  walk(dir, 0);
  return out;
}

/** Download a skill directory (pinned to `ref` when given) and return its file tree. */
export async function resolveTree(sourceUrl: string, ref?: string, opts: RemoteOptions = {}): Promise<TreeFile[]> {
  const spec = parseSource(sourceUrl, { ref });
  if (spec.kind !== "github" && spec.kind !== "slug") throw new Error(`cannot fetch a tree from ${sourceUrl}`);
  const gh: Extract<SourceSpec, { kind: "github" }> = spec.kind === "slug"
    ? { kind: "github", owner: spec.owner, repo: spec.name, ref, display: sourceUrl }
    : spec;
  const { dir, cleanup } = await downloadGithub(gh, "skillmd-pack-", opts);
  try {
    // collectFiles buffers contents in memory, so the temp dir can go right away.
    return collectFiles(dir, dir);
  } finally {
    cleanup();
  }
}
