import { Command } from "commander";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { slugify } from "@skillmds/core";
import * as p from "@clack/prompts";

export function skillTemplate(name: string, description: string, license: string): string {
  const desc = description.trim() || `A skill that helps agents with ${name}.`;
  return `---
name: ${name}
description: ${desc}
license: ${license}
---

# ${name}

## When to use this skill

Describe the situations where an agent should reach for this skill. Be specific
about the task, the inputs it expects, and the outcome it produces.

## Instructions

1. First step the agent should take.
2. Second step, with any commands or file paths it needs.
3. How to verify the result.

## Notes

Add any constraints, edge cases, or references the agent should keep in mind.
`;
}

export interface InitOptions {
  dir?: string;
  description?: string;
  license?: string;
}

/** Writes <dir>/<slug>/SKILL.md and returns the file path. */
export function initSkill(name: string, opts: InitOptions = {}): string {
  const slug = slugify(name);
  const root = join(opts.dir ?? process.cwd(), slug);
  if (existsSync(join(root, "SKILL.md"))) throw new Error(`SKILL.md already exists at ${root}`);
  mkdirSync(root, { recursive: true });
  const file = join(root, "SKILL.md");
  writeFileSync(file, skillTemplate(name, opts.description ?? "", opts.license ?? "MIT"), "utf8");
  return file;
}

export function initCommand(): Command {
  return new Command("init")
    .description("Scaffold a new SKILL.md from a template")
    .argument("[name]", "skill name")
    .option("--name <name>", "skill name (non-interactive)")
    .option("--description <text>", "skill description")
    .option("--license <license>", "license identifier", "MIT")
    .option("-y, --yes", "skip prompts")
    .action(async (nameArg: string | undefined, opts: { name?: string; description?: string; license?: string; yes?: boolean }) => {
      let name = nameArg ?? opts.name;
      if (!name && !opts.yes) {
        const answer = await p.text({ message: "Skill name?", placeholder: "my-skill" });
        if (p.isCancel(answer)) { p.cancel("Cancelled."); return; }
        name = answer;
      }
      if (!name) { console.error("A skill name is required (pass a name or --name)."); process.exitCode = 1; return; }
      const file = initSkill(name, { description: opts.description, license: opts.license });
      console.log(`Created ${file}`);
    });
}
