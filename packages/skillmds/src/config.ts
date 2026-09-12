// Layered configuration resolution (highest priority first):
//   token: --token flag  →  SKILLMD_TOKEN env  →  ~/.skillmd/config.json (only for its own host)
//   api:   --api flag    →  SKILLMD_API env     →  config.api  →  default production base
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// Default API base — matches bin/skillmd-mcp.mjs so the CLI and the MCP server
// point at the same registry by default.
export const DEFAULT_API = "https://api.skillmd.com";

export interface CliConfig {
  token?: string;
  api?: string;
  /** Host the stored token belongs to. Absent on pre-1.2 configs → default host. */
  tokenHost?: string;
  /** Agents picked at the last interactive install; pre-selected next time. */
  lastAgents?: string[];
}

export interface GlobalFlags {
  token?: string;
  api?: string;
  /** Allow an http:// API base (local development only). */
  insecureHttp?: boolean;
}

export function configPath(home: string = homedir()): string {
  return join(home, ".skillmd", "config.json");
}

export function readConfig(home?: string): CliConfig {
  try {
    return JSON.parse(readFileSync(configPath(home), "utf8")) as CliConfig;
  } catch {
    return {};
  }
}

export function writeConfig(cfg: CliConfig, home: string = homedir()): void {
  mkdirSync(join(home, ".skillmd"), { recursive: true });
  writeFileSync(configPath(home), JSON.stringify(cfg, null, 2), { encoding: "utf8", mode: 0o600 });
}

export function hostOf(url: string): string {
  try { return new URL(url).host; } catch { return url; }
}

export interface ResolveSources { env: NodeJS.ProcessEnv; config: CliConfig }
/** The real environment + on-disk config. Callers that already hold a
 *  ResolveSources (tests, or a client resolving base + token together) pass it
 *  explicitly so the config file is read once — or not at all. */
export const realSources = (): ResolveSources => ({ env: process.env, config: readConfig() });

// `src` is a default parameter, so passing an explicit `undefined` still falls
// back to the real sources — callers can forward an optional override directly.
export function resolveApi(flags: GlobalFlags = {}, src: ResolveSources = realSources()): string {
  const base = (flags.api || src.env.SKILLMD_API || src.config.api || DEFAULT_API).replace(/\/+$/, "");
  if (/^http:\/\//i.test(base) && !flags.insecureHttp) {
    throw new Error(`refusing to use an http:// API base (${base}) — your token would travel unencrypted. Use an https:// base, or pass --insecure-http for local development.`);
  }
  if (!/^https?:\/\//i.test(base)) throw new Error(`API base must be an http(s) URL, got "${base}"`);
  return base;
}

/** A stored token is only ever sent to the host it was saved for. Explicit
 *  --token / SKILLMD_TOKEN are the caller's responsibility and always win. */
export function resolveToken(flags: GlobalFlags = {}, src: ResolveSources = realSources()): string | undefined {
  if (flags.token) return flags.token;
  if (src.env.SKILLMD_TOKEN) return src.env.SKILLMD_TOKEN;
  const stored = src.config.token;
  if (!stored) return undefined;
  const boundTo = src.config.tokenHost ?? hostOf(DEFAULT_API);
  const target = hostOf(resolveApi(flags, src));
  return boundTo === target ? stored : undefined;
}

export function telemetryDisabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const on = (v?: string) => Boolean(v) && v !== "0" && v !== "false";
  return on(env.SKILLMD_NO_TELEMETRY) || on(env.DO_NOT_TRACK);
}
