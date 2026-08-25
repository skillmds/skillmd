// Quality score, 0-100 (higher is better). Composite of three axes so the number
// reflects something real, not just lint nits:
//   1. Spec correctness  — errors/warnings from the lint rules.
//   2. Completeness       — the functionality rules (stub body, no headings, terse
//                           description, missing metadata) are warnings and count here.
//   3. Security risk      — a small nudge, not a hammer. The security flags fire on
//                           ordinary documentation (mentioning process.env, a URL, or
//                           a bash block), so they are weak signals and cost very
//                           little; only executes_scripts carries meaningful weight.
// Agrees with the Skill.quality_score field stored in the registry
// (packages/db/src/types.ts) so the CLI and the registry speak the same scale.
import type { Diagnostic } from "./rules.js";
import type { SecurityResult, SecurityFlag } from "./security.js";

const WEIGHT: Record<Diagnostic["severity"], number> = {
  error: 30,
  warn: 10,
  info: 3,
};

// Points removed for each risky behaviour detected in the body. These flags are
// pattern matches against prose and code samples, not proof of anything unsafe,
// so the "safe" behaviours (reading env vars, making network calls) barely move
// the score. executes_scripts is the only flag with real teeth, and even it is
// modest — a well-documented skill that ships a script should still score well.
const RISK: Record<SecurityFlag, number> = {
  docs_only: 0,
  reads_secrets: 2,
  network_calls: 1,
  executes_scripts: 5,
  // fetch-and-execute from a non-standard source — the supply-chain pattern the
  // AI verdict floors to "warning"; the heaviest penalty here for the same reason
  untrusted_install: 15,
};

// Verified skills are human-reviewed and known-good; their score never drops
// below this floor (unless the content fails to parse — see the error guard).
export const VERIFIED_FLOOR = 85;

export interface ScoreOptions {
  /** Skill is verified in the registry — applies the VERIFIED_FLOOR. */
  verified?: boolean;
}

export function qualityScore(diagnostics: Diagnostic[], security?: SecurityResult, opts: ScoreOptions = {}): number {
  let penalty = diagnostics.reduce((sum, d) => sum + WEIGHT[d.severity], 0);
  if (security) {
    for (const flag of security.flags) penalty += RISK[flag] ?? 0;
  }
  const score = Math.max(0, Math.min(100, 100 - penalty));
  // Don't floor a skill that doesn't even parse — a hard error means the content
  // is broken regardless of its verified badge.
  const hasError = diagnostics.some((d) => d.severity === "error");
  return opts.verified && !hasError ? Math.max(score, VERIFIED_FLOOR) : score;
}
