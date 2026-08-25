// Layered configuration resolution (highest priority first):
//   token: --token flag  →  SKILLMD_TOKEN env  →  ~/.skillmd/config.json
//   api:   --api flag    →  SKILLMD_API env     →  default production base
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// Default API base — matches bin/skillmd-mcp.mjs so the CLI and the MCP server
// point at the same registry by default.
export const DEFAULT_API = "https://api.skillmd.com";

export interface CliConfig {
  token?: string;
  api?: string;
}

export interface GlobalFlags {
  token?: string;
  api?: string;
}

export function configPath(): string {
  return join(homedir(), ".skillmd", "config.json");
}

export function readConfig(): CliConfig {
  try {
    return JSON.parse(readFileSync(configPath(), "utf8")) as CliConfig;
  } catch {
    return {};
  }
}

export function writeConfig(cfg: CliConfig): void {
  const dir = join(homedir(), ".skillmd");
  mkdirSync(dir, { recursive: true });
  writeFileSync(configPath(), JSON.stringify(cfg, null, 2), { encoding: "utf8", mode: 0o600 });
}

export function resolveToken(flags: GlobalFlags = {}): string | undefined {
  return flags.token || process.env.SKILLMD_TOKEN || readConfig().token || undefined;
}

export function resolveApi(flags: GlobalFlags = {}): string {
  return flags.api || process.env.SKILLMD_API || readConfig().api || DEFAULT_API;
}
