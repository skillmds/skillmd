import { Command } from "commander";
import pc from "picocolors";
import { createClient } from "../api.js";
import type { RegistrySkill } from "../api.js";
import { safeText } from "../sanitize.js";

// Mirrors the JSON returned by GET /api/skills/:owner/:name (a superset of
// RegistrySkill — that type only models the fields the installer needs to
// reinstall a skill; this command surfaces the rest for humans).
export interface DetailSkill extends RegistrySkill {
  avg_rating?: number;
  rating_count?: number;
  install_count?: number;
  category?: string | null;
  category_slug?: string | null;
  owner_handle?: string;
  provenance?: {
    source_repo?: string | null;
    commit_sha?: string | null;
    last_synced_at?: string | null;
    license?: string | null;
  };
  install?: { mcp?: string; mcp_setup?: string; cli?: string };
}

export interface InfoFlags {
  json?: boolean;
  token?: string;
  api?: string;
}

export interface InfoResult {
  ok: boolean;
  exitCode: 0 | 1;
  output: string;
  skill?: DetailSkill;
}

/** The one thing that talks to the network, injected so the command stays testable. */
export interface InfoDeps {
  api?: <T>(path: string) => Promise<T>;
}

/** Fetch and format registry details for a skill. Exported (like runAdd/runSearch)
 *  so tests can drive it without going through commander/process.exitCode. */
export async function runInfo(slug: string, flags: InfoFlags, deps: InfoDeps = {}): Promise<InfoResult> {
  const [owner, name] = slug.split("/");
  if (!owner || !name || slug.split("/").length !== 2) {
    return { ok: false, exitCode: 1, output: pc.red("Expected owner/name, e.g. anthropic/pdf") };
  }

  const api = deps.api ?? createClient(flags).api;
  let s: DetailSkill;
  try {
    s = await api<DetailSkill>(`/api/skills/${owner}/${name}`);
  } catch (err) {
    // createClient's api() throws `SkillMD API ${status} on ${path}: ${detail}` —
    // no structured status, so we sniff the message. A 404 is a real "not found"
    // answer; anything else (network failure, 5xx, etc.) is a different problem
    // and should not be mislabeled as a missing skill.
    const message = err instanceof Error ? err.message : String(err);
    if (/^SkillMD API 404 /.test(message)) {
      return { ok: false, exitCode: 1, output: pc.red(`Skill not found on the registry: ${slug}`) };
    }
    return { ok: false, exitCode: 1, output: pc.red(`Could not reach the SkillMD registry: ${message}`) };
  }

  if (flags.json) return { ok: true, exitCode: 0, output: JSON.stringify(s, null, 2), skill: s };

  // Everything below is registry text. safeText() strips the escape sequences
  // that would otherwise repaint the terminal, so it is applied to each string
  // BEFORE picocolors wraps it (afterwards it would eat our own colour codes).
  const slugTxt = safeText(s.slug, 200);
  const lines: string[] = [];
  lines.push(
    `${pc.bold(slugTxt)} ${pc.dim(`[${safeText(s.type ?? "single", 40)}]`)} ${s.verified ? pc.green("✓ verified") : pc.yellow("unverified")}`,
  );
  lines.push(`  ${safeText(s.description)}`);
  lines.push(
    pc.dim(
      `  category: ${safeText(s.category ?? "-", 100) || "-"} · rating: ${s.avg_rating != null ? s.avg_rating.toFixed(1) : "-"} (${s.rating_count ?? 0}) · installs: ${s.install_count ?? 0}`,
    ),
  );
  const securityFlags = (s.security_flags ?? []).map((f) => safeText(f, 60)).filter(Boolean);
  lines.push(
    pc.dim(`  security: ${securityFlags.join(", ") || "unscanned"} · license: ${safeText(s.provenance?.license ?? s.license ?? "unknown", 100) || "unknown"}`),
  );
  const sourceRepo = safeText(s.provenance?.source_repo ?? s.source_repo, 300);
  const commitSha = safeText(s.provenance?.commit_sha ?? s.commit_sha, 100);
  if (sourceRepo) lines.push(pc.dim(`  source: ${sourceRepo}${commitSha ? ` @ ${commitSha.slice(0, 8)}` : ""}`));
  lines.push(pc.dim(`  page: https://skillmd.com/skills/${slugTxt}`));
  lines.push(pc.dim(`  install: ${safeText(s.install?.cli, 300) || `npx skillmds add ${slugTxt}`}`));

  return { ok: true, exitCode: 0, output: lines.join("\n"), skill: s };
}

export function infoCommand(): Command {
  return new Command("info")
    .description("Show registry details for a skill: verification, security flags, provenance, rating")
    .argument("<slug>", "owner/name, e.g. anthropic/pdf")
    .action(async (slug: string, _opts: unknown, cmd: Command) => {
      const flags = { ...cmd.parent?.opts() } as InfoFlags;
      const run = await runInfo(slug, flags);
      if (run.output) (run.ok ? console.log : console.error)(run.output);
      process.exitCode = run.exitCode;
    });
}
