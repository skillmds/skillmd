#!/usr/bin/env node
// SkillMD MCP server (stdio). Wraps the public SkillMD API so any MCP-capable agent
// can search, fetch, install, and discover Agent Skills by name or task.
//
//   claude mcp add skillmd -- npx -y skillmds
//
// Env:
//   SKILLMD_API   override API base (default https://api.skillmd.com)
//   SKILLMD_TOKEN  personal access token (enables skillmd_list_saved / personalized recommend)

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join, resolve, dirname, sep } from "node:path";

const VERSION = (() => {
  try {
    return JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
  } catch {
    return "0.0.0";
  }
})();
// Shared validation engine + registry helpers from @skillmds/core (a runtime
// dependency of this package). Falls back gracefully when running from an
// unbuilt source checkout.
let lint = null;
let skillMdFor = null;
let isAllowedSourceUrl = () => false;
try {
  ({ lint, skillMdFor, isAllowedSourceUrl } = await import("@skillmds/core"));
} catch {
  /* skillmd_lint / skillmd_install will report that the engine is unavailable */
}

const API = process.env.SKILLMD_API || "https://api.skillmd.com";
const TOKEN = process.env.SKILLMD_TOKEN || "";

async function api(path, init = {}) {
  const headers = { accept: "application/json", ...(init.headers || {}) };
  if (TOKEN) headers.authorization = `Bearer ${TOKEN}`;
  const res = await fetch(API + path, { ...init, headers });
  if (!res.ok) throw new Error(`SkillMD API ${res.status} on ${path}: ${await res.text().catch(() => "")}`);
  return res.json();
}
// Tool results carry both a text rendering and structuredContent matching the
// tool's outputSchema. Arrays are wrapped as { items } so the structured payload
// is always an object, as the spec requires. Plain strings are messages only.
const text = (obj) => {
  if (typeof obj === "string") return { content: [{ type: "text", text: obj }] };
  const structured = Array.isArray(obj) ? { items: obj } : obj;
  return { content: [{ type: "text", text: JSON.stringify(structured, null, 2) }], structuredContent: structured };
};
// A human-readable refusal/notice: text only, flagged as an error so clients do
// not expect structuredContent for it.
const notice = (msg) => ({ isError: true, content: [{ type: "text", text: msg }] });

