// GitHub Actions workflow command annotations.
// https://docs.github.com/actions/using-workflows/workflow-commands-for-github-actions
import type { LintResult } from "../lint.js";

const LEVEL: Record<string, string> = { error: "error", warn: "warning", info: "notice" };

export function toGithub(results: { file: string; result: LintResult }[]): string {
  const lines: string[] = [];
  for (const { file, result } of results) {
    for (const d of result.diagnostics) {
      const level = LEVEL[d.severity] ?? "notice";
      const loc = d.line !== undefined ? `,line=${d.line}` : "";
      lines.push(`::${level} file=${file}${loc},title=${d.id}::${d.message}`);
    }
  }
  return lines.join("\n");
}
