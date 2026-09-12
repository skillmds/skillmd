// Agent directory resolution + skill writing. Mirrors the scope model of the
// `skills` CLI: project scope writes to ./<project-dir>, global scope to
// ~/<global-dir>. Detection is machine-level (an agent's root config dir under
// $HOME), so `skillmd add` targets every agent the user actually has — not just
// ones that already received a skill once.
//
// The table below is reconciled from two ecosystem references — vercel-labs/skills
// `src/agents.ts` and the ruler agent table — which do not always agree on where
// a given agent reads project skills from. Reconciliation rule: the agent's own
// documented dir wins as the write target; the legacy/alternate roots stay in
// `projectRoots` and `detect` so installs made under the old convention remain
// visible to list/update/remove.
import { mkdirSync, writeFileSync, rmSync, symlinkSync, existsSync, readdirSync, statSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve, dirname, sep } from "node:path";

export interface Agent {
  id: string;
  /** Skills dir segments under the project root. */
  project: string[];
  /** Skills dir segments under the home dir; null = project-only agent. */
  global: string[] | null;
  /** Env var whose value replaces `~/<first global segment>` (e.g. CLAUDE_CONFIG_DIR -> <value>/skills). */
  globalEnv?: string;
  /** Root config dirs under $HOME — any one existing marks the agent installed. */
  detect: string[][];
  /** Project root dirs (first segment) that mark the agent as present in a project — the current one plus legacy ones. */
  projectRoots: string[];
}

/** Cross-agent canonical location; every install writes here once. */
export const CANONICAL = [".agents", "skills"];

