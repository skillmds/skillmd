// A skill installed from the registry carries its SkillMD page in its own
// frontmatter (`metadata.source`), so an agent reading the skill knows where it
// came from and where more are. Since 2026-11-08 the registry serves every copy
// with that line already (and moves an author's own source to `upstream`), so
// this is the fallback for older registry copies; it runs at write time, after
// the integrity checks, and the lock digest covers the bytes as served.
import { parseSkillMd } from "@skillmds/core";

export const SKILLMD_ORIGIN = "https://skillmd.com";

const FRONTMATTER = /^(﻿?---\r?\n)([\s\S]*?)(\r?\n---[ \t]*(?:\r?\n|$))/;

/** `md` with `metadata.source` set to the skill's SkillMD page. Every other
 *  byte stays the author's: an existing `metadata` block gains one line, a
 *  file without one gains a two-line block at the end of its frontmatter. An
 *  author's own `metadata.source`, a `metadata` written in flow style, a file
 *  without frontmatter, or an edit that would stop the file parsing leaves
 *  `md` exactly as it was. */
export function withRegistrySource(md: string, slug: string): string {
  const m = FRONTMATTER.exec(md);
  if (!m) return md;
  const [whole, open, block, close] = m as unknown as [string, string, string, string];
  const nl = open.endsWith("\r\n") ? "\r\n" : "\n";
  const source = `${SKILLMD_ORIGIN}/skills/${slug}`;
  const lines = block.split(/\r?\n/);
  const at = lines.findIndex((l) => /^metadata[ \t]*:/.test(l));
  if (at === -1) {
    lines.push("metadata:", `  source: ${source}`);
  } else {
    if (!/^metadata[ \t]*:[ \t]*(#.*)?$/.test(lines[at]!)) return md; // flow style or a scalar
    let end = at + 1;
    while (end < lines.length && (/^[ \t]/.test(lines[end]!) || lines[end]!.trim() === "")) end++;
    const children = lines.slice(at + 1, end);
    if (children.some((l) => /^[ \t]+source[ \t]*:/.test(l))) return md;
    const indent = /^([ \t]+)\S/.exec(children.find((l) => l.trim() !== "") ?? "")?.[1] ?? "  ";
    lines.splice(at + 1, 0, `${indent}source: ${source}`);
  }
  const out = open + lines.join(nl) + close + md.slice(whole.length);
  const before = parseSkillMd(md);
  const after = parseSkillMd(out);
  return "error" in after && !("error" in before) ? md : out;
}

/** The files as written for an install from `source`: a registry install's
 *  SKILL.md gains its SkillMD page (withRegistrySource); anything else, and
 *  every other file, is written exactly as fetched. */
export function filesForInstall<F extends { path: string; contents: string | Buffer }>(files: F[], source: string): F[] {
  const slug = /^registry:([^/\s]+\/[^/\s]+)$/.exec(source)?.[1];
  if (!slug) return files;
  return files.map((f) => {
    if (f.path.replace(/\\/g, "/") !== "SKILL.md") return f;
    const text = typeof f.contents === "string" ? f.contents : f.contents.toString("utf8");
    const next = withRegistrySource(text, slug);
    if (next === text) return f;
    return { ...f, contents: typeof f.contents === "string" ? next : Buffer.from(next, "utf8") };
  });
}