// The public API returns site-oriented fields (ratings, counters, avatars,
// ranker internals) that are noise for an agent picking a skill. Strip them
// from every list-returning tool so results stay compact and rankable only
// on what matters to the caller.
const OMIT_FIELDS = new Set([
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
const trimItems = (items) => (items ?? []).map((s) => Object.fromEntries(Object.entries(s).filter(([k]) => !OMIT_FIELDS.has(k))));

const TOOLS = [
  {
    "name": "skillmd_search",
    "title": "Search skills",
    "description": "Search the SkillMD registry of Agent Skills (SKILL.md files) by task, name or keywords. Returns matching skills with their owner/name slug, description, category, safety verdict and install snippet, best match first.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "description": "Natural-language query or keywords describing the task or skill"
        },
        "category": {
          "type": "string",
          "description": "Restrict to one category slug, e.g. coding, devops, data, security"
        },
        "verified_only": {
          "type": "boolean",
          "description": "Return only skills from verified publishers (default false)"
        },
        "type": {
          "type": "string",
          "enum": [
            "single",
            "pack"
          ],
          "description": "Restrict to single-file skills or multi-file packs"
        },
        "min_rating": {
          "type": "number",
          "minimum": 0,
          "maximum": 5,
          "description": "Minimum average rating, 0 to 5"
        },
        "limit": {
          "type": "integer",
          "minimum": 1,
          "maximum": 100,
          "description": "Maximum number of results (default 20)"
        }
      },
      "required": [
        "query"
      ],
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "items": {
          "type": "array",
          "items": {
            "type": "object",
            "description": "A skill as listed in search and leaderboard results.",
            "properties": {
              "slug": {
                "type": "string",
                "description": "owner/name identifier, e.g. anthropic/pdf"
              },
              "title": {
                "type": "string",
                "description": "Human-readable skill title"
              },
              "description": {
                "type": "string",
                "description": "What the skill does and when an agent should use it"
              },
              "category": {
                "type": "string",
                "description": "Category name"
              },
              "owner_handle": {
                "type": "string",
                "description": "Publisher handle"
              },
              "owner_name": {
                "type": "string",
                "description": "Publisher display name"
              },
              "license": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "SPDX license id when declared"
              },
              "security_flags": {
                "type": "array",
                "items": {
                  "type": "string"
                },
                "description": "Capability flags: docs_only, network_calls, executes_scripts, reads_secrets, untrusted_install"
              },
              "ai_audit_verdict": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "Safety review verdict: pass, caution, warning, fail or inconclusive"
              },
              "repo_stars": {
                "type": [
                  "number",
                  "null"
                ],
                "description": "GitHub stars of the source repository"
              },
              "install_snippet": {
                "type": "string",
                "description": "One-line install command"
              }
            },
            "required": [
              "slug"
            ],
            "additionalProperties": true
          },
          "description": "Matching skills, best first"
        }
      },
      "required": [
        "items"
      ]
    },
    "annotations": {
      "title": "Search skills",
      "readOnlyHint": true,
      "destructiveHint": false,
      "idempotentHint": true,
      "openWorldHint": false
    }
  },
  {
    "name": "skillmd_get",
    "title": "Get skill details",
    "description": "Fetch one skill by owner/name slug, including its SKILL.md body, provenance (source repo and pinned commit), license, safety verdict and capability flags.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "slug": {
          "type": "string",
          "pattern": "^[^/]+/[^/]+$",
          "description": "Skill identifier as owner/name, e.g. anthropic/pdf"
        }
      },
      "required": [
        "slug"
      ],
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "description": "Full skill record.",
      "properties": {
        "slug": {
          "type": "string",
          "description": "owner/name identifier, e.g. anthropic/pdf"
        },
        "title": {
          "type": "string",
          "description": "Human-readable skill title"
        },
        "description": {
          "type": "string",
          "description": "What the skill does and when an agent should use it"
        },
        "category": {
          "type": "string",
          "description": "Category name"
        },
        "owner_handle": {
          "type": "string",
          "description": "Publisher handle"
        },
        "owner_name": {
          "type": "string",
          "description": "Publisher display name"
        },
        "license": {
          "type": [
            "string",
            "null"
          ],
          "description": "SPDX license id when declared"
        },
        "security_flags": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Capability flags: docs_only, network_calls, executes_scripts, reads_secrets, untrusted_install"
        },
        "ai_audit_verdict": {
          "type": [
            "string",
            "null"
          ],
          "description": "Safety review verdict: pass, caution, warning, fail or inconclusive"
        },
        "repo_stars": {
          "type": [
            "number",
            "null"
          ],
          "description": "GitHub stars of the source repository"
        },
        "install_snippet": {
          "type": "string",
          "description": "One-line install command"
        },
        "type": {
          "type": "string",
          "enum": [
            "single",
            "pack"
          ],
          "description": "single SKILL.md or a multi-file pack"
        },
        "body_md": {
          "type": "string",
          "description": "Markdown body of SKILL.md"
        },
        "raw_md": {
          "type": [
            "string",
            "null"
          ],
          "description": "Verbatim SKILL.md including frontmatter when stored"
        },
        "verified": {
          "type": "boolean",
          "description": "Published by a verified publisher"
        },
        "source_repo": {
          "type": [
            "string",
            "null"
          ],
          "description": "Upstream repository"
        },
        "commit_sha": {
          "type": [
            "string",
            "null"
          ],
          "description": "Pinned upstream commit"
        },
        "files": {
          "type": "array",
          "description": "Companion files for packs",
          "items": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "tags": {
          "type": "array",
          "items": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "categories": {
          "type": "array",
          "items": {
            "type": "object",
            "additionalProperties": true
          }
        }
      },
      "required": [
        "slug",
        "title",
        "description"
      ],
      "additionalProperties": true
    },
    "annotations": {
      "title": "Get skill details",
      "readOnlyHint": true,
      "destructiveHint": false,
      "idempotentHint": true,
      "openWorldHint": false
    }
  },
  {
    "name": "skillmd_install",
    "title": "Install skill",
    "description": "Install a skill by owner/name slug: validates it, then writes SKILL.md (and companion files for packs, integrity-checked) into the agent's skills directory. Never executes scripts. The response reports the skill's capability flags (docs_only, network_calls, executes_scripts, reads_secrets) as information.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "slug": {
          "type": "string",
          "pattern": "^[^/]+/[^/]+$",
          "description": "Skill identifier as owner/name, e.g. anthropic/pdf"
        },
        "dest": {
          "type": "string",
          "description": "Skills directory to write into (default ~/.claude/skills)"
        }
      },
      "required": [
        "slug"
      ],
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "installed": {
          "type": "boolean",
          "description": "Whether files were written"
        },
        "slug": {
          "type": "string",
          "description": "owner/name of the skill"
        },
        "dir": {
          "type": "string",
          "description": "Absolute directory the skill was written to"
        },
        "files_written": {
          "type": "integer",
          "description": "Number of files written"
        },
        "security_flags": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Capability flags reported for the skill"
        },
        "note": {
          "type": "string",
          "description": "Caveats, e.g. when only SKILL.md could be written"
        }
      },
      "required": [
        "installed",
        "slug"
      ]
    },
    "annotations": {
      "title": "Install skill",
      "readOnlyHint": false,
      "destructiveHint": false,
      "idempotentHint": true,
      "openWorldHint": false
    }
  },
  {
    "name": "skillmd_trending",
    "title": "Trending skills",
    "description": "Top skills on the SkillMD leaderboard, ranked by installs, saves and ratings, optionally within one category and time window.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "range": {
          "type": "string",
          "enum": [
            "30d",
            "all"
          ],
          "description": "Ranking window: last 30 days or all time (default all)"
        },
        "category": {
          "type": "string",
          "description": "Restrict to one category slug, e.g. coding, devops, data, security"
        },
        "limit": {
          "type": "integer",
          "minimum": 1,
          "maximum": 100,
          "description": "Maximum number of results (default 20)"
        }
      },
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "items": {
          "type": "array",
          "items": {
            "type": "object",
            "description": "A skill as listed in search and leaderboard results.",
            "properties": {
              "slug": {
                "type": "string",
                "description": "owner/name identifier, e.g. anthropic/pdf"
              },
              "title": {
                "type": "string",
                "description": "Human-readable skill title"
              },
              "description": {
                "type": "string",
                "description": "What the skill does and when an agent should use it"
              },
              "category": {
                "type": "string",
                "description": "Category name"
              },
              "owner_handle": {
                "type": "string",
                "description": "Publisher handle"
              },
              "owner_name": {
                "type": "string",
                "description": "Publisher display name"
              },
              "license": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "SPDX license id when declared"
              },
              "security_flags": {
                "type": "array",
                "items": {
                  "type": "string"
                },
                "description": "Capability flags: docs_only, network_calls, executes_scripts, reads_secrets, untrusted_install"
              },
              "ai_audit_verdict": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "Safety review verdict: pass, caution, warning, fail or inconclusive"
              },
              "repo_stars": {
                "type": [
                  "number",
                  "null"
                ],
                "description": "GitHub stars of the source repository"
              },
              "install_snippet": {
                "type": "string",
                "description": "One-line install command"
              }
            },
            "required": [
              "slug"
            ],
            "additionalProperties": true
          },
          "description": "Matching skills, best first"
        }
      },
      "required": [
        "items"
      ]
    },
    "annotations": {
      "title": "Trending skills",
      "readOnlyHint": true,
      "destructiveHint": false,
      "idempotentHint": true,
      "openWorldHint": false
    }
  },
  {
    "name": "skillmd_recommend",
    "title": "Recommend skills",
    "description": "Recommend skills. With based_on set to a skill's owner/name slug, returns the top skills in that skill's category (excluding itself); without it, returns what is trending over the last 30 days.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "based_on": {
          "type": "string",
          "pattern": "^[^/]+/[^/]+$",
          "description": "Skill slug (owner/name) to base recommendations on"
        },
        "limit": {
          "type": "integer",
          "minimum": 1,
          "maximum": 100,
          "description": "Maximum number of results (default 10)"
        }
      },
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "items": {
          "type": "array",
          "items": {
            "type": "object",
            "description": "A skill as listed in search and leaderboard results.",
            "properties": {
              "slug": {
                "type": "string",
                "description": "owner/name identifier, e.g. anthropic/pdf"
              },
              "title": {
                "type": "string",
                "description": "Human-readable skill title"
              },
              "description": {
                "type": "string",
                "description": "What the skill does and when an agent should use it"
              },
              "category": {
                "type": "string",
                "description": "Category name"
              },
              "owner_handle": {
                "type": "string",
                "description": "Publisher handle"
              },
              "owner_name": {
                "type": "string",
                "description": "Publisher display name"
              },
              "license": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "SPDX license id when declared"
              },
              "security_flags": {
                "type": "array",
                "items": {
                  "type": "string"
                },
                "description": "Capability flags: docs_only, network_calls, executes_scripts, reads_secrets, untrusted_install"
              },
              "ai_audit_verdict": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "Safety review verdict: pass, caution, warning, fail or inconclusive"
              },
              "repo_stars": {
                "type": [
                  "number",
                  "null"
                ],
                "description": "GitHub stars of the source repository"
              },
              "install_snippet": {
                "type": "string",
                "description": "One-line install command"
              }
            },
            "required": [
              "slug"
            ],
            "additionalProperties": true
          },
          "description": "Matching skills, best first"
        }
      },
      "required": [
        "items"
      ]
    },
    "annotations": {
      "title": "Recommend skills",
      "readOnlyHint": true,
      "destructiveHint": false,
      "idempotentHint": true,
      "openWorldHint": false
    }
  },
  {
    "name": "skillmd_list_saved",
    "title": "List saved skills",
    "description": "List the signed-in user's saved skills. Requires the SKILLMD_TOKEN environment variable (a SkillMD personal access token).",
    "inputSchema": {
      "type": "object",
      "properties": {},
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "items": {
          "type": "array",
          "items": {
            "type": "object",
            "description": "A skill as listed in search and leaderboard results.",
            "properties": {
              "slug": {
                "type": "string",
                "description": "owner/name identifier, e.g. anthropic/pdf"
              },
              "title": {
                "type": "string",
                "description": "Human-readable skill title"
              },
              "description": {
                "type": "string",
                "description": "What the skill does and when an agent should use it"
              },
              "category": {
                "type": "string",
                "description": "Category name"
              },
              "owner_handle": {
                "type": "string",
                "description": "Publisher handle"
              },
              "owner_name": {
                "type": "string",
                "description": "Publisher display name"
              },
              "license": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "SPDX license id when declared"
              },
              "security_flags": {
                "type": "array",
                "items": {
                  "type": "string"
                },
                "description": "Capability flags: docs_only, network_calls, executes_scripts, reads_secrets, untrusted_install"
              },
              "ai_audit_verdict": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "Safety review verdict: pass, caution, warning, fail or inconclusive"
              },
              "repo_stars": {
                "type": [
                  "number",
                  "null"
                ],
                "description": "GitHub stars of the source repository"
              },
              "install_snippet": {
                "type": "string",
                "description": "One-line install command"
              }
            },
            "required": [
              "slug"
            ],
            "additionalProperties": true
          },
          "description": "Matching skills, best first"
        }
      },
      "required": [
        "items"
      ]
    },
    "annotations": {
      "title": "List saved skills",
      "readOnlyHint": true,
      "destructiveHint": false,
      "idempotentHint": true,
      "openWorldHint": false
    }
  },
  {
    "name": "skillmd_lint",
    "title": "Lint a SKILL.md",
    "description": "Validate a SKILL.md against the SkillMD format and return diagnostics, capability flags and a 0-100 quality score. Pass raw SKILL.md content, or a registry slug (owner/name) to fetch and lint that skill.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "content": {
          "type": "string",
          "description": "Raw SKILL.md text to validate (frontmatter plus body)"
        },
        "slug": {
          "type": "string",
          "pattern": "^[^/]+/[^/]+$",
          "description": "Registry skill (owner/name) to fetch and validate instead of content"
        }
      },
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "ok": {
          "type": "boolean",
          "description": "True when there are no error-level diagnostics"
        },
        "score": {
          "type": "number",
          "description": "Quality score 0-100"
        },
        "diagnostics": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "description": "Rule id, e.g. SK011"
              },
              "severity": {
                "type": "string",
                "enum": [
                  "error",
                  "warning",
                  "info"
                ]
              },
              "message": {
                "type": "string"
              },
              "line": {
                "type": [
                  "integer",
                  "null"
                ]
              }
            },
            "required": [
              "id",
              "severity",
              "message"
            ],
            "additionalProperties": true
          }
        },
        "security": {
          "type": "object",
          "description": "Scanner findings and capability flags",
          "additionalProperties": true
        }
      },
      "required": [
        "ok",
        "score",
        "diagnostics"
      ]
    },
    "annotations": {
      "title": "Lint a SKILL.md",
      "readOnlyHint": true,
      "destructiveHint": false,
      "idempotentHint": true,
      "openWorldHint": false
    }
  }
];