// Known agents and their skills directories. Detection only fires for dirs that
// exist, so a long list costs nothing at runtime.
export const AGENTS: Agent[] = [
  { id: "claude-code", project: [".claude", "skills"], global: [".claude", "skills"], globalEnv: "CLAUDE_CONFIG_DIR", detect: [[".claude"]], projectRoots: [".claude"] },
  { id: "cursor", project: [".cursor", "skills"], global: [".cursor", "skills"], detect: [[".cursor"]], projectRoots: [".cursor"] },
  { id: "codex", project: [".agents", "skills"], global: [".codex", "skills"], globalEnv: "CODEX_HOME", detect: [[".codex"]], projectRoots: [".agents", ".codex"] },
  { id: "windsurf", project: [".windsurf", "skills"], global: [".codeium", "windsurf", "skills"], detect: [[".codeium", "windsurf"], [".windsurf"]], projectRoots: [".windsurf"] },
  { id: "opencode", project: [".opencode", "skills"], global: [".config", "opencode", "skills"], detect: [[".config", "opencode"], [".opencode"]], projectRoots: [".opencode"] },
  { id: "gemini-cli", project: [".gemini", "skills"], global: [".gemini", "skills"], detect: [[".gemini"]], projectRoots: [".gemini", ".agents"] },
  { id: "antigravity", project: [".agent", "skills"], global: [".gemini", "antigravity", "skills"], detect: [[".gemini", "antigravity"], [".antigravity"]], projectRoots: [".agent", ".agents"] },
  { id: "kiro", project: [".kiro", "skills"], global: [".kiro", "skills"], detect: [[".kiro"]], projectRoots: [".kiro"] },
  { id: "warp", project: [".agents", "skills"], global: [".agents", "skills"], detect: [[".warp"]], projectRoots: [".agents"] },
  { id: "github-copilot", project: [".claude", "skills"], global: [".copilot", "skills"], detect: [[".copilot"]], projectRoots: [".claude", ".github", ".agents"] },
  { id: "cline", project: [".agents", "skills"], global: [".agents", "skills"], detect: [[".cline"]], projectRoots: [".agents"] },
  { id: "roo", project: [".roo", "skills"], global: [".roo", "skills"], detect: [[".roo"]], projectRoots: [".roo"] },
  { id: "goose", project: [".goose", "skills"], global: [".config", "goose", "skills"], detect: [[".config", "goose"]], projectRoots: [".goose"] },
  { id: "trae", project: [".trae", "skills"], global: [".trae", "skills"], detect: [[".trae"]], projectRoots: [".trae"] },
  { id: "qwen-code", project: [".qwen", "skills"], global: [".qwen", "skills"], detect: [[".qwen"]], projectRoots: [".qwen"] },
  { id: "amp", project: [".agents", "skills"], global: [".config", "agents", "skills"], detect: [[".config", "amp"]], projectRoots: [".agents"] },
  // — extended registry —
  { id: "openclaw", project: ["skills"], global: [".openclaw", "skills"], detect: [[".openclaw"], [".clawdbot"], [".moltbot"]], projectRoots: ["skills"] },
  { id: "kilo", project: [".claude", "skills"], global: [".kilocode", "skills"], detect: [[".kilocode"]], projectRoots: [".claude", ".kilocode"] },
  { id: "hermes-agent", project: [".hermes", "skills"], global: [".hermes", "skills"], detect: [[".hermes"]], projectRoots: [".hermes"] },
  { id: "continue", project: [".continue", "skills"], global: [".continue", "skills"], detect: [[".continue"]], projectRoots: [".continue"] },
  { id: "devin", project: [".devin", "skills"], global: [".config", "devin", "skills"], detect: [[".config", "devin"]], projectRoots: [".devin"] },
  { id: "openhands", project: [".openhands", "skills"], global: [".openhands", "skills"], detect: [[".openhands"]], projectRoots: [".openhands"] },
  { id: "replit", project: [".agents", "skills"], global: [".config", "agents", "skills"], detect: [[".replit"]], projectRoots: [".agents"] },
  { id: "mistral-vibe", project: [".vibe", "skills"], global: [".vibe", "skills"], detect: [[".vibe"]], projectRoots: [".vibe"] },
  { id: "zed", project: [".agents", "skills"], global: [".agents", "skills"], detect: [[".config", "zed"]], projectRoots: [".agents"] },
  { id: "adal", project: [".adal", "skills"], global: [".adal", "skills"], detect: [[".adal"]], projectRoots: [".adal"] },
  { id: "aider-desk", project: [".aider-desk", "skills"], global: [".aider-desk", "skills"], detect: [[".aider-desk"]], projectRoots: [".aider-desk"] },
  { id: "antigravity-cli", project: [".agents", "skills"], global: [".gemini", "antigravity-cli", "skills"], detect: [[".gemini", "antigravity-cli"]], projectRoots: [".agents"] },
  { id: "augment", project: [".augment", "skills"], global: [".augment", "skills"], detect: [[".augment"]], projectRoots: [".augment"] },
  { id: "autohand-code", project: [".autohand", "skills"], global: [".autohand", "skills"], detect: [[".autohand"]], projectRoots: [".autohand"] },
  { id: "bob", project: [".bob", "skills"], global: [".bob", "skills"], detect: [[".bob"]], projectRoots: [".bob"] },
  { id: "codearts-agent", project: [".codeartsdoer", "skills"], global: [".codeartsdoer", "skills"], detect: [[".codeartsdoer"]], projectRoots: [".codeartsdoer"] },
  { id: "codebuddy", project: [".codebuddy", "skills"], global: [".codebuddy", "skills"], detect: [[".codebuddy"]], projectRoots: [".codebuddy"] },
  { id: "codemaker", project: [".codemaker", "skills"], global: [".codemaker", "skills"], detect: [[".codemaker"]], projectRoots: [".codemaker"] },
  { id: "codestudio", project: [".codestudio", "skills"], global: [".codestudio", "skills"], detect: [[".codestudio"]], projectRoots: [".codestudio"] },
  { id: "command-code", project: [".commandcode", "skills"], global: [".commandcode", "skills"], detect: [[".commandcode"]], projectRoots: [".commandcode"] },
  { id: "cortex", project: [".cortex", "skills"], global: [".snowflake", "cortex", "skills"], detect: [[".snowflake", "cortex"]], projectRoots: [".cortex"] },
  { id: "crush", project: [".crush", "skills"], global: [".config", "crush", "skills"], detect: [[".config", "crush"]], projectRoots: [".crush"] },
  { id: "deepagents", project: [".agents", "skills"], global: [".deepagents", "agent", "skills"], detect: [[".deepagents"]], projectRoots: [".agents"] },
  { id: "dexto", project: [".agents", "skills"], global: [".agents", "skills"], detect: [[".dexto"]], projectRoots: [".agents"] },
  { id: "droid", project: [".factory", "skills"], global: [".factory", "skills"], detect: [[".factory"]], projectRoots: [".factory", ".agents"] },
  { id: "firebender", project: [".agents", "skills"], global: [".firebender", "skills"], detect: [[".firebender"]], projectRoots: [".agents"] },
  { id: "forgecode", project: [".forge", "skills"], global: [".forge", "skills"], detect: [[".forge"]], projectRoots: [".forge"] },
  { id: "iflow-cli", project: [".iflow", "skills"], global: [".iflow", "skills"], detect: [[".iflow"]], projectRoots: [".iflow"] },
  { id: "inference-sh", project: [".inferencesh", "skills"], global: [".inferencesh", "skills"], detect: [[".inferencesh"]], projectRoots: [".inferencesh"] },
  { id: "jazz", project: [".jazz", "skills"], global: [".jazz", "skills"], detect: [[".jazz"]], projectRoots: [".jazz"] },
  { id: "junie", project: [".junie", "skills"], global: [".junie", "skills"], detect: [[".junie"]], projectRoots: [".junie"] },
  { id: "kimi-code-cli", project: [".agents", "skills"], global: [".agents", "skills"], detect: [[".kimi-code"], [".kimi"]], projectRoots: [".agents"] },
  { id: "kode", project: [".kode", "skills"], global: [".kode", "skills"], detect: [[".kode"]], projectRoots: [".kode"] },
  { id: "lingma", project: [".lingma", "skills"], global: [".lingma", "skills"], detect: [[".lingma"]], projectRoots: [".lingma"] },
  { id: "loaf", project: [".agents", "skills"], global: [".agents", "skills"], detect: [[".loaf"]], projectRoots: [".agents"] },
  { id: "mcpjam", project: [".mcpjam", "skills"], global: [".mcpjam", "skills"], detect: [[".mcpjam"]], projectRoots: [".mcpjam"] },
  { id: "moxby", project: [".moxby", "skills"], global: [".moxby", "skills"], detect: [[".moxby"]], projectRoots: [".moxby"] },
  { id: "mux", project: [".mux", "skills"], global: [".mux", "skills"], detect: [[".mux"]], projectRoots: [".mux"] },
  { id: "neovate", project: [".neovate", "skills"], global: [".neovate", "skills"], detect: [[".neovate"]], projectRoots: [".neovate"] },
  { id: "ona", project: [".ona", "skills"], global: [".ona", "skills"], detect: [[".ona"]], projectRoots: [".ona"] },
  { id: "pi", project: [".pi", "skills"], global: [".pi", "agent", "skills"], detect: [[".pi", "agent"]], projectRoots: [".pi"] },
  { id: "pochi", project: [".pochi", "skills"], global: [".pochi", "skills"], detect: [[".pochi"]], projectRoots: [".pochi"] },
  { id: "qoder", project: [".qoder", "skills"], global: [".qoder", "skills"], detect: [[".qoder"]], projectRoots: [".qoder"] },
  { id: "qoder-cn", project: [".qoder", "skills"], global: [".qoder-cn", "skills"], detect: [[".qoder-cn"]], projectRoots: [".qoder"] },
  { id: "reasonix", project: [".reasonix", "skills"], global: [".reasonix", "skills"], detect: [[".reasonix"]], projectRoots: [".reasonix"] },
  { id: "rovodev", project: [".rovodev", "skills"], global: [".rovodev", "skills"], detect: [[".rovodev"]], projectRoots: [".rovodev"] },
  { id: "tabnine-cli", project: [".tabnine", "agent", "skills"], global: [".tabnine", "agent", "skills"], detect: [[".tabnine"]], projectRoots: [".tabnine"] },
  { id: "terramind", project: [".terramind", "skills"], global: [".terramind", "skills"], detect: [[".terramind"]], projectRoots: [".terramind"] },
  { id: "tinycloud", project: [".tinycloud", "skills"], global: [".tinycloud", "skills"], detect: [[".tinycloud"]], projectRoots: [".tinycloud"] },
  { id: "trae-cn", project: [".trae", "skills"], global: [".trae-cn", "skills"], detect: [[".trae-cn"]], projectRoots: [".trae"] },
  { id: "zcode", project: [".zcode", "skills"], global: [".zcode", "skills"], detect: [[".zcode"]], projectRoots: [".zcode"] },
  { id: "zencoder", project: [".zencoder", "skills"], global: [".zencoder", "skills"], detect: [[".zencoder"]], projectRoots: [".zencoder"] },
  // — project-only agents (no documented global skills dir) —
  { id: "eve", project: ["agent", "skills"], global: null, detect: [[".eve"]], projectRoots: ["agent"] },
  { id: "promptscript", project: [".agents", "skills"], global: null, detect: [[".promptscript"]], projectRoots: [".agents"] },
];

