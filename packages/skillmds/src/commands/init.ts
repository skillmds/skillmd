import { Command } from "commander";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { slugify } from "@skillmds/core";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { promptIf, nonInteractiveHint } from "../env.js";

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

export interface InitFlags {
  name?: string;
  description?: string;
  license?: string;
  yes?: boolean;
  json?: boolean;
  dir?: string;
  env?: NodeJS.ProcessEnv;
}

/** The one thing that needs a terminal, injected so the command stays testable. */
export interface InitDeps {
  /** Resolves to the name, or null when the user cancelled. Absent = cannot ask. */
  prompt?: () => Promise<string | null>;
}

const defaultInitDeps = (flags: InitFlags): InitDeps =>
  promptIf(flags, async () => {
    const answer = await p.text({ message: "Skill name?", placeholder: "my-skill" });
    return p.isCancel(answer) ? null : answer;
  });

export interface InitResult { exitCode: 0 | 1; output: string; file?: string }

/** In --json mode stdout carries one document and nothing else: every early
 *  return goes through here so a hint or a cancellation never leaks plain text
 *  into output a caller is parsing. */
function finish(flags: InitFlags, result: InitResult, doc: unknown): InitResult {
  return flags.json ? { ...result, output: JSON.stringify(doc, null, 2) } : result;
}

export async function runInit(
  nameArg: string | undefined,
  flags: InitFlags,
  deps: InitDeps = defaultInitDeps(flags),
): Promise<InitResult> {
  let name = nameArg ?? flags.name;
  if (!name) {
    // Off a TTY (a pipe, CI, or an agent shell) a prompt would hang forever —
    // say what to pass instead and write nothing.
    if (!deps.prompt) {
      const error = nonInteractiveHint("a name argument or --name <name>");
      return finish(flags, { exitCode: 1, output: pc.red(error) }, { ok: false, error });
    }
    const answer = await deps.prompt();
    if (answer === null) return finish(flags, { exitCode: 0, output: pc.dim("Cancelled.") }, { ok: false, cancelled: true });
    name = answer;
  }
  if (!name) {
    const error = "A skill name is required (pass a name or --name).";
    return finish(flags, { exitCode: 1, output: pc.red(error) }, { ok: false, error });
  }
  try {
    const file = initSkill(name, { dir: flags.dir, description: flags.description, license: flags.license });
    return { exitCode: 0, file, output: flags.json ? JSON.stringify({ ok: true, file }, null, 2) : `Created ${file}` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { exitCode: 1, output: flags.json ? JSON.stringify({ ok: false, error: msg }, null, 2) : pc.red(msg) };
  }
}

export function initCommand(): Command {
  return new Command("init")
    .description("Scaffold a new SKILL.md from a template")
    .argument("[name]", "skill name")
    .option("--name <name>", "skill name (non-interactive)")
    .option("--description <text>", "skill description")
    .option("--license <license>", "license identifier", "MIT")
    .option("--json", "machine-readable output")
    .option("-y, --yes", "skip prompts")
    .action(async (nameArg: string | undefined, opts: InitFlags, cmd: Command) => {
      const r = await runInit(nameArg, { ...(cmd.parent?.opts() as InitFlags | undefined), ...opts });
      console.log(r.output);
      process.exitCode = r.exitCode;
    });
}
