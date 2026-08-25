import { Command } from "commander";
import { rmSync } from "node:fs";
import pc from "picocolors";
import { installedSkills } from "../agents.js";
import type { ScopeOptions } from "../agents.js";

export interface RemoveResult {
  removed: string[];
  output: string;
}

export function runRemove(names: string[], scope: ScopeOptions = {}): RemoveResult {
  const installed = installedSkills(scope);
  const targets = installed.filter((s) => names.includes(s.name));
  const removed: string[] = [];
  const lines: string[] = [];
  for (const t of targets) {
    rmSync(t.path, { recursive: true, force: true });
    removed.push(t.path);
    lines.push(pc.green(`✓ removed ${t.name} (${t.agent})`));
  }
  for (const n of names) {
    if (!targets.some((t) => t.name === n)) lines.push(pc.yellow(`- ${n} not installed`));
  }
  return { removed, output: lines.join("\n") };
}

export function removeCommand(): Command {
  return new Command("remove")
    .alias("rm")
    .description("Remove installed skills")
    .argument("<names...>", "skill names to remove")
    .option("-g, --global", "only global skills")
    .action((names: string[], opts: { global?: boolean }) => {
      const run = runRemove(names, { global: opts.global });
      console.log(run.output);
    });
}
