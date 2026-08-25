// Resolve a source argument into one or more SKILL.md documents.
// Supported forms:
//   - local file path to a SKILL.md
//   - local directory (recursively searched for **/SKILL.md)
//   - "owner/repo", "github:owner/repo", or a GitHub URL (fetched via giget)
import { existsSync, statSync, lstatSync, readFileSync, readdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename, dirname, relative, sep } from "node:path";

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

function isLikelyLocal(arg: string): boolean {
  return arg === "." || arg.startsWith("./") || arg.startsWith("../") || arg.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(arg) || existsSync(arg);
}

export async function resolveSource(arg: string): Promise<ResolvedSkill[]> {
  if (isLikelyLocal(arg)) {
    if (!existsSync(arg)) throw new Error(`Path not found: ${arg}`);
    const st = statSync(arg);
    if (st.isFile()) return [loadLocal(arg)];
    const files = findSkillFiles(arg);
    if (files.length === 0) {
      throw new Error(`No SKILL.md found under ${arg}. Point at a skill directory, e.g. "skillmd lint ./my-skill", or run "skillmd init" to create one.`);
    }
    return files.map(loadLocal);
  }

  // Remote: fetch with giget into a temp dir, then search it.
  const { downloadTemplate } = await import("giget");
  const input = normalizeGiget(arg);
  const dir = mkdtempSync(join(tmpdir(), "skillmd-src-"));
  const { dir: out } = await downloadTemplate(input, { dir, forceClean: true });
  const files = findSkillFiles(out);
  if (files.length === 0) throw new Error(`No SKILL.md found in ${arg}`);
  return files.map(loadLocal);
}

export interface TreeFile {
  path: string; // forward-slash, relative to the skill root
  contents: Buffer;
}

// Caps for pack downloads: skills are docs-plus-templates, not datasets. A tree
// past these limits is either the wrong directory or something hostile.
const MAX_PACK_FILES = 200;
const MAX_PACK_BYTES = 20 * 1024 * 1024;

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

/** Download a skill's source directory (giget, pinned to `ref` when given)
 *  and return its full file tree. `sourceUrl` may be a GitHub tree URL with a
 *  subpath, e.g. https://github.com/o/r/tree/main/skills/seo-plan */
export async function resolveTree(sourceUrl: string, ref?: string): Promise<TreeFile[]> {
  const { downloadTemplate } = await import("giget");
  const input = normalizeGiget(sourceUrl) + (ref ? `#${ref}` : "");
  const dir = mkdtempSync(join(tmpdir(), "skillmd-pack-"));
  try {
    const { dir: out } = await downloadTemplate(input, { dir, forceClean: true });
    // collectFiles buffers contents in memory, so the temp dir can go right away.
    return collectFiles(out, out);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function normalizeGiget(arg: string): string {
  // github URL → github:owner/repo[/subpath]
  const m = arg.match(/github\.com\/([^/]+)\/([^/]+)(?:\/tree\/[^/]+\/(.+))?/);
  if (m) return `github:${m[1]}/${m[2]}${m[3] ? "/" + m[3] : ""}`;
  if (arg.startsWith("github:") || arg.startsWith("gh:")) return arg;
  return `github:${arg}`; // owner/repo shorthand
}
