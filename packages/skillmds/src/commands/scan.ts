import { Command } from "commander";
import { scanSecurity, parseSkillMd } from "@skillmds/core";
import type { SecurityResult } from "@skillmds/core";
import { resolveSource } from "../source.js";
import pc from "picocolors";

interface ScanFlags {
  deny?: string[];
  format: "text" | "json";
}

export interface ScanEntry {
  file: string;
  security: SecurityResult;
  denied: string[];
}

export async function runScan(target: string, flags: ScanFlags): Promise<{ entries: ScanEntry[]; exitCode: 0 | 1; output: string }> {
  const resolved = await resolveSource(target);
  const deny = new Set(flags.deny ?? []);
  const entries: ScanEntry[] = resolved.map((r) => {
    const parsed = parseSkillMd(r.raw, "single");
    const body = "error" in parsed ? r.raw : parsed.body;
    const security = scanSecurity(body);
    const denied = security.flags.filter((f) => deny.has(f));
    return { file: r.path, security, denied };
  });

  const exitCode: 0 | 1 = entries.some((e) => e.denied.length > 0) ? 1 : 0;

  let output: string;
  if (flags.format === "json") {
    output = JSON.stringify(entries, null, 2);
  } else {
    const lines: string[] = [];
    for (const e of entries) {
      const flagStr = e.security.flags.join(", ");
      const head = e.denied.length ? pc.red(`DENY ${e.file}`) : pc.green(`OK   ${e.file}`);
      lines.push(`${head}  ${pc.dim(flagStr)}`);
      for (const f of e.security.findings) {
        const mark = deny.has(f.flag) ? pc.red(f.flag) : pc.yellow(f.flag);
        lines.push(`  ${mark}  :${f.line}  ${pc.dim(f.snippet)}`);
      }
    }
    output = lines.join("\n");
  }
  return { entries, exitCode, output };
}

export function scanCommand(): Command {
  return new Command("scan")
    .description("Security-scan SKILL.md file(s) for scripts, network calls and secret access")
    .argument("[target]", "local path or GitHub source", ".")
    .option("--deny <flags...>", "exit non-zero if any of these flags are present (e.g. executes_scripts)")
    .option("--format <fmt>", "text | json", "text")
    .action(async (target: string, opts: ScanFlags) => {
      const run = await runScan(target, opts);
      console.log(run.output);
      process.exitCode = run.exitCode;
    });
}
