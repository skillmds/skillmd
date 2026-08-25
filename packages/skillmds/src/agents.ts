// Agent directory resolution + skill writing. Mirrors the scope model of the
// `skills` CLI: project scope writes to ./<project-dir>, global scope to
// ~/<global-dir>. Detection is machine-level (an agent's root config dir under
// $HOME), so `skillmd add` targets every agent the user actually has — not just
// ones that already received a skill once.
import { mkdirSync, writeFileSync, rmSync, symlinkSync, existsSync, readdirSync, statSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve, dirname, sep } from "node:path";

export interface Agent {
  id: string;
  /** Skills dir segments under the project root (project scope). */
  project: string[];
  /** Skills dir segments under the home dir (global scope). */
  global: string[];
  /** Root config dirs under $HOME — any one existing marks the agent installed. */
  detect: string[][];
}

// Known agents and their skills directories. Directory conventions follow the
// cross-agent ecosystem: many agents share the `.agents/skills` convention; the
// original five keep their historical project dirs so existing installs stay
// visible to list/remove/update. Detection only fires for dirs that exist, so
// a long list costs nothing at runtime.
export const AGENTS: Agent[] = [
  { id: "claude-code", project: [".claude", "skills"], global: [".claude", "skills"], detect: [[".claude"]] },
  { id: "cursor", project: [".cursor", "skills"], global: [".cursor", "skills"], detect: [[".cursor"]] },
  { id: "codex", project: [".codex", "skills"], global: [".codex", "skills"], detect: [[".codex"]] },
  { id: "windsurf", project: [".windsurf", "skills"], global: [".codeium", "windsurf", "skills"], detect: [[".codeium", "windsurf"], [".windsurf"]] },
  { id: "opencode", project: [".opencode", "skills"], global: [".config", "opencode", "skills"], detect: [[".config", "opencode"], [".opencode"]] },
  { id: "gemini-cli", project: [".agents", "skills"], global: [".gemini", "skills"], detect: [[".gemini"]] },
  { id: "antigravity", project: [".agents", "skills"], global: [".gemini", "antigravity", "skills"], detect: [[".gemini", "antigravity"], [".antigravity"]] },
  { id: "kiro", project: [".kiro", "skills"], global: [".kiro", "skills"], detect: [[".kiro"]] },
  { id: "warp", project: [".agents", "skills"], global: [".agents", "skills"], detect: [[".warp"]] },
  { id: "github-copilot", project: [".agents", "skills"], global: [".copilot", "skills"], detect: [[".copilot"]] },
  { id: "cline", project: [".agents", "skills"], global: [".agents", "skills"], detect: [[".cline"]] },
  { id: "roo", project: [".roo", "skills"], global: [".roo", "skills"], detect: [[".roo"]] },
  { id: "goose", project: [".goose", "skills"], global: [".config", "goose", "skills"], detect: [[".config", "goose"]] },
  { id: "trae", project: [".trae", "skills"], global: [".trae", "skills"], detect: [[".trae"]] },
  { id: "qwen-code", project: [".qwen", "skills"], global: [".qwen", "skills"], detect: [[".qwen"]] },
  { id: "amp", project: [".agents", "skills"], global: [".config", "agents", "skills"], detect: [[".config", "amp"]] },
  // — extended registry —
  { id: "openclaw", project: ["skills"], global: [".openclaw", "skills"], detect: [[".openclaw"], [".clawdbot"], [".moltbot"]] },
  { id: "kilo", project: [".kilocode", "skills"], global: [".kilocode", "skills"], detect: [[".kilocode"]] },
  { id: "hermes-agent", project: [".hermes", "skills"], global: [".hermes", "skills"], detect: [[".hermes"]] },
  { id: "continue", project: [".continue", "skills"], global: [".continue", "skills"], detect: [[".continue"]] },
  { id: "devin", project: [".devin", "skills"], global: [".config", "devin", "skills"], detect: [[".config", "devin"]] },
  { id: "openhands", project: [".openhands", "skills"], global: [".openhands", "skills"], detect: [[".openhands"]] },
  { id: "replit", project: [".agents", "skills"], global: [".config", "agents", "skills"], detect: [[".replit"]] },
  { id: "mistral-vibe", project: [".vibe", "skills"], global: [".vibe", "skills"], detect: [[".vibe"]] },
  { id: "zed", project: [".agents", "skills"], global: [".agents", "skills"], detect: [[".config", "zed"]] },
  { id: "adal", project: [".adal", "skills"], global: [".adal", "skills"], detect: [[".adal"]] },
  { id: "aider-desk", project: [".aider-desk", "skills"], global: [".aider-desk", "skills"], detect: [[".aider-desk"]] },
  { id: "antigravity-cli", project: [".agents", "skills"], global: [".gemini", "antigravity-cli", "skills"], detect: [[".gemini", "antigravity-cli"]] },
  { id: "augment", project: [".augment", "skills"], global: [".augment", "skills"], detect: [[".augment"]] },
  { id: "autohand-code", project: [".autohand", "skills"], global: [".autohand", "skills"], detect: [[".autohand"]] },
  { id: "bob", project: [".bob", "skills"], global: [".bob", "skills"], detect: [[".bob"]] },
  { id: "codearts-agent", project: [".codeartsdoer", "skills"], global: [".codeartsdoer", "skills"], detect: [[".codeartsdoer"]] },
  { id: "codebuddy", project: [".codebuddy", "skills"], global: [".codebuddy", "skills"], detect: [[".codebuddy"]] },
  { id: "codemaker", project: [".codemaker", "skills"], global: [".codemaker", "skills"], detect: [[".codemaker"]] },
  { id: "codestudio", project: [".codestudio", "skills"], global: [".codestudio", "skills"], detect: [[".codestudio"]] },
  { id: "command-code", project: [".commandcode", "skills"], global: [".commandcode", "skills"], detect: [[".commandcode"]] },
  { id: "cortex", project: [".cortex", "skills"], global: [".snowflake", "cortex", "skills"], detect: [[".snowflake", "cortex"]] },
  { id: "crush", project: [".crush", "skills"], global: [".config", "crush", "skills"], detect: [[".config", "crush"]] },
  { id: "deepagents", project: [".agents", "skills"], global: [".deepagents", "agent", "skills"], detect: [[".deepagents"]] },
  { id: "dexto", project: [".agents", "skills"], global: [".agents", "skills"], detect: [[".dexto"]] },
  { id: "droid", project: [".factory", "skills"], global: [".factory", "skills"], detect: [[".factory"]] },
  { id: "firebender", project: [".agents", "skills"], global: [".firebender", "skills"], detect: [[".firebender"]] },
  { id: "forgecode", project: [".forge", "skills"], global: [".forge", "skills"], detect: [[".forge"]] },
  { id: "iflow-cli", project: [".iflow", "skills"], global: [".iflow", "skills"], detect: [[".iflow"]] },
  { id: "inference-sh", project: [".inferencesh", "skills"], global: [".inferencesh", "skills"], detect: [[".inferencesh"]] },
  { id: "jazz", project: [".jazz", "skills"], global: [".jazz", "skills"], detect: [[".jazz"]] },
  { id: "junie", project: [".junie", "skills"], global: [".junie", "skills"], detect: [[".junie"]] },
  { id: "kimi-code-cli", project: [".agents", "skills"], global: [".agents", "skills"], detect: [[".kimi-code"], [".kimi"]] },
  { id: "kode", project: [".kode", "skills"], global: [".kode", "skills"], detect: [[".kode"]] },
  { id: "lingma", project: [".lingma", "skills"], global: [".lingma", "skills"], detect: [[".lingma"]] },
  { id: "loaf", project: [".agents", "skills"], global: [".agents", "skills"], detect: [[".loaf"]] },
  { id: "mcpjam", project: [".mcpjam", "skills"], global: [".mcpjam", "skills"], detect: [[".mcpjam"]] },
  { id: "moxby", project: [".moxby", "skills"], global: [".moxby", "skills"], detect: [[".moxby"]] },
  { id: "mux", project: [".mux", "skills"], global: [".mux", "skills"], detect: [[".mux"]] },
  { id: "neovate", project: [".neovate", "skills"], global: [".neovate", "skills"], detect: [[".neovate"]] },
  { id: "ona", project: [".ona", "skills"], global: [".ona", "skills"], detect: [[".ona"]] },
  { id: "pi", project: [".pi", "skills"], global: [".pi", "agent", "skills"], detect: [[".pi", "agent"]] },
  { id: "pochi", project: [".pochi", "skills"], global: [".pochi", "skills"], detect: [[".pochi"]] },
  { id: "qoder", project: [".qoder", "skills"], global: [".qoder", "skills"], detect: [[".qoder"]] },
  { id: "qoder-cn", project: [".qoder", "skills"], global: [".qoder-cn", "skills"], detect: [[".qoder-cn"]] },
  { id: "reasonix", project: [".reasonix", "skills"], global: [".reasonix", "skills"], detect: [[".reasonix"]] },
  { id: "rovodev", project: [".rovodev", "skills"], global: [".rovodev", "skills"], detect: [[".rovodev"]] },
  { id: "tabnine-cli", project: [".tabnine", "agent", "skills"], global: [".tabnine", "agent", "skills"], detect: [[".tabnine"]] },
  { id: "terramind", project: [".terramind", "skills"], global: [".terramind", "skills"], detect: [[".terramind"]] },
  { id: "tinycloud", project: [".tinycloud", "skills"], global: [".tinycloud", "skills"], detect: [[".tinycloud"]] },
  { id: "trae-cn", project: [".trae", "skills"], global: [".trae-cn", "skills"], detect: [[".trae-cn"]] },
  { id: "zcode", project: [".zcode", "skills"], global: [".zcode", "skills"], detect: [[".zcode"]] },
  { id: "zencoder", project: [".zencoder", "skills"], global: [".zencoder", "skills"], detect: [[".zencoder"]] },
];

export interface ScopeOptions {
  global?: boolean;
  /** Project root for project scope (defaults to cwd). */
  cwd?: string;
  /** Home dir override (tests). */
  home?: string;
}

export function agentDir(agentId: string, opts: ScopeOptions = {}): string {
  const agent = AGENTS.find((a) => a.id === agentId);
  if (!agent) throw new Error(`Unknown agent: ${agentId}. Known: ${AGENTS.map((a) => a.id).join(", ")}`);
  return opts.global
    ? join(opts.home ?? homedir(), ...agent.global)
    : join(opts.cwd ?? process.cwd(), ...agent.project);
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
