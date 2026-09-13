// skillmd_install: the MCP tool that writes. It goes through exactly the same
// installer the CLI's `skillmd add` uses — one canonical copy in .agents/skills,
// a link from every chosen agent dir, a lock entry recording provenance — so an
// agent-driven install and a human-driven one produce identical trees.
import { resolve } from "node:path";
import { lint, skillMdFor } from "@skillmds/core";
import { fetchBundle, IntegrityError } from "../api.js";
import type { RegistrySkill } from "../api.js";
import { AGENTS, agentDir, canonicalDir, detectAgents } from "../agents.js";
import { looksLikeProject, resolvePackFiles } from "../commands/add.js";
import { telemetryDisabled } from "../config.js";
import { installSkill } from "../installer.js";
import type { SkillFileInput } from "../installer.js";
import { notice } from "./tools.js";
import type { ToolContext, ToolResult } from "./tools.js";

/** Legacy `dest`: only a known agent skills dir (project or global) is accepted.
 *  The old server let a caller name any directory, which made "install this
 *  skill" a primitive for writing attacker-chosen bytes anywhere the agent could
 *  reach. A dest now has to BE one of the directories we would have written to
 *  anyway; anything else is refused with instructions to use scope + agents. */
function agentForDest(dest: string, scopeOpts: { cwd?: string; home?: string; env?: NodeJS.ProcessEnv }): { agent: string; global: boolean } | null {
  const target = resolve(dest);
  for (const global of [false, true]) {
    for (const a of AGENTS) {
      if (global && a.global === null) continue;
      if (resolve(agentDir(a.id, { ...scopeOpts, global })) === target) return { agent: a.id, global };
    }
    // The cross-agent canonical root (.agents/skills) is a legitimate target too.
    if (resolve(canonicalDir({ ...scopeOpts, global })) === target) return { agent: "codex", global };
  }
  return null;
}

export async function installFromRegistry(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  // Defense in depth: the name becomes a directory below, so refuse anything
  // outside the registry's slugify alphabet before touching network or disk.
  const m = String(args.slug ?? "").match(/^([a-z0-9][a-z0-9-]*)\/([a-z0-9][a-z0-9-]*)$/);
  if (!m) return notice(`Refused: invalid slug "${String(args.slug)}" — expected owner/name in lowercase.`);
  const [, owner, name] = m as [string, string, string];
  const base = { cwd: ctx.cwd, home: ctx.home, env: ctx.env };

  let global: boolean;
  let agents: string[] | undefined = Array.isArray(args.agents) ? (args.agents as unknown[]).map(String) : undefined;
  if (typeof args.dest === "string" && args.dest) {
    const hit = agentForDest(args.dest, base);
    if (!hit) {
      return notice(
        `Refused: dest "${args.dest}" is not a known agent skills directory. Use scope ("project"|"global") and agents instead; known roots: ${[...new Set(AGENTS.map((a) => a.project.join("/")))].join(", ")}.`,
      );
    }
    global = hit.global;
    agents = agents ?? [hit.agent];
  } else if (args.scope === "project" || args.scope === "global") {
    global = args.scope === "global";
  } else {
    // Same rule as the CLI: project when the cwd looks like one, else global.
    global = !looksLikeProject(resolve(ctx.cwd ?? process.cwd()));
  }
  const scope = { ...base, global };
  const detected = detectAgents(scope);
  const targets = agents?.length ? agents : detected.length ? detected : ["claude-code"];
  for (const a of targets) {
    if (!AGENTS.some((x) => x.id === a)) return notice(`Unknown agent "${a}". Known: ${AGENTS.map((x) => x.id).join(", ")}`);
  }

  const skill = await ctx.api<RegistrySkill>(`/api/skills/${owner}/${name}`);
  const flags = skill.security_flags ?? [];
  // The caller can pre-declare capabilities it will not accept; an install that
  // trips one is refused before anything is fetched or written.
  const deny = Array.isArray(args.deny) ? (args.deny as unknown[]).map(String) : [];
  const denied = flags.filter((f) => deny.includes(f));
  if (denied.length) return notice(`Refused: ${owner}/${name} carries denied security flags: ${denied.join(", ")}. Not installed.`);

  const raw = skillMdFor(skill);
  const result = lint(raw, { slug: name });
  if (!result.ok) {
    const errors = result.diagnostics.filter((d) => d.severity === "error");
    return notice(`Refused: ${owner}/${name} failed validation (${errors.map((d) => `${d.id}: ${d.message}`).join("; ")}). Not installed.`);
  }

  let files: SkillFileInput[] = [{ path: "SKILL.md", contents: raw }];
  let note = "";
  if (skill.type === "pack") {
    try {
      const bundle = await fetchBundle(ctx.base, `${owner}/${name}`, ctx.token);
      if (bundle?.length) {
        files = bundle.some((f) => f.path === "SKILL.md") ? bundle : [...bundle, { path: "SKILL.md", contents: raw }];
      } else {
        const pack = await resolvePackFiles(skill);
        if (pack) files = pack.files;
        else note = "pack assets could not be fetched — only SKILL.md was written";
      }
    } catch (e) {
      // A tampered pack is never a fallback case: refuse the whole install.
      if (e instanceof IntegrityError) return notice(`Refused: ${owner}/${name} failed integrity verification — ${e.message}. Not installed.`);
      note = `pack assets could not be fetched (${e instanceof Error ? e.message : String(e)}) — only SKILL.md was written`;
    }
  }

  let r;
  try {
    r = await installSkill({
      name,
      files,
      source: `registry:${owner}/${name}`,
      commit_sha: skill.commit_sha ?? undefined,
      scope,
      agents: targets,
      explicitAgents: Boolean(agents?.length),
      mode: args.mode === "copy" ? "copy" : "link",
      force: Boolean(args.force),
    });
  } catch (e) {
    return notice(`Refused: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (!telemetryDisabled(ctx.env ?? process.env)) {
    ctx
      .api(`/api/skills/${owner}/${name}/install`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ via: "mcp" }),
      })
      .catch(() => {});
  }

  const summary = {
    installed: true,
    slug: `${owner}/${name}`,
    scope: global ? "global" : "project",
    canonical: r.canonical,
    targets: r.targets,
    skipped: r.skipped,
    files_written: files.length,
    security_flags: flags,
    ...(note ? { note } : {}),
  };
  const where = r.targets.length
    ? r.targets.map((t) => `${t.agent} → ${t.path} (${t.mode})`).join("; ")
    : `${r.canonical} (canonical only)`;
  return {
    content: [
      {
        type: "text",
        text: `Installed ${owner}/${name} [${summary.scope}]: ${where}. ${files.length} file(s); security: ${flags.join(", ") || "unscanned"}.${note ? ` NOTE: ${note}` : ""}`,
      },
    ],
    structuredContent: summary,
  };
}
