// What counts as "a project" for scope auto-detection. Lives outside the
// command layer so the MCP server can answer the same question without
// dragging commander and @clack/prompts into its entry chunk.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { AGENTS } from "./agents.js";

/** Files or dirs whose presence marks a directory as a project root. Mirrors the
 *  `skills` CLI's auto-detect rule ("project if in a project, else global"). */
const PROJECT_MARKERS = [".git", "package.json", "pyproject.toml", "Cargo.toml", "go.mod", "AGENTS.md", "CLAUDE.md", "skills-lock.json"];

/** Every dot-directory that marks an agent as present in a project, current and
 *  legacy alike (`.codex`, `.kilocode`, …). Non-dot roots (`agent`, `skills`) are
 *  too generic to imply "this is a project". */
const AGENT_PROJECT_ROOTS = [...new Set(AGENTS.flatMap((a) => a.projectRoots))].filter((r) => r.startsWith("."));

/** Does `dir` look like a project root? True when it carries a common project
 *  marker or already has an agent's dot-directory (`.claude`, `.cursor`, `.agents`, …). */
export function looksLikeProject(dir: string): boolean {
  if (PROJECT_MARKERS.some((m) => existsSync(join(dir, m)))) return true;
  return AGENT_PROJECT_ROOTS.some((seg) => existsSync(join(dir, seg)));
}
