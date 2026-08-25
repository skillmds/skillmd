// SARIF 2.1.0 output for GitHub Code Scanning / security tooling.
import type { LintResult } from "../lint.js";
import { RULES } from "../rules.js";

const SARIF_LEVEL: Record<string, string> = { error: "error", warn: "warning", info: "note" };

export interface SarifLog {
  $schema: string;
  version: "2.1.0";
  runs: unknown[];
}

export function toSarif(results: { file: string; result: LintResult }[]): SarifLog {
  const sarifResults = results.flatMap(({ file, result }) =>
    result.diagnostics.map((d) => ({
      ruleId: d.id,
      level: SARIF_LEVEL[d.severity] ?? "note",
      message: { text: d.message },
      locations: [
        {
          physicalLocation: {
            artifactLocation: { uri: file },
            region: { startLine: d.line ?? 1 },
          },
        },
      ],
    })),
  );

  return {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "skillmd",
            informationUri: "https://skillmd.com",
            rules: RULES.map((r) => ({
              id: r.id,
              shortDescription: { text: r.description },
              defaultConfiguration: { level: SARIF_LEVEL[r.severity] ?? "note" },
            })),
          },
        },
        results: sarifResults,
      },
    ],
  };
}