export interface ScopeOptions {
  global?: boolean;
  /** Project root for project scope (defaults to cwd). */
  cwd?: string;
  /** Home dir override (tests). */
  home?: string;
  /** Injected for tests. */
  env?: NodeJS.ProcessEnv;
}

export function canonicalDir(opts: ScopeOptions = {}): string {
  return opts.global ? join(opts.home ?? homedir(), ...CANONICAL) : join(opts.cwd ?? process.cwd(), ...CANONICAL);
}

export function agentById(id: string): Agent {
  const agent = AGENTS.find((a) => a.id === id);
  if (!agent) throw new Error(`Unknown agent: ${id}. Known: ${AGENTS.map((a) => a.id).join(", ")}`);
  return agent;
}

export function agentSupportsGlobal(id: string): boolean {
  return agentById(id).global !== null;
}

export function agentDir(agentId: string, opts: ScopeOptions = {}): string {
  const agent = agentById(agentId);
  if (!opts.global) return join(opts.cwd ?? process.cwd(), ...agent.project);
  if (agent.global === null) throw new Error(`${agent.id} does not support global installs (project-only agent)`);
  const env = opts.env ?? process.env;
  const override = agent.globalEnv ? env[agent.globalEnv] : undefined;
  if (override) return join(override, ...agent.global.slice(1));
  return join(opts.home ?? homedir(), ...agent.global);
}

