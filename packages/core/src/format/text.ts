// Plain-text report (no color — the CLI layers picocolors on top via the
// `decorate` hook so core stays dependency-light and runtime-agnostic).
import type { LintResult } from "../lint.js";
import type { Severity } from "../rules.js";

export interface TextOptions {
  /** Optional per-token decorator (e.g. picocolors) applied by the CLI. */
  decorate?: (text: string, severity: Severity | "ok" | "dim") => string;
}

const BADGE: Record<Severity, string> = { error: "ERROR", warn: " WARN", info: " INFO" };

export function toText(results: { file: string; result: LintResult }[], opts: TextOptions = {}): string {
  const paint = opts.decorate ?? ((t) => t);
  const out: string[] = [];

  for (const { file, result } of results) {
    const status = result.ok ? paint("PASS", "ok") : paint("FAIL", "error");
    out.push(`${status}  ${file}  ${paint(`score ${result.score}/100`, "dim")}`);

    for (const d of result.diagnostics) {
      const where = d.line !== undefined ? `:${d.line}` : "";
      out.push(`  ${paint(BADGE[d.severity], d.severity)}  ${d.id}${where}  ${d.message}`);
    }
    if (result.security.flags.length && result.security.flags[0] !== "docs_only") {
      out.push(`  ${paint("SEC ", "warn")}  flags: ${result.security.flags.join(", ")}`);
    }
    out.push("");
  }

  const failed = results.filter((r) => !r.result.ok).length;
  const summary = failed === 0
    ? paint(`✓ ${results.length} skill(s) passed`, "ok")
    : paint(`✗ ${failed}/${results.length} skill(s) failed`, "error");
  out.push(summary);

  return out.join("\n");
}
