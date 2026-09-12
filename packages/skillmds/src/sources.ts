// One place that decides what a `<source>` argument means. Everything the
// installer accepts is enumerated here and table-tested; add.ts, update.ts and
// the MCP server all call parseSource() instead of guessing with regexes.
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type SourceSpec =
  | { kind: "local"; path: string; display: string }
  | { kind: "slug"; owner: string; name: string; display: string }
  | { kind: "github"; owner: string; repo: string; ref?: string; subpath?: string; skill?: string; display: string }
  | { kind: "gist"; user: string; id: string; display: string };

export interface ParseOptions {
  /** Override/force the git ref (CLI --ref). */
  ref?: string;
  /** Injected for tests; defaults to fs.existsSync. */
  exists?: (p: string) => boolean;
}

const UNSUPPORTED = (what: string): Error =>
  new Error(`${what} sources are not supported yet — clone it locally and run \`skillmd add ./path/to/skill\`.`);

function assertSubpath(sub: string | undefined): string | undefined {
  if (!sub) return undefined;
  const clean = sub.replace(/^\/+|\/+$/g, "");
  if (!clean) return undefined;
  if (clean.split("/").some((seg) => seg === ".." || seg === "." || seg === "")) {
    throw new Error(`invalid subpath "${sub}": ".." and empty segments are not allowed`);
  }
  return clean;
}

function withRef<T extends { ref?: string }>(spec: T, override?: string): T {
  return override ? { ...spec, ref: override } : spec;
}

export function parseSource(arg: string, opts: ParseOptions = {}): SourceSpec {
  const exists = opts.exists ?? existsSync;
  const a = arg.trim();
  if (!a) throw new Error("a source is required: owner/name, a GitHub URL, or a local path");

  // 1. local paths
  // An existing local path always wins over the remote grammar — a dir named `owner/` shadows the slug `owner/name`; deliberate, matches every package manager.
  // `~` is expanded here because the shell only does it for unquoted arguments.
  if (a === "~" || a.startsWith("~/") || a.startsWith("~\\")) {
    // a.slice(1) keeps the leading separator, and join() normalises it away.
    return { kind: "local", path: join(homedir(), a.slice(1)), display: a };
  }
  if (a === "." || a.startsWith("./") || a.startsWith("../") || a.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(a) || a.startsWith("~") || exists(a)) {
    return { kind: "local", path: a, display: a };
  }

  // 2. explicit unsupported transports/hosts
  if (/^git@|^ssh:\/\//.test(a)) throw UNSUPPORTED("SSH git");
  if (/gitlab\.com\//i.test(a) || a.startsWith("gitlab:")) throw UNSUPPORTED("GitLab");

  // 3. gist
  const gist = a.match(/^https?:\/\/gist\.github\.com\/([^/]+)\/([0-9a-f]+)\/?$/i);
  if (gist) return { kind: "gist", user: gist[1]!, id: gist[2]!, display: a };

  // 4. GitHub URLs
  // Limitation: a ref containing "/" (e.g. `tree/release/1.2/skills/x`) cannot be
  // split from the subpath without an API call, so the first segment after
  // tree|blob is taken as the ref and the rest as the subpath.
  const gh = a.match(/^https?:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/#?]+?)(?:\.git)?(?:\/(tree|blob)\/([^/]+)(?:\/(.*?))?)?\/?(?:[#?].*)?$/i);
  if (gh) {
    const [, owner, repo, mode, ref, rest] = gh;
    let sub = rest;
    if (mode === "blob" && sub) sub = sub.replace(/\/?SKILL\.md$/i, "");
    return withRef({ kind: "github" as const, owner: owner!, repo: repo!, ref: ref || undefined, subpath: assertSubpath(sub), display: a }, opts.ref);
  }
  if (/^https?:\/\//.test(a)) throw new Error(`"${a}" is not a supported source (registry slug, GitHub repo/tree/blob URL, gist, or local path)`);

  // 5. github:/gh: prefixes and shorthand
  const body = a.replace(/^(github|gh):/, "");
  const prefixed = body !== a;
  // The @skill segment names one directory, so it can never contain "/".
  const m = body.match(/^([^/#@\s]+)\/([^/#@\s]+)((?:\/[^#@\s]+)*)?(?:#([^@\s]+))?(?:@([^/\s]+))?$/);
  if (!m) throw new Error(`"${a}" is not a valid source — expected owner/name, owner/repo[/sub/path][#ref][@skill], a GitHub URL, or a local path`);
  const [, owner, repoRaw, subRaw, ref, skill] = m;
  // `owner/repo.git` names the same repo as `owner/repo`, slug branch included.
  const repo = repoRaw!.replace(/\.git$/, "");
  const subpath = assertSubpath(subRaw);
  // Bare owner/name with nothing else is a registry slug first (GitHub is the fallback in add.ts).
  if (!prefixed && !subpath && !ref && !skill && !opts.ref) return { kind: "slug", owner: owner!, name: repo, display: a };
  return withRef({ kind: "github" as const, owner: owner!, repo, ref: ref || undefined, subpath, skill: skill || undefined, display: a }, opts.ref);
}

/** giget template string for a GitHub spec. */
export function gigetInput(spec: Extract<SourceSpec, { kind: "github" }>): string {
  return `github:${spec.owner}/${spec.repo}${spec.subpath ? `/${spec.subpath}` : ""}${spec.ref ? `#${spec.ref}` : ""}`;
}

/** Stable identifier written to the lock file. */
export function sourceId(spec: SourceSpec): string {
  switch (spec.kind) {
    case "slug": return `registry:${spec.owner}/${spec.name}`;
    case "github": return `github:${spec.owner}/${spec.repo}${spec.subpath ? `/${spec.subpath}` : ""}${spec.ref ? `#${spec.ref}` : ""}${spec.skill ? `@${spec.skill}` : ""}`;
    case "gist": return `gist:${spec.user}/${spec.id}`;
    case "local": return `local:${spec.path}`;
  }
}
