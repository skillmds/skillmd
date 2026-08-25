// Orchestrates parse -> rules -> security -> score into a single LintResult.
import { parseSkillMd } from "./parse.js";
import type { ParsedSkill } from "./parse.js";
import { runRules } from "./rules.js";
import type { Diagnostic, RuleContext } from "./rules.js";
import { scanSecurity } from "./security.js";
import type { SecurityResult } from "./security.js";
import { qualityScore } from "./quality.js";

export interface LintOptions {
  /** Slug or directory name the skill lives under (enables SK040). */
  slug?: string;
  /** Skill type; defaults to "single". */
  type?: "single" | "pack";
  /** Skill is verified in the registry — lifts the score to the verified floor. */
  verified?: boolean;
}

export interface LintResult {
  ok: boolean;
  skill?: ParsedSkill;
  diagnostics: Diagnostic[];
  security: SecurityResult;
  score: number;
}

export function lint(raw: string, opts: LintOptions = {}): LintResult {
  const parsed = parseSkillMd(raw, opts.type ?? "single");

  if ("error" in parsed) {
    const diagnostics: Diagnostic[] = [{ id: "SK001", severity: "error", message: parsed.error }];
    const security = scanSecurity(raw);
    return {
      ok: false,
      diagnostics,
      security,
      score: qualityScore(diagnostics, security, { verified: opts.verified }),
    };
  }

  const ctx: RuleContext = opts.slug !== undefined ? { slug: opts.slug } : {};
  const diagnostics = runRules(parsed, ctx);
  const security = scanSecurity(parsed.body);
  const ok = !diagnostics.some((d) => d.severity === "error");

  return { ok, skill: parsed, diagnostics, security, score: qualityScore(diagnostics, security, { verified: opts.verified }) };
}
