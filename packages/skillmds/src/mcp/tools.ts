// The seven MCP tools: their declarations (what a client sees in tools/list)
// and their runtime (what tools/call does). Everything that talks to the
// registry goes through the ToolContext, so a test can drive every tool
// without a network or a filesystem.
import { lint, skillMdFor } from "@skillmds/core";
import { safeText } from "../sanitize.js";
import { ITEMS, LINT_RESULT, INSTALL_RESULT, OMIT_FIELDS } from "./schemas.js";
import { installFromRegistry } from "./install.js";
import { notice, parseSlug } from "./types.js";
import type { ToolContext, ToolResult } from "./types.js";
import type { RegistrySkill } from "../api.js";

// The shared vocabulary lives in ./types.js so install.ts can import it without
// importing this module back; re-exported here because this is where callers
// (and every existing test) expect to find it.
export { notice, parseSlug };
export type { ToolContext, ToolResult };

export interface ToolDefinition {
  name: string;
  title: string;
  description: string;
  inputSchema: { type: "object"; properties: Record<string, unknown>; required?: string[]; additionalProperties?: boolean };
  outputSchema: unknown;
  annotations: { title: string; readOnlyHint: boolean; destructiveHint: boolean; idempotentHint: boolean; openWorldHint: boolean };
}

