// JSON Schema fragments shared by every MCP tool. Written once here so the
// seven tools cannot drift apart: search, trending, recommend and list_saved
// all describe the same item shape, and lint/install each have exactly one
// result schema.

/** One skill as returned by any list-shaped tool. `additionalProperties` stays
 *  open: the registry adds fields faster than this schema is revised, and an
 *  agent reading an unexpected field is better than one that cannot see it. */
export const SKILL_ITEM = {
  type: "object",
  properties: {
    slug: { type: "string", description: "owner/name" },
    title: { type: "string" },
    description: { type: "string" },
    category: { type: ["string", "null"] },
    agents: { type: "array", items: { type: "string" } },
    repo_stars: { type: ["integer", "null"] },
    verdict: { type: ["string", "null"], description: "Safety verdict from the registry's audits" },
    security_flags: { type: "array", items: { type: "string" } },
    install: { type: "object", additionalProperties: true, description: "Install snippets (cli, mcp)" },
  },
  required: ["slug", "title", "description"],
  additionalProperties: true,
} as const;

/** Arrays are wrapped as { items } so structuredContent is always an object,
 *  as the MCP spec requires. */
export const ITEMS = {
  type: "object",
  properties: { items: { type: "array", items: SKILL_ITEM } },
  required: ["items"],
} as const;

// Severity mirrors @skillmds/core's Severity ("error" | "warn" | "info").
export const LINT_RESULT = {
  type: "object",
  properties: {
    ok: { type: "boolean" },
    score: { type: "integer" },
    diagnostics: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          severity: { type: "string", enum: ["error", "warn", "info"] },
          message: { type: "string" },
          line: { type: ["integer", "null"] },
        },
        required: ["id", "severity", "message"],
        additionalProperties: true,
      },
    },
    security: { type: "object", additionalProperties: true },
  },
  required: ["ok", "score", "diagnostics"],
} as const;

export const INSTALL_RESULT = {
  type: "object",
  properties: {
    installed: { type: "boolean" },
    slug: { type: "string" },
    scope: { type: "string", enum: ["project", "global"] },
    canonical: { type: "string" },
    targets: {
      type: "array",
      items: {
        type: "object",
        properties: { agent: { type: "string" }, path: { type: "string" }, mode: { type: "string" } },
        required: ["agent", "path", "mode"],
      },
    },
    skipped: {
      type: "array",
      items: {
        type: "object",
        properties: { agent: { type: "string" }, reason: { type: "string" } },
        required: ["agent", "reason"],
      },
    },
    files_written: { type: "integer" },
    security_flags: { type: "array", items: { type: "string" } },
    note: { type: "string" },
  },
  required: ["installed", "slug", "scope", "canonical", "targets", "files_written"],
} as const;

/** The public API returns site-oriented fields (ratings, counters, avatars,
 *  ranker internals) that are noise for an agent picking a skill. Strip them
 *  from every tool result so what reaches the model is only what it can act on. */
export const OMIT_FIELDS = new Set([
  "type",
  "verified",
  "avg_rating",
  "rating_count",
  "install_count",
  "save_count",
  "owner_avatar",
  "confident",
  "category_slug",
]);