async function handleCall(name, args) {
  switch (name) {
    case "skillmd_search": {
      const p = new URLSearchParams({ q: args.query, limit: String(args.limit ?? 20) });
      if (args.category) p.set("category", args.category);
      if (args.verified_only) p.set("verified", "true");
      if (args.type) p.set("type", args.type);
      if (args.min_rating != null) p.set("min_rating", String(args.min_rating));
      const r = await api(`/api/search?${p}`);
      return text(trimItems(r.items));
    }
    case "skillmd_get": {
      const [owner, slugName] = String(args.slug).split("/");
      const r = await api(`/api/skills/${owner}/${slugName}`);
      return text(r);
    }
    case "skillmd_trending": {
      const p = new URLSearchParams({ range: args.range ?? "all", limit: String(args.limit ?? 20) });
      if (args.category) p.set("category", args.category);
      const r = await api(`/api/leaderboard?${p}`);
      return text(trimItems(r.items));
    }
    case "skillmd_recommend": {
      if (args.based_on) {
        const [owner, slugName] = String(args.based_on).split("/");
        const base = await api(`/api/skills/${owner}/${slugName}`).catch(() => null);
        if (base?.category_slug) {
          const r = await api(`/api/leaderboard?range=all&limit=${args.limit ?? 10}&category=${base.category_slug}`);
          return text(trimItems(r.items).filter((s) => s.slug !== args.based_on));
        }
      }
      const r = await api(`/api/leaderboard?range=30d&limit=${args.limit ?? 10}`);
      return text(trimItems(r.items));
    }
    case "skillmd_list_saved": {
      if (!TOKEN) return notice("Set SKILLMD_TOKEN (a SkillMD personal access token) to list your saved skills.");
      const r = await api(`/api/favorites`);
      return text(r.items ?? []);
    }
    case "skillmd_lint": {
      if (!lint) return notice("Validation engine unavailable — reinstall the skillmds package (npm i -g skillmds), or run `npm ci && npm run build` in a source checkout.");
      let raw = args.content;
      let slug;
      let verified = false;
      if (!raw && args.slug) {
        const [owner, slugName] = String(args.slug).split("/");
        const skill = await api(`/api/skills/${owner}/${slugName}`);
        raw = skillMdFor(skill);
        slug = slugName;
        verified = !!skill.verified;
      }
      if (!raw) return notice("Provide `content` (raw SKILL.md) or `slug` (owner/name).");
      const result = lint(raw, { ...(slug ? { slug } : {}), verified });
      return text({ ok: result.ok, score: result.score, diagnostics: result.diagnostics, security: result.security });
    }
    case "skillmd_install": {
      if (!skillMdFor) return notice("skillmds is not fully installed — reinstall it (npm i -g skillmds) and try again.");
      const [owner, slugName] = String(args.slug).split("/");
      // Defense in depth: slugName becomes a directory name below — refuse
      // anything outside the registry's slugify alphabet (path separators,
      // "..", etc.) before touching the network or filesystem.
      if (!/^[a-z0-9][a-z0-9-]*$/.test(slugName ?? "")) {
        return notice(`Refused: invalid skill name "${slugName}" — expected a lowercase slug.`);
      }
      const skill = await api(`/api/skills/${owner}/${slugName}`);
      const flags = skill.security_flags ?? [];
      // Verification never gates installs — any skill installs; flags are
      // reported in the response as information, not a wall.
      const raw = skillMdFor(skill); // returns raw_md verbatim when the registry has it
      if (lint) {
        const result = lint(raw, { slug: slugName });
        if (!result.ok) {
          const errors = result.diagnostics.filter((d) => d.severity === "error");
          return notice(`Refused: ${args.slug} failed validation (${errors.map((d) => `${d.id}: ${d.message}`).join("; ")}). Not installed.`);
        }
      }
      const baseDir = args.dest ? resolve(args.dest) : join(homedir(), ".claude", "skills");
      const dir = join(baseDir, slugName);
      await mkdir(dir, { recursive: true });
      const root = resolve(dir);

      // Zip-slip guard: refuse any path that resolves outside the skill's dir.
      const writeSafe = async (relPath, contents) => {
        const fp = resolve(dir, relPath);
        if (fp !== root && !fp.startsWith(root + sep)) throw new Error(`unsafe path: ${relPath}`);
        await mkdir(dirname(fp), { recursive: true });
        await writeFile(fp, contents);
      };

      let written = 1;
      let note = "";
      if (skill.type === "pack") {
        // Pull the full pack (SKILL.md + companion files) in one call. The JSON
        // bundle avoids adding an unzip dependency to this standalone binary.
        try {
          const bundle = await api(`/api/skills/${owner}/${slugName}/bundle?format=json`);
          // Resolve + integrity-check every file BEFORE writing any, so a
          // tampered pack refuses cleanly instead of leaving a partial install.
          const resolved = [];
          for (const f of bundle.files ?? []) {
            if (f.path.includes("..") || f.path.startsWith("/")) continue;
            let buf;
            if (f.content_base64 != null) {
              buf = Buffer.from(f.content_base64, "base64");
              // Registry-stored files are content-addressed; verify the bytes
              // match the registry's sha256. Files without one (the reconstructed
              // inline SKILL.md) carry no hash and are skipped.
              if (f.sha256) {
                const got = createHash("sha256").update(buf).digest("hex");
                if (got !== f.sha256) {
                  const err = new Error(`integrity check failed for "${f.path}"`);
                  err.integrity = true;
                  throw err;
                }
              }
            } else if (f.source_url && isAllowedSourceUrl(f.source_url)) {
              const r = await fetch(f.source_url).catch(() => null);
              if (!r || !r.ok) continue;
              buf = Buffer.from(await r.arrayBuffer());
            } else continue;
            resolved.push({ path: f.path, contents: f.path === "SKILL.md" ? raw : buf });
          }
          for (const f of resolved) await writeSafe(f.path, f.contents);
          written = resolved.length || 1;
          if (!resolved.some((f) => f.path === "SKILL.md")) await writeSafe("SKILL.md", raw);
        } catch (e) {
          if (e && e.integrity) return notice(`Refused: ${args.slug} failed integrity verification — ${e.message}. Not installed.`);
          await writeSafe("SKILL.md", raw);
          note = ` NOTE: pack assets could not be fetched — only SKILL.md was written. For the full pack run: npx skillmds add ${args.slug}`;
        }
      } else {
        await writeSafe("SKILL.md", raw);
      }
      api(`/api/skills/${owner}/${slugName}/install`, { method: "POST", body: JSON.stringify({ via: "mcp" }) }).catch(() => {});
      const summary = { installed: true, slug: args.slug, dir, files_written: written, security_flags: flags, ...(note ? { note: note.trim() } : {}) };
      return {
        content: [{ type: "text", text: `Installed ${args.slug} → ${dir} (${written} file${written === 1 ? "" : "s"}; security: ${flags.join(", ") || "unscanned"})${note}` }],
        structuredContent: summary,
      };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function startMcpServer() {
  const server = new Server(
    {
      name: "skillmd",
      version: VERSION,
      title: "SkillMD",
      description:
        "The open registry of Agent Skills: search, inspect, lint and install 25,000+ linted, security-reviewed SKILL.md files for Claude Code, Cursor, Codex and 60+ other agents.",
      websiteUrl: "https://skillmd.com",
      icons: [
        { src: "https://skillmd.com/favicon.png", mimeType: "image/png", sizes: ["512x512"] },
        { src: "https://skillmd.com/favicon.svg", mimeType: "image/svg+xml", sizes: ["any"] },
      ],
    },
    {
      capabilities: { tools: {} },
      instructions:
        "SkillMD is a registry of Agent Skills (SKILL.md files). Use skillmd_search to find skills for a task, skillmd_get to inspect one (safety verdict, capability flags, provenance), skillmd_install to write it into the agent's skills directory, and skillmd_lint to validate your own SKILL.md. skillmd_trending and skillmd_recommend surface popular and related skills. Only skillmd_install writes files; it never executes scripts.",
    },
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    try {
      return await handleCall(req.params.name, req.params.arguments ?? {});
    } catch (e) {
      return { isError: true, content: [{ type: "text", text: String(e?.message || e) }] };
    }
  });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("skillmd MCP server running (stdio)");
}

// This binary is invoked three ways:
//   - `skillmds <anything>`       → run the CLI. commander owns argv, so known
//     commands run and unknown commands get a proper "unknown command" error
//     instead of silently starting an MCP server.
//   - `skillmds` in a terminal    → run the CLI (opens the interactive menu)
//   - `skillmds` over piped stdio → start the MCP server (how MCP clients launch it;
//     they always connect stdin as a pipe, never a TTY, and pass no args)
if (process.argv.length > 2 || process.stdin.isTTY) {
  await import("../dist/cli.js"); // the CLI parses process.argv itself
} else {
  await startMcpServer();
}
