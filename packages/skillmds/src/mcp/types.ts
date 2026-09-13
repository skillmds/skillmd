// The small shared vocabulary of the MCP surface: what a tool is handed, what
// it hands back, how it refuses, and how it reads a slug. It lives in its own
// module because tools.ts calls install.ts — so install.ts importing these back
// out of tools.ts would close a cycle around the one module that writes files.
// tools.ts re-exports everything here, so callers can keep importing from it.

/** Everything a tool needs from the outside world. The MCP server builds one
 *  from the shared CLI client; tests build one by hand. */
export interface ToolContext {
  api: <T = unknown>(path: string, init?: RequestInit) => Promise<T>;
  hasToken: boolean;
  base: string;
  token?: string;
  cwd?: string;
  home?: string;
  env?: NodeJS.ProcessEnv;
}

export interface ToolResult {
  content: { type: "text"; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

/** A human-readable refusal/notice: text only, flagged as an error so clients
 *  do not expect structuredContent for it. */
export const notice = (msg: string): ToolResult => ({ isError: true, content: [{ type: "text", text: msg }] });

/** owner/name, in the registry's slugify alphabet only — the name becomes a
 *  directory in skillmd_install, so anything else is refused up front. One
 *  reading for every tool: a slug skillmd_get accepts is a slug skillmd_install
 *  accepts, and neither can be talked into a path separator or a "..". */
export function parseSlug(slug: unknown): [string, string] | null {
  const m = String(slug ?? "").match(/^([a-z0-9][a-z0-9-]*)\/([a-z0-9][a-z0-9-]*)$/i);
  return m ? [m[1]!, m[2]!] : null;
}
