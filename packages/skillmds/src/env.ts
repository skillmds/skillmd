// Where are we running, and how should we talk? Three questions every command
// asks: may I prompt, which agent launched me, and does stdout carry JSON.

export type HostAgent = "claude-code" | "cursor" | "codex" | "gemini-cli" | "ci";

/** Environment variables set by agents that run shell commands on a user's
 *  behalf. Inside one, prompts would hang the agent — behave as if -y. */
export function detectHostAgent(env: NodeJS.ProcessEnv = process.env): HostAgent | null {
  if (env.CLAUDECODE) return "claude-code";
  // CURSOR_TRACE_ID is set for every Cursor terminal, including a human's —
  // only the agent-specific signals count.
  if (env.CURSOR_AGENT || env.CURSOR_EXTENSION_HOST_ROLE === "agent-exec") return "cursor";
  if (env.CODEX_SANDBOX || env.CODEX_THREAD_ID) return "codex";
  if (env.GEMINI_CLI) return "gemini-cli";
  if (env.CI && env.CI !== "false" && env.CI !== "0") return "ci";
  return null;
}

export interface ModeFlags { yes?: boolean; json?: boolean }
export interface Terminal { stdinTTY: boolean; stdoutTTY: boolean; env: NodeJS.ProcessEnv }

export const realTerminal = (): Terminal => ({
  stdinTTY: Boolean(process.stdin.isTTY),
  stdoutTTY: Boolean(process.stdout.isTTY),
  env: process.env,
});

/** May this run open a clack prompt? */
export function isInteractive(flags: ModeFlags, term: Terminal = realTerminal()): boolean {
  if (flags.yes || flags.json) return false;
  if (!term.stdinTTY || !term.stdoutTTY) return false;
  return detectHostAgent(term.env) === null;
}

export interface Reporter {
  readonly json: boolean;
  /** Human text. stdout in human mode, stderr in json mode. */
  info(line: string): void;
  /** Human text always on stderr. */
  warn(line: string): void;
  /** The single machine-readable document (json mode only). */
  result(doc: unknown): void;
}

export function createReporter(
  flags: ModeFlags,
  sinks: { out: (s: string) => void; err: (s: string) => void } = { out: (s) => console.log(s), err: (s) => console.error(s) },
): Reporter {
  const json = Boolean(flags.json);
  let emitted = false;
  return {
    json,
    info(line) { (json ? sinks.err : sinks.out)(line); },
    warn(line) { sinks.err(line); },
    result(doc) {
      if (!json || emitted) return;
      emitted = true;
      sinks.out(JSON.stringify(doc, null, 2));
    },
  };
}

/** Message for a prompt that cannot be shown. Commands print it and exit 1. */
export function nonInteractiveHint(flags: string): string {
  return `Interactive prompt required but stdin is not a terminal. Nothing was changed. Re-run with ${flags} to run non-interactively.`;
}
