import { Command } from "commander";
import { RULES } from "@skillmd/core";
import pc from "picocolors";

export function rulesCommand(): Command {
  return new Command("rules")
    .description("List lint rules, or show detail for one rule id")
    .argument("[id]", "a rule id, e.g. SK010")
    .option("--json", "machine-readable output")
    .action((id: string | undefined, opts: { json?: boolean }) => {
      const list = id ? RULES.filter((r) => r.id.toLowerCase() === id.toLowerCase()) : RULES;
      if (id && list.length === 0) {
        console.error(`Unknown rule: ${id}`);
        process.exitCode = 1;
        return;
      }
      if (opts.json) {
        console.log(JSON.stringify(list.map((r) => ({ id: r.id, severity: r.severity, description: r.description })), null, 2));
        return;
      }
      const badge = (sev: string) =>
        sev === "error" ? pc.bgRed(pc.white(" error ")) : sev === "warn" ? pc.bgYellow(pc.black(" warn  ")) : pc.bgCyan(pc.black(" info  "));
      console.log(pc.bold("\nLint rules\n"));
      for (const r of list) console.log(`  ${pc.bold(r.id)}  ${badge(r.severity)}  ${r.description}`);
      console.log("");
    });
}
