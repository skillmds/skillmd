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
const text = (obj) => ({ content: [{ type: "text", text: typeof obj === "string" ? obj : JSON.stringify(obj, null, 2) }] });

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
    name: "skillmd_search",
    description: "Search SkillMD for Agent Skills by name, description, or task. Returns matching skills with their owner/name slug and install snippets.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Natural-language query or keywords" },
        category: { type: "string", description: "Filter by category slug (e.g. devops, data, security)" },
        verified_only: { type: "boolean", description: "Only verified skills" },
        type: { type: "string", enum: ["single", "pack"], description: "single file or pack" },
        min_rating: { type: "number", description: "Minimum average rating 0-5" },
        limit: { type: "number", description: "Max results (default 20)" },
      },
      required: ["query"],
    },
  },
  {
    name: "skillmd_get",
    description: "Fetch a single skill by slug (owner/name), including its SKILL.md body, provenance, license and security flags.",
    inputSchema: { type: "object", properties: { slug: { type: "string", description: "owner/name, e.g. anthropic/pdf" } }, required: ["slug"] },
  },
  {
    name: "skillmd_install",
    description:
      "Install a skill by slug: writes its SKILL.md into the agent's skills directory. Never executes any scripts. Any skill installs; the response reports its security flags (docs_only / network_calls / executes_scripts / reads_secrets) as information.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "owner/name, e.g. anthropic/pdf" },
        dest: { type: "string", description: "Target skills dir. Default ~/.claude/skills" },
      },
      required: ["slug"],
    },
  },
  {
    name: "skillmd_trending",
    description: "Top skills on the SkillMD leaderboard. range: '30d' or 'all'.",
    inputSchema: {
      type: "object",
      properties: {
        range: { type: "string", enum: ["30d", "all"], description: "Time window (default all)" },
        category: { type: "string", description: "Optional category slug" },
        limit: { type: "number", description: "Max results (default 20)" },
      },
    },
  },
  {
    name: "skillmd_recommend",
    description: "Recommend skills. If based_on is given, suggests skills similar to it (same category); otherwise returns trending.",
    inputSchema: {
      type: "object",
      properties: { based_on: { type: "string", description: "A slug to base recommendations on" }, limit: { type: "number" } },
    },
  },
  {
    name: "skillmd_list_saved",
    description: "List the signed-in user's saved skills. Requires SKILLMD_TOKEN to be set.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "skillmd_lint",
    description:
      "Validate a SKILL.md against the SkillMD spec and return diagnostics, security flags, and a quality score (0-100). Pass raw SKILL.md content, or a registry slug (owner/name) to fetch and lint.",
    inputSchema: {
      type: "object",
      properties: {
        content: { type: "string", description: "Raw SKILL.md content to validate" },
        slug: { type: "string", description: "Registry slug owner/name to fetch and validate" },
      },
    },
  },
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
      if (!TOKEN) return text("Set SKILLMD_TOKEN (a SkillMD personal access token) to list your saved skills.");
      const r = await api(`/api/favorites`);
      return text(r.items ?? []);
    }
    case "skillmd_lint": {
      if (!lint) return text("Validation engine unavailable — reinstall the skillmds package (npm i -g skillmds), or run `npm ci && npm run build` in a source checkout.");
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
      if (!raw) return text("Provide `content` (raw SKILL.md) or `slug` (owner/name).");
      const result = lint(raw, { ...(slug ? { slug } : {}), verified });
      return text({ ok: result.ok, score: result.score, diagnostics: result.diagnostics, security: result.security });
    }
    case "skillmd_install": {
      if (!skillMdFor) return text("skillmds is not fully installed — reinstall it (npm i -g skillmds) and try again.");
      const [owner, slugName] = String(args.slug).split("/");
      // Defense in depth: slugName becomes a directory name below — refuse
      // anything outside the registry's slugify alphabet (path separators,
      // "..", etc.) before touching the network or filesystem.
      if (!/^[a-z0-9][a-z0-9-]*$/.test(slugName ?? "")) {
        return text(`Refused: invalid skill name "${slugName}" — expected a lowercase slug.`);
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
          return text(`Refused: ${args.slug} failed validation (${errors.map((d) => `${d.id}: ${d.message}`).join("; ")}). Not installed.`);
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
          if (e && e.integrity) return text(`Refused: ${args.slug} failed integrity verification — ${e.message}. Not installed.`);
          await writeSafe("SKILL.md", raw);
          note = ` NOTE: pack assets could not be fetched — only SKILL.md was written. For the full pack run: npx skillmds add ${args.slug}`;
        }
      } else {
        await writeSafe("SKILL.md", raw);
      }
      api(`/api/skills/${owner}/${slugName}/install`, { method: "POST", body: JSON.stringify({ via: "mcp" }) }).catch(() => {});
      return text(`Installed ${args.slug} → ${dir} (${written} file${written === 1 ? "" : "s"}; security: ${flags.join(", ") || "unscanned"})${note}`);
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function startMcpServer() {
  const server = new Server({ name: "skillmd", version: VERSION }, { capabilities: { tools: {} } });
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
