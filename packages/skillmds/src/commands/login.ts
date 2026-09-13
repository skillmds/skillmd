import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { readConfig, writeConfig, configPath, hostOf, resolveApi } from "../config.js";
import { promptIf, nonInteractiveHint } from "../env.js";

export interface LoginFlags {
  token?: string;
  api?: string;
  /** Allow an http:// API base (local development only). */
  insecureHttp?: boolean;
  json?: boolean;
  /** Home directory holding ~/.skillmd/config.json. Tests pass a temp dir. */
  home?: string;
  env?: NodeJS.ProcessEnv;
}

/** Everything that needs a terminal, injected so the command stays testable. */
export interface LoginDeps {
  /** Resolves to the token, or null when the user cancelled. Absent = cannot ask. */
  prompt?: () => Promise<string | null>;
}

export interface CmdResult { exitCode: 0 | 1; output: string }

const defaultLoginDeps = (flags: LoginFlags): LoginDeps =>
  promptIf(flags, async () => {
    const answer = await p.password({ message: "Paste your SkillMD token (from your account page)" });
    return p.isCancel(answer) ? null : answer;
  });

export async function runLogin(flags: LoginFlags, deps: LoginDeps = defaultLoginDeps(flags)): Promise<CmdResult> {
  const env = flags.env ?? process.env;
  let token = flags.token;
  if (!token) {
    // Off a TTY (a pipe, CI, or an agent shell) a prompt would hang forever —
    // say what to pass instead and change nothing.
    if (!deps.prompt) return { exitCode: 1, output: pc.red(nonInteractiveHint("--token <token> (or set SKILLMD_TOKEN)")) };
    const answer = await deps.prompt();
    if (answer === null) return { exitCode: 0, output: pc.dim("Cancelled.") };
    token = answer;
  }
  if (!token) return { exitCode: 1, output: pc.red("A token is required.") };

  const cfg = readConfig(flags.home);
  // Bind the token to the host it was issued for — it is never sent anywhere
  // else. Resolve through the same chain the client uses (flag → SKILLMD_API
  // → config → default) so the binding can't miss an env override, and so an
  // http:// base is refused here rather than at the first authenticated call.
  let host: string;
  try {
    host = hostOf(resolveApi({ api: flags.api, insecureHttp: flags.insecureHttp }, { env, config: { ...cfg, api: flags.api ?? cfg.api } }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { exitCode: 1, output: flags.json ? JSON.stringify({ ok: false, error: msg }, null, 2) : pc.red(msg) };
  }

  cfg.token = token;
  if (flags.api) cfg.api = flags.api;
  cfg.tokenHost = host;
  writeConfig(cfg, flags.home);
  const file = configPath(flags.home);
  return {
    exitCode: 0,
    output: flags.json ? JSON.stringify({ ok: true, file, host }, null, 2) : `Saved token for ${host} to ${file}`,
  };
}

export function runLogout(flags: { json?: boolean; home?: string }): CmdResult {
  const cfg = readConfig(flags.home);
  const had = Boolean(cfg.token);
  delete cfg.token;
  delete cfg.tokenHost;
  writeConfig(cfg, flags.home);
  return {
    exitCode: 0,
    output: flags.json ? JSON.stringify({ ok: true, removed: had }, null, 2) : had ? "Removed stored token." : "No stored token.",
  };
}

export function loginCommand(): Command {
  return new Command("login")
    .description("Store a SkillMD personal access token for publishing (prefer this or SKILLMD_TOKEN over --token)")
    .option("--token <token>", "token to store (otherwise prompt)")
    .option("--api <url>", "registry API base to store")
    .option("--json", "machine-readable output")
    .action(async (opts: LoginFlags, cmd: Command) => {
      const r = await runLogin({ ...(cmd.parent?.opts() as LoginFlags | undefined), ...opts });
      console.log(r.output);
      process.exitCode = r.exitCode;
    });
}

export function logoutCommand(): Command {
  return new Command("logout")
    .description("Remove the stored SkillMD token")
    .option("--json", "machine-readable output")
    .action((opts: { json?: boolean }, cmd: Command) => {
      const r = runLogout({ ...(cmd.parent?.opts() as { json?: boolean } | undefined), ...opts });
      console.log(r.output);
      process.exitCode = r.exitCode;
    });
}
