import { Command } from "commander";
import pc from "picocolors";
import { createClient } from "../api.js";
import type { RegistrySkill } from "../api.js";

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

/** Fetch and format registry details for a skill. Exported (like runAdd/runSearch)
 *  so tests can drive it without going through commander/process.exitCode. */
export async function runInfo(slug: string, flags: InfoFlags): Promise<InfoResult> {
  const [owner, name] = slug.split("/");
  if (!owner || !name || slug.split("/").length !== 2) {
    return { ok: false, exitCode: 1, output: pc.red("Expected owner/name, e.g. anthropic/pdf") };
  }

  const { api } = createClient(flags);
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

  const lines: string[] = [];
  lines.push(
    `${pc.bold(s.slug)} ${pc.dim(`[${s.type ?? "single"}]`)} ${s.verified ? pc.green("✓ verified") : pc.yellow("unverified")}`,
  );
  lines.push(`  ${s.description}`);
  lines.push(
    pc.dim(
      `  category: ${s.category ?? "-"} · rating: ${s.avg_rating != null ? s.avg_rating.toFixed(1) : "-"} (${s.rating_count ?? 0}) · installs: ${s.install_count ?? 0}`,
    ),
  );
  lines.push(
    pc.dim(`  security: ${(s.security_flags ?? []).join(", ") || "unscanned"} · license: ${s.provenance?.license ?? s.license ?? "unknown"}`),
  );
  const sourceRepo = s.provenance?.source_repo ?? s.source_repo;
  const commitSha = s.provenance?.commit_sha ?? s.commit_sha;
  if (sourceRepo) lines.push(pc.dim(`  source: ${sourceRepo}${commitSha ? ` @ ${commitSha.slice(0, 8)}` : ""}`));
  lines.push(pc.dim(`  page: https://skillmd.com/skills/${s.slug}`));
  lines.push(pc.dim(`  install: ${s.install?.cli ?? `npx skillmds add ${s.slug}`}`));

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
