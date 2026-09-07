// Registry client. Mirrors the api() helper in bin/skillmd-mcp.mjs, injecting
// the resolved base URL + bearer token.
import { createHash } from "node:crypto";
import { isAllowedSourceUrl } from "@skillmds/core";
import { resolveApi, resolveToken } from "./config.js";
import type { GlobalFlags } from "./config.js";

// SKILL.md materialization + the companion-file SSRF guard live in
// @skillmds/core so the CLI and the MCP server share one implementation.
export { isAllowedSourceUrl, reconstructSkillMd, skillMdFor } from "@skillmds/core";

/** Thrown when a downloaded file's bytes don't match the registry's recorded
 *  sha256. Tagged so the installer can hard-block instead of silently falling
 *  back to an unverified source. */
export class IntegrityError extends Error {
  readonly integrity = true;
  constructor(message: string) {
    super(message);
    this.name = "IntegrityError";
  }
}

/** Thrown when a registry request fails. `status` is set for HTTP error
 *  responses and absent for network-level failures (DNS, connection refused,
 *  proxy CONNECT denial). Callers use it to tell "the skill isn't in the
 *  registry" (404 — falling back to GitHub is correct) apart from "the
 *  registry can't be reached from here" (egress-blocked sandboxes, proxies —
 *  falling back would bury the real cause under a confusing GitHub 404). */
export class RegistryError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "RegistryError";
  }
}

export function createClient(flags: GlobalFlags = {}) {
  const base = resolveApi(flags);
  const token = resolveToken(flags);

  async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = { accept: "application/json", ...(init.headers as Record<string, string> | undefined) };
    if (token) headers.authorization = `Bearer ${token}`;
    let res: Response;
    try {
      res = await fetch(base + path, { ...init, headers });
    } catch (e) {
      const cause = e instanceof Error ? ((e.cause as Error | undefined)?.message ?? e.message) : String(e);
      throw new RegistryError(`could not reach ${base}: ${cause}`);
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new RegistryError(`SkillMD API ${res.status} on ${path}: ${detail}`, res.status);
    }
    return (await res.json()) as T;
  }

  return { api, base, token, hasToken: Boolean(token) };
}

export type Client = ReturnType<typeof createClient>;

export interface BundleFile {
  path: string;
  contents: Buffer;
}

/** Fetch a pack's full file set from the registry bundle (registry-stored, pinned).
 *  Uses ?format=json so no unzip dependency is needed; GitHub-fallback files are
 *  fetched from their pinned raw URL. Returns null if the bundle is unavailable,
 *  letting the caller fall back to a live GitHub fetch. */
export async function fetchBundle(base: string, slug: string, token?: string): Promise<BundleFile[] | null> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${base}/api/skills/${slug}/bundle?format=json`, { headers }).catch(() => null);
  if (!res || !res.ok) return null;
  const data = (await res.json().catch(() => null)) as { files?: { path: string; content_base64?: string; source_url?: string; sha256?: string | null }[] } | null;
  if (!data?.files) return null;
  const out: BundleFile[] = [];
  for (const f of data.files) {
    if (f.content_base64 != null) {
      const contents = Buffer.from(f.content_base64, "base64");
      // Integrity gate: registry-stored files are content-addressed, so the registry
      // reports their sha256. Verify the bytes match before trusting them — a
      // mismatch means the content was substituted in transit or at rest.
      // Files without a sha256 (the reconstructed inline SKILL.md) are skipped.
      if (f.sha256) {
        const got = createHash("sha256").update(contents).digest("hex");
        if (got !== f.sha256) {
          throw new IntegrityError(`integrity check failed for "${f.path}" (expected ${f.sha256.slice(0, 12)}…, got ${got.slice(0, 12)}…)`);
        }
      }
      out.push({ path: f.path, contents });
    } else if (f.source_url && isAllowedSourceUrl(f.source_url)) {
      const r = await fetch(f.source_url).catch(() => null);
      if (r && r.ok) out.push({ path: f.path, contents: Buffer.from(await r.arrayBuffer()) });
    }
  }
  return out;
}

// Mirrors the JSON returned by GET /api/skills/:owner/:name.
export interface RegistrySkill {
  slug: string;
  title: string;
  description: string;
  body_md?: string;
  raw_md?: string | null;
  license?: string | null;
  type?: "single" | "pack";
  verified?: boolean;
  source_repo?: string | null;
  commit_sha?: string | null;
  security_flags?: string[];
}
