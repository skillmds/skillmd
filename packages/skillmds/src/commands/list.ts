import { Command } from "commander";
import pc from "picocolors";
import { parseSkillMd } from "@skillmds/core";
import { installedSkills } from "../agents.js";
import type { ScopeOptions } from "../agents.js";

export function listCommand(): Command {
  return new Command("list")
    .alias("ls")
    .description("List installed skills across detected agents")
    .option("-g, --global", "only global skills")
    .option("--json", "machine-readable output")
    .action((opts: { global?: boolean; json?: boolean }) => {
      const scope: ScopeOptions = { global: opts.global };
      const skills = installedSkills(scope);
      if (opts.json) {
        console.log(JSON.stringify(skills.map((s) => ({ name: s.name, agent: s.agent, scope: s.scope, path: s.path })), null, 2));
        return;
      }
      if (skills.length === 0) { console.log("No installed skills found."); return; }
      for (const s of skills) {
        const parsed = parseSkillMd(s.raw);
        const desc = "error" in parsed ? pc.red(`(invalid SKILL.md — ${parsed.error})`) : pc.dim(parsed.description.slice(0, 80));
        console.log(`${pc.bold(s.name)} ${pc.dim(`[${s.agent}/${s.scope}]`)}\n    ${desc}`);
      }
    });
}
