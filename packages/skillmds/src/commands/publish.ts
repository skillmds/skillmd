import { Command } from "commander";
import pc from "picocolors";
import { lint, toText } from "@skillmd/core";
import type { LintResult } from "@skillmd/core";
import { resolveSource } from "../source.js";
import { createClient } from "../api.js";
import { decorate } from "../ui.js";

export interface PublishFlags {
  force?: boolean;
  dryRun?: boolean;
  type?: "single" | "pack";
  token?: string;
  api?: string;
}

export interface PublishDeps {
  resolve: (arg: string) => Promise<{ path: string; raw: string; slug: string }[]>;
  submit: (payload: { content: string; type: "single" | "pack" }, flags: PublishFlags) => Promise<{ slug?: string; status?: string }>;
}

const defaultDeps: PublishDeps = {
  resolve: resolveSource,
  async submit(payload, flags) {
    const { api, hasToken } = createClient(flags);
    if (!hasToken) throw new Error("No token. Run `skillmd login` or pass --token.");
    return api(`/api/skills`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  },
};

export interface PublishOutcome {
  result: LintResult;
  published: boolean;
  slug?: string;
  exitCode: 0 | 1;
  output: string;
}

export async function runPublish(target: string, flags: PublishFlags, deps: PublishDeps = defaultDeps): Promise<PublishOutcome> {
  const sources = await deps.resolve(target);
  if (sources.length !== 1) {
    return { result: lint(""), published: false, exitCode: 1, output: `Expected exactly one SKILL.md, found ${sources.length}.` };
  }
  const src = sources[0]!;
  const result = lint(src.raw, { slug: src.slug });
  const report = toText([{ file: src.path, result }], { decorate });

  // The gate: never publish a skill with lint errors. --force only bypasses warnings.
  if (!result.ok) {
    return { result, published: false, exitCode: 1, output: `${report}\n${pc.red("✗ Refusing to publish: fix the errors above.")}` };
  }
  const hasWarn = result.diagnostics.some((d) => d.severity === "warn");
  if (hasWarn && !flags.force) {
    return { result, published: false, exitCode: 1, output: `${report}\n${pc.yellow("✗ Warnings present. Re-run with --force to publish anyway.")}` };
  }
  if (flags.dryRun) {
    return { result, published: false, exitCode: 0, output: `${report}\n${pc.green("✓ Dry run: would publish.")}` };
  }

  const res = await deps.submit({ content: src.raw, type: flags.type ?? "single" }, flags);
  return { result, published: true, slug: res.slug, exitCode: 0, output: `${report}\n${pc.green(`✓ Published ${res.slug ?? src.slug} (status: ${res.status ?? "pending"})`)}` };
}

export function publishCommand(): Command {
  return new Command("publish")
    .alias("submit")
    .description("Publish a skill to the registry (refuses to publish on lint errors)")
    .argument("[target]", "local path to the skill", ".")
    .option("--type <type>", "single | pack", "single")
    .option("--force", "publish despite warnings (never bypasses errors)")
    .option("--dry-run", "lint only; do not publish")
    .action(async (target: string, opts: PublishFlags, cmd: Command) => {
      const merged = { ...cmd.parent?.opts(), ...opts };
      const run = await runPublish(target, merged);
      console.log(run.output);
      process.exitCode = run.exitCode;
    });
}