export const TOOLS: ReadonlyArray<ToolDefinition> = [
  {
    name: "skillmd_search",
    title: "Search skills",
    description:
      "Search the SkillMD registry of Agent Skills (SKILL.md files) by task, name or keywords. Returns matching skills with their owner/name slug, description, category, safety verdict and install snippet, best match first.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Natural-language query or keywords describing the task or skill" },
        category: { type: "string", description: "Restrict to one category slug, e.g. coding, devops, data, security" },
        verified_only: { type: "boolean", description: "Return only skills from verified publishers (default false)" },
        type: { type: "string", enum: ["single", "pack"], description: "Restrict to single-file skills or multi-file packs" },
        min_rating: { type: "number", minimum: 0, maximum: 5, description: "Minimum average rating, 0 to 5" },
        limit: { type: "integer", minimum: 1, maximum: 100, description: "Maximum number of results (default 20)" },
      },
      required: ["query"],
      additionalProperties: false,
    },
    outputSchema: ITEMS,
    annotations: { title: "Search skills", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "skillmd_get",
    title: "Get skill details",
    description:
      "Fetch one skill by owner/name slug, including its SKILL.md body, provenance (source repo and pinned commit), license, safety verdict and capability flags.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", pattern: "^[^/]+/[^/]+$", description: "Skill identifier as owner/name, e.g. anthropic/pdf" },
      },
      required: ["slug"],
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      description: "Full skill record.",
      properties: {
        slug: { type: "string", description: "owner/name identifier, e.g. anthropic/pdf" },
        title: { type: "string", description: "Human-readable skill title" },
        description: { type: "string", description: "What the skill does and when an agent should use it" },
        category: { type: "string", description: "Category name" },
        category_slug: { type: "string", description: "Category slug, as used by search and trending filters" },
        owner_handle: { type: "string", description: "Publisher handle" },
        owner_name: { type: "string", description: "Publisher display name" },
        license: { type: ["string", "null"], description: "SPDX license id when declared" },
        security_flags: {
          type: "array",
          items: { type: "string" },
          description: "Capability flags: docs_only, network_calls, executes_scripts, reads_secrets, untrusted_install",
        },
        ai_audit_verdict: { type: ["string", "null"], description: "Safety review verdict: pass, caution, warning, fail or inconclusive" },
        repo_stars: { type: ["number", "null"], description: "GitHub stars of the source repository" },
        install_snippet: { type: "string", description: "One-line install command" },
        type: { type: "string", enum: ["single", "pack"], description: "single SKILL.md or a multi-file pack" },
        body_md: { type: "string", description: "Markdown body of SKILL.md" },
        raw_md: { type: ["string", "null"], description: "Verbatim SKILL.md including frontmatter when stored" },
        verified: { type: "boolean", description: "Published by a verified publisher" },
        source_repo: { type: ["string", "null"], description: "Upstream repository" },
        commit_sha: { type: ["string", "null"], description: "Pinned upstream commit" },
        files: { type: "array", description: "Companion files for packs", items: { type: "object", additionalProperties: true } },
        tags: { type: "array", items: { type: "object", additionalProperties: true }, description: "Registry tags" },
        categories: { type: "array", items: { type: "object", additionalProperties: true }, description: "Every category the skill belongs to" },
      },
      required: ["slug", "title", "description"],
      additionalProperties: true,
    },
    annotations: { title: "Get skill details", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "skillmd_install",
    title: "Install skill",
    description:
      "Install a skill by owner/name slug: validates it, then writes one canonical copy (.agents/skills/<name>) and links it into the chosen agents' skill directories. Never executes scripts. The response reports the skill's capability flags (docs_only, network_calls, executes_scripts, reads_secrets) as information.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", pattern: "^[^/]+/[^/]+$", description: "Skill identifier as owner/name, e.g. anthropic/pdf" },
        scope: {
          type: "string",
          enum: ["project", "global"],
          description:
            "project = the current directory's agent folders (default when the cwd looks like a project); global = the user's home-level agent folders",
        },
        agents: {
          type: "array",
          items: { type: "string" },
          description: "Agent ids to link the skill into (default: every agent detected on this machine)",
        },
        mode: { type: "string", enum: ["link", "copy"], description: "link (junction/symlink to the canonical copy, default) or copy" },
        force: { type: "boolean", description: "Replace a skill installed from a different source or an untracked directory" },
        deny: { type: "array", items: { type: "string" }, description: "Refuse the skill if it carries any of these security flags" },
        dest: {
          type: "string",
          description: "Deprecated: an explicit agent skills directory. Must be a known agent skills dir; prefer scope + agents.",
        },
      },
      required: ["slug"],
      additionalProperties: false,
    },
    outputSchema: INSTALL_RESULT,
    annotations: { title: "Install skill", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "skillmd_trending",
    title: "Trending skills",
    description:
      "Top skills on the SkillMD leaderboard, ranked by installs, saves and ratings, optionally within one category and time window.",
    inputSchema: {
      type: "object",
      properties: {
        range: { type: "string", enum: ["30d", "all"], description: "Ranking window: last 30 days or all time (default all)" },
        category: { type: "string", description: "Restrict to one category slug, e.g. coding, devops, data, security" },
        limit: { type: "integer", minimum: 1, maximum: 100, description: "Maximum number of results (default 20)" },
      },
      additionalProperties: false,
    },
    outputSchema: ITEMS,
    annotations: { title: "Trending skills", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "skillmd_recommend",
    title: "Recommend skills",
    description:
      "Recommend skills. With based_on set to a skill's owner/name slug, returns the top skills in that skill's category (excluding itself); without it, returns what is trending over the last 30 days.",
    inputSchema: {
      type: "object",
      properties: {
        based_on: { type: "string", pattern: "^[^/]+/[^/]+$", description: "Skill slug (owner/name) to base recommendations on" },
        limit: { type: "integer", minimum: 1, maximum: 100, description: "Maximum number of results (default 10)" },
      },
      additionalProperties: false,
    },
    outputSchema: ITEMS,
    annotations: { title: "Recommend skills", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "skillmd_list_saved",
    title: "List saved skills",
    description:
      "List the signed-in user's saved skills. Requires the SKILLMD_TOKEN environment variable (a SkillMD personal access token).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    outputSchema: ITEMS,
    annotations: { title: "List saved skills", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "skillmd_lint",
    title: "Lint a SKILL.md",
    description:
      "Validate a SKILL.md against the SkillMD format and return diagnostics, capability flags and a 0-100 quality score. Pass raw SKILL.md content, or a registry slug (owner/name) to fetch and lint that skill.",
    inputSchema: {
      type: "object",
      properties: {
        content: { type: "string", description: "Raw SKILL.md text to validate (frontmatter plus body)" },
        slug: {
          type: "string",
          pattern: "^[^/]+/[^/]+$",
          description: "Registry skill (owner/name) to fetch and validate instead of content",
        },
      },
      additionalProperties: false,
    },
    outputSchema: LINT_RESULT,
    annotations: { title: "Lint a SKILL.md", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
];

/** A result carrying both the human text and the structured payload the tool's
 *  outputSchema describes. Arrays are wrapped as { items } so structuredContent
 *  is always an object, as the spec requires; plain strings are messages only. */
const text = (obj: unknown): ToolResult => {
  if (typeof obj === "string") return { content: [{ type: "text", text: obj }] };
  const structured = (Array.isArray(obj) ? { items: obj } : obj) as Record<string, unknown>;
  return { content: [{ type: "text", text: JSON.stringify(structured, null, 2) }], structuredContent: structured };
};

/** Drop the site-only fields (ratings, counters, avatars, ranker internals) and
 *  strip terminal escapes from every string: registry text is untrusted and
 *  lands in a terminal-rendered transcript. */
const clean = (items: Record<string, unknown>[] | undefined): Record<string, unknown>[] =>
  (items ?? []).map((s) =>
    Object.fromEntries(
      Object.entries(s)
        .filter(([k]) => !OMIT_FIELDS.has(k))
        .map(([k, v]) => [k, typeof v === "string" ? safeText(v, 2000) : v]),
    ),
  );

/** Strip terminal escapes from every string but drop nothing: skillmd_get is
 *  the one tool whose job is the whole record, and the fields the list tools
 *  trim (type, verified, category_slug) are exactly what an agent weighs
 *  before it installs. */
const sanitizeRecord = (skill: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(skill).map(([k, v]) => [k, typeof v === "string" ? safeText(v, 2000) : v]));

export async function handleCall(name: string, args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  try {
    switch (name) {
      case "skillmd_search": {
        const p = new URLSearchParams({ q: String(args.query ?? ""), limit: String(args.limit ?? 20) });
        if (args.category) p.set("category", String(args.category));
        if (args.verified_only) p.set("verified", "true");
        if (args.type) p.set("type", String(args.type));
        if (args.min_rating != null) p.set("min_rating", String(args.min_rating));
        const r = await ctx.api<{ items?: Record<string, unknown>[] }>(`/api/search?${p}`);
        return text(clean(r.items));
      }
      case "skillmd_get": {
        const s = parseSlug(args.slug);
        if (!s) return notice("Provide `slug` as owner/name.");
        const skill = await ctx.api<Record<string, unknown>>(`/api/skills/${s[0]}/${s[1]}`);
        return text(sanitizeRecord(skill));
      }
      case "skillmd_trending": {
        const p = new URLSearchParams({ range: String(args.range ?? "all"), limit: String(args.limit ?? 20) });
        if (args.category) p.set("category", String(args.category));
        const r = await ctx.api<{ items?: Record<string, unknown>[] }>(`/api/leaderboard?${p}`);
        return text(clean(r.items));
      }
      case "skillmd_recommend": {
        const limit = Number(args.limit ?? 10);
        const s = parseSlug(args.based_on);
        if (s) {
          const base = await ctx.api<{ category_slug?: string }>(`/api/skills/${s[0]}/${s[1]}`).catch(() => null);
          if (base?.category_slug) {
            const r = await ctx.api<{ items?: Record<string, unknown>[] }>(
              `/api/leaderboard?range=all&limit=${limit}&category=${encodeURIComponent(base.category_slug)}`,
            );
            return text(clean(r.items).filter((x) => x.slug !== args.based_on));
          }
        }
        const r = await ctx.api<{ items?: Record<string, unknown>[] }>(`/api/leaderboard?range=30d&limit=${limit}`);
        return text(clean(r.items));
      }
      case "skillmd_list_saved": {
        if (!ctx.hasToken) return notice("Set SKILLMD_TOKEN (a SkillMD personal access token) to list your saved skills.");
        const r = await ctx.api<{ items?: Record<string, unknown>[] }>(`/api/favorites`);
        return text(clean(r.items));
      }
      case "skillmd_lint": {
        let raw = typeof args.content === "string" ? args.content : undefined;
        let slug: string | undefined;
        let verified = false;
        if (!raw && args.slug) {
          const s = parseSlug(args.slug);
          if (!s) return notice("Provide `slug` as owner/name.");
          const skill = await ctx.api<RegistrySkill>(`/api/skills/${s[0]}/${s[1]}`);
          raw = skillMdFor(skill);
          slug = s[1];
          verified = Boolean(skill.verified);
        }
        if (!raw) return notice("Provide `content` (raw SKILL.md) or `slug` (owner/name).");
        const result = lint(raw, { ...(slug ? { slug } : {}), verified });
        return text({ ok: result.ok, score: result.score, diagnostics: result.diagnostics, security: result.security });
      }
      case "skillmd_install":
        return await installFromRegistry(args, ctx);
      default:
        return notice(`Unknown tool: ${name}`);
    }
  } catch (e) {
    return notice(e instanceof Error ? e.message : String(e));
  }
}
