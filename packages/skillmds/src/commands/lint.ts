import { Command } from "commander";
import { writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import pc from "picocolors";
import * as p from "@clack/prompts";
import { lint, toJson, toSarif, toGithub } from "@skillmds/core";
import type { LintResult } from "@skillmds/core";
import { resolveSource } from "../source.js";
import type { ResolvedSkill } from "../source.js";
import { renderReport, exitCodeFor } from "../ui.js";

type Format = "text" | "json" | "sarif" | "github";

interface LintFlags {
  format: Format;
  strict?: boolean;
  failOnWarning?: boolean;
  fix?: boolean;
  errorsOnly?: boolean;
}

export interface LintRun {
  results: { file: string; result: LintResult; resolved: ResolvedSkill }[];
  output: string;
  exitCode: 0 | 1;
}

// Insert a `license:` line into frontmatter if missing (the one safe auto-fix).
function applyLicenseFix(raw: string): string | null {
  if (/^---[\s\S]*?\blicense:\s*\S+[\s\S]*?^---/m.test(raw)) return null;
  const m = raw.match(/^(---\r?\n)([\s\S]*?)(\r?\n---)/);
  if (!m) return null;
  return `${m[1]}${m[2]}\nlicense: UNKNOWN${m[3]}${raw.slice(m[0].length)}`;
}

export async function runLint(target: string, flags: LintFlags): Promise<LintRun> {
  let resolved = await resolveSource(target);

  if (flags.fix) {
    resolved = resolved.map((r) => {
      if (!r.file) return r;
      const fixed = applyLicenseFix(r.raw);
      if (fixed) {
        writeFileSync(r.file, fixed, "utf8");
        return { ...r, raw: fixed };
      }
      return r;
    });
  }

  const results = resolved.map((r) => ({ file: r.path, result: lint(r.raw, { slug: r.slug }), resolved: r }));
  const exitCode = exitCodeFor(results, flags);

  let output: string;
  switch (flags.format) {
    case "json": output = JSON.stringify(toJson(results), null, 2); break;
    case "sarif": output = JSON.stringify(toSarif(results), null, 2); break;
    case "github": output = toGithub(results); break;
    default: output = renderReport(results, { errorsOnly: flags.errorsOnly });
  }

  return { results, output, exitCode };
}

export function lintCommand(): Command {
  return new Command("lint")
    .alias("check")
    .description("Validate SKILL.md file(s) against the spec and report a quality score")
    .argument("[target]", "local path or GitHub source", ".")
    .option("--format <fmt>", "text | json | sarif | github", "text")
    .option("--strict", "treat warnings as errors")
    .option("--fail-on-warning", "exit non-zero when warnings exist")
    .option("--fix", "apply safe automatic fixes (e.g. add missing license)")
    .option("--errors-only", "show only skills that failed")
    .action(async (target: string, opts: LintFlags) => {
      // Rich UI only on an interactive terminal with text output; otherwise keep
      // stdout clean (json/sarif/github) and just print plainly.
      const ui = Boolean(process.stdout.isTTY) && opts.format === "text";

      if (resolve(target) === homedir()) {
        process.stderr.write(pc.yellow(`Warning: scanning your entire home directory. Pass a narrower path, e.g. skillmd lint ./my-skill\n`));
      }

      if (ui) {
        p.intro(pc.bgCyan(pc.black(" skillmd lint ")));
        const s = p.spinner();
        s.start(`Scanning ${target}`);
        try {
          const run = await runLint(target, opts);
          s.stop(`Scanned ${run.results.length} skill${run.results.length === 1 ? "" : "s"}`);
          console.log(run.output);
          const failed = run.results.filter((r) => !r.result.ok).length;
          p.outro(failed === 0 ? pc.green("All good") : pc.red(`${failed} skill${failed === 1 ? "" : "s"} failed — details above`));
          process.exitCode = run.exitCode;
        } catch (err) {
          s.stop(pc.red("No skills found"));
          p.outro(err instanceof Error ? err.message : String(err));
          process.exitCode = 1;
        }
        return;
      }

      process.stderr.write(`Looking for SKILL.md under ${target} …\n`);
      const run = await runLint(target, opts);
      console.log(run.output);
      process.exitCode = run.exitCode;
    });
}
