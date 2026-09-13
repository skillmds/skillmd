// JSON Schema fragments shared by every MCP tool. Written once here so the
// seven tools cannot drift apart: search, trending, recommend and list_saved
// all describe the same item shape, and lint/install each have exactly one
// result schema.

/** One skill as returned by any list-shaped tool. `additionalProperties` stays
 *  open: the registry adds fields faster than this schema is revised, and an
 *  agent reading an unexpected field is better than one that cannot see it. */
export const SKILL_ITEM = {
  type: "object",
  description: "A skill as listed in search and leaderboard results.",
  properties: {
    slug: { type: "string", description: "owner/name identifier, e.g. anthropic/pdf" },
    title: { type: "string", description: "Human-readable skill title" },
    description: { type: "string", description: "What the skill does and when an agent should use it" },
    category: { type: ["string", "null"], description: "Category name" },
    agents: { type: "array", items: { type: "string" }, description: "Agent ids the skill is published for" },
    owner_handle: { type: "string", description: "Publisher handle" },
    owner_name: { type: "string", description: "Publisher display name" },
    license: { type: ["string", "null"], description: "SPDX license id when declared" },
    repo_stars: { type: ["number", "null"], description: "GitHub stars of the source repository" },
    ai_audit_verdict: {
      type: ["string", "null"],
      description: "Safety review verdict: pass, caution, warning, fail or inconclusive",
    },
    verdict: { type: ["string", "null"], description: "Safety verdict from the registry's audits" },
    security_flags: {
      type: "array",
      items: { type: "string" },
      description: "Capability flags: docs_only, network_calls, executes_scripts, reads_secrets, untrusted_install",
    },
    install_snippet: { type: "string", description: "One-line install command" },
    install: { type: "object", additionalProperties: true, description: "Install snippets (cli, mcp)" },
  },
  // Only `slug` is guaranteed. Requiring title/description would make a client
  // that validates structuredContent reject a sparse row the registry is
  // entitled to return — and an agent can still act on a slug alone.
  required: ["slug"],
  additionalProperties: true,
} as const;

/** Arrays are wrapped as { items } so structuredContent is always an object,
 *  as the MCP spec requires. */
export const ITEMS = {
  type: "object",
  properties: { items: { type: "array", items: SKILL_ITEM, description: "Matching skills, best first" } },
  required: ["items"],
} as const;

// Severity mirrors @skillmds/core's Severity ("error" | "warn" | "info").
export const LINT_RESULT = {
  type: "object",
  properties: {
    ok: { type: "boolean", description: "True when there are no error-level diagnostics" },
    score: { type: "integer", description: "Quality score 0-100" },
    diagnostics: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "Rule id, e.g. SK011" },
          severity: { type: "string", enum: ["error", "warn", "info"] },
          message: { type: "string" },
          line: { type: ["integer", "null"] },
        },
        required: ["id", "severity", "message"],
        additionalProperties: true,
      },
    },
    security: { type: "object", additionalProperties: true, description: "Scanner findings and capability flags" },
  },
  required: ["ok", "score", "diagnostics"],
} as const;

export const INSTALL_RESULT = {
  type: "object",
  properties: {
    installed: { type: "boolean", description: "Whether files were written" },
    slug: { type: "string", description: "owner/name of the skill" },
    scope: { type: "string", enum: ["project", "global"], description: "Which set of agent folders was written" },
    canonical: { type: "string", description: "Absolute path of the canonical copy every target links to" },
    targets: {
      type: "array",
      description: "Agent skill dirs the canonical copy was linked or copied into; empty when only the canonical copy was written",
      items: {
        type: "object",
        properties: { agent: { type: "string" }, path: { type: "string" }, mode: { type: "string" } },
        required: ["agent", "path", "mode"],
      },
    },
    skipped: {
      type: "array",
      description: "Agents that were not written, with the reason",
      items: {
        type: "object",
        properties: { agent: { type: "string" }, reason: { type: "string" } },
        required: ["agent", "reason"],
      },
    },
    files_written: { type: "integer", description: "Number of files written" },
    security_flags: { type: "array", items: { type: "string" }, description: "Capability flags reported for the skill" },
    note: { type: "string", description: "Caveats, e.g. when only SKILL.md could be written" },
  },
  required: ["installed", "slug", "scope", "canonical", "targets", "files_written"],
} as const;

/** The public API returns site-oriented fields (ratings, counters, avatars,
 *  ranker internals) that are noise for an agent scanning a *list* of skills.
 *  Strip them from the list-shaped tools so a page of results stays compact.
 *  skillmd_get is deliberately exempt: its whole job is the full record. */
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
