import type { LintResult } from "../lint.js";

export interface JsonReportEntry {
  file: string;
  ok: boolean;
  score: number;
  diagnostics: LintResult["diagnostics"];
  security: LintResult["security"];
}

export function toJson(results: { file: string; result: LintResult }[]): JsonReportEntry[] {
  return results.map(({ file, result }) => ({
    file,
    ok: result.ok,
    score: result.score,
    diagnostics: result.diagnostics,
    security: result.security,
  }));
}