/** Is this agent already present in the project (so writing its dir is not litter)? */
export function agentRootExists(agentId: string, cwd: string): boolean {
  return agentById(agentId).projectRoots.some((r) => existsSync(join(cwd, r)));
}

/** Detect which known agents are installed on this machine (their root config
 *  dir exists under $HOME). Scope-independent: knowing you use Cursor is a
 *  machine-level fact; where the skill lands is decided by agentDir(). */
export function detectAgents(opts: ScopeOptions = {}): string[] {
  const home = opts.home ?? homedir();
  return AGENTS.filter((a) => a.detect.some((d) => existsSync(join(home, ...d)))).map((a) => a.id);
}

export interface SkillFileInput {
  /** Path relative to the skill root, e.g. "SKILL.md". */
  path: string;
  contents: string | Buffer;
}

/**
 * Write a skill (one or more files) into <agentDir>/<skillName>.
 * mode "copy" writes file contents; "symlink" links to a canonical copy.
 */
export function writeSkill(
  skillName: string,
  files: SkillFileInput[],
  targetDir: string,
  opts: { mode?: "copy" | "symlink"; canonicalDir?: string } = {},
): string {
  // The skill name becomes a directory under targetDir. A hostile source
  // (GitHub repo / local path) could carry a name like "../../evil" that
  // escapes targetDir before the per-file zip-slip guard below even applies.
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(skillName) || skillName.includes("..")) {
    throw new Error(`refused unsafe skill name: "${skillName}"`);
  }
  const dest = join(targetDir, skillName);
  if (opts.mode === "symlink" && opts.canonicalDir) {
    mkdirSync(dirname(dest), { recursive: true });
    rmSync(dest, { recursive: true, force: true });
    symlinkSync(resolve(opts.canonicalDir), dest, "dir");
    return dest;
  }
  mkdirSync(dest, { recursive: true });
  const root = resolve(dest);
  for (const f of files) {
    // Zip-slip guard: a hostile pack could carry paths like "../../etc" — refuse
    // anything that resolves outside the skill's own directory.
    const fp = resolve(dest, f.path);
    if (fp !== root && !fp.startsWith(root + sep)) {
      throw new Error(`refused unsafe path in skill "${skillName}": ${f.path}`);
    }
    mkdirSync(dirname(fp), { recursive: true });
    writeFileSync(fp, f.contents);
  }
  return dest;
}

export interface InstalledSkill {
  name: string;
  agent: string;
  scope: "global" | "project";
  path: string;
  raw: string;
}

/** Enumerate installed skills across known agent dirs (reads each SKILL.md).
 *  Agents sharing a dir (the `.agents/skills` convention) are deduped — each
 *  physical skill is reported once, under the first agent claiming the dir. */
export function installedSkills(opts: ScopeOptions = {}): InstalledSkill[] {
  const scope: "global" | "project" = opts.global ? "global" : "project";
  const out: InstalledSkill[] = [];
  const seen = new Set<string>();
  for (const agent of AGENTS) {
    if (opts.global && agent.global === null) continue;
    const dir = agentDir(agent.id, opts);
    if (seen.has(dir)) continue;
    seen.add(dir);
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir)) {
      const skillMd = join(dir, entry, "SKILL.md");
      if (!existsSync(skillMd) || !statSync(skillMd).isFile()) continue;
      out.push({ name: entry, agent: agent.id, scope, path: join(dir, entry), raw: readFileSync(skillMd, "utf8") });
    }
  }
  return out;
}
