# Changelog

All notable changes to `skillmds` are documented here. Versions follow [semver](https://semver.org).

## 1.1.1

- Releases are now published through npm Trusted Publishing (OIDC from GitHub Actions) with provenance; no long-lived npm tokens exist for this package.
- README: links to the registry's browse surfaces (search, categories, publishers, per-agent install guides, docs, stats) so the npm page points at where the skills live.
- No CLI or MCP behavior changes.

## 1.1.0

- **Open source.** `skillmds` now develops in the open at [github.com/skillmds/skillmd](https://github.com/skillmds/skillmd), and a MIT `LICENSE` file ships in the package (the manifest always claimed MIT; now the text does too).
- **The validation engine is its own package.** The lint/security/quality engine is published as [`@skillmds/core`](https://www.npmjs.com/package/@skillmds/core) and consumed as a regular dependency. The bundled `vendor/` copy is gone — anything that deep-imported `skillmds/vendor/index.js` (an undocumented internal) should import `@skillmds/core` instead.
- MCP setup snippets standardize on the server alias `skillmd` (`claude mcp add skillmd -- npx -y skillmds`). Existing configs with other aliases keep working — the alias is client-side.
- README correction: registry installs have not been gated on verification since 1.0.16.
- No CLI or MCP behavior changes.

## 1.0.21

- **No more `tar@6` deprecation warning on install.** Upgraded `giget` 1.x → 3.x, whose GitHub downloads no longer depend on the deprecated (and CVE-flagged) `tar@6.2.1`. The `skillmds` dependency tree is now tar-free; download behavior (`skillmd add <github url>`, pack fallbacks) is unchanged.

## 1.0.20

- **`skillmd add` now installs to every agent on your machine.** Detection is machine-level (an agent's config dir under your home, e.g. `~/.cursor`), so agents no longer need a pre-existing `skills/` folder to be targeted. The agent registry grows from 5 to **60+**: Gemini CLI, Antigravity, Kiro, Warp, GitHub Copilot, Cline, Roo Code, Goose, Trae, Qwen Code, Amp, OpenClaw, Kilo Code, Hermes (Nous Research), Continue, Devin, OpenHands, Replit, Mistral Vibe, Zed, Kimi Code, Droid (Factory), Crush, Augment, Junie, and more — with per-agent dirs matching each agent's own convention (`~/.codeium/windsurf/skills` for Windsurf, `~/.gemini/antigravity/skills` for Antigravity, etc.). Agents sharing the cross-agent `.agents/skills` convention are written once and labelled with every agent they serve. `-a/--agent` still overrides.
- Running from your home directory now behaves like `--global` (project scope rooted at `$HOME` *is* the global scope), so agents whose global skills live outside `~/<agent>/skills` get the right directory.

## 1.0.19

- **Clear diagnostics when the registry is blocked.** In sandboxed or proxied environments that deny network egress to `api.skillmd.com`, `skillmd add owner/name` used to fall back to GitHub and surface a misleading "repo not found" error. The CLI now tells 404 ("not in the registry" — GitHub fallback proceeds as before) apart from unreachable (DNS failure, proxy 403, 5xx): if the GitHub fallback also fails, the error names the blocked registry and says what fixes it (allowlist `api.skillmd.com`, or install via the SkillMD MCP server); if the fallback succeeds, a warning notes the copy came from GitHub, not the registry.

## 1.0.18

- **Cleaner tool output for agents.** `skillmd_search`, `skillmd_trending`, and `skillmd_recommend` no longer echo site-oriented fields (`avg_rating`, `rating_count`, `install_count`, `save_count`, `verified`, `type`, `owner_avatar`, `category_slug`, and the internal `confident` ranker flag). Results now carry just what an agent needs to pick a skill: slug, title, description, category, agents, repo stars, and the install snippet.
- **Quality score no longer punishes ordinary skills.** The security flags (`reads_secrets`, `network_calls`, `executes_scripts`) are pattern matches against prose and code samples, not proof of anything unsafe — they now cost 2/1/5 points respectively (was 25/8/15), so a skill that merely documents an env var or a URL keeps its high score. Verified skills are floored at 85 (unless the content fails to parse). `skillmd_lint` passes a skill's verified status through to the score.

## 1.0.16

- **Installs are no longer gated on verification.** Any skill installs directly — verified or not — with no flag, no prompt, and no second step, from both the CLI (`skillmd add`) and the MCP `skillmd_install` tool. Security flags (network_calls, executes_scripts, reads_secrets, docs_only) are still shown on the result as information, but never block. `--deny <flag>` remains available as an opt-in for anyone who wants to exclude a flag; `--allow-unverified` is now a no-op kept for backward compatibility.

## 1.0.15

- Search is now **browsable in the interactive menu**: arrow through results, press Enter on one to see a card, and install it to your project or user directory — all without leaving the CLI (`← Back` at each level; Esc goes up one step, never quits).
- Search results are clean two-line entries showing the source repo's **star count** (e.g. `★ 223.7k`) instead of the placeholder rating, with the description truncated to fit your terminal.
- Fixes for narrow terminals: result rows are width-budgeted so they don't wrap and garble the menu; the result card prints once instead of repainting on every action.

## 1.0.14

- Interactive menu (`skillmds` in a terminal) no longer exits after one action — it returns to the menu until you pick **Quit**; cancelling a sub-prompt goes back to the menu instead of quitting.
- "List installed skills" now shows project **and** global skills together, tagged `[agent/scope]`, replacing the misleading "Include global skills?" prompt (which actually toggled global-only vs project-only). Invalid skills show the parse reason.
- The in-menu command reference now includes `info`.

## 1.0.13

Safe & easy installs release.

- **Packs install their full file tree.** `skillmd add owner/pack` now downloads the pack's source directory (pinned to the registry's commit; falls back to the default branch with a warning if the pin is gone upstream), so `assets/` and `references/` files referenced by SKILL.md actually exist. Hardened: symlinks are skipped, 200-file/20MB caps, temp dirs cleaned up.
- **Unverified skills prompt instead of hard-blocking.** Interactive installs show the lint score and security flags and ask before installing; non-interactive installs (and `-y`) still require the explicit `--allow-unverified`. Blocked output links the skill's page for review.
- **New `skillmd info <slug>`** shows verification status, security flags, rating, provenance (source repo @ commit), and the install snippet. Unknown subcommands now print a proper error instead of silently starting the MCP server.
- **MCP `skillmd_install` gained the CLI's safety gates**: refuses unverified skills unless `allow_unverified: true` (only after explicit human approval), validates before writing, reports security flags, and guards against malformed skill names.
- **Installs are exact.** The registry now stores the published SKILL.md verbatim (`raw_md`) and installs deliver it byte-for-byte; reconstructed frontmatter (legacy rows) is YAML-quoted so descriptions with `:`/`#`/quotes can't corrupt the file.
- Description limit aligned with Claude Code's real spec (1024 chars, was 500) — valid skills are no longer flagged "(invalid SKILL.md)" by `skillmd list`, and `list` now says *why* a file is invalid.

## 1.0.12

- Registry-native `skillmd` CLI shipped inside `skillmds`: `search`, `add`, `list`, `remove`, `update`, `publish`, `login`/`logout`, plus lint/scan/rules/init. (Release notes added retroactively.)

## 1.0.11

- Security flags render with full readable labels, each with its own marker: `⚑ Executes Scripts  ⚑ Calls Network  ⚑ Reads Secrets`.

## 1.0.10

- Quality score is now a composite of spec correctness, completeness, and **security risk** — skills that read secrets, execute scripts, or make network calls score lower (a risky/stub skill is no longer a green 100).
- Lint output ends with a **Failed** section listing each failure's rule, message, and full path, so problems don't scroll off in a large run.
- New `--errors-only` flag to show only failing skills.
- Fixed emoji spacing/overlap; rule ids are grouped by severity per skill.
- The closer states how many skills failed instead of a vague "Problems found".

## 1.0.9

- Compact lint output: one line per skill (status dot, score, name, rule-id chips) with a single summary line, instead of a tall multi-row block per skill. Linting a single skill still shows full diagnostic messages.

## 1.0.8

- `skillmds` with no command in a terminal now opens the interactive CLI menu; it only starts the MCP server when launched over piped stdio (how MCP clients run it). Previously a bare `npx skillmds` in a terminal appeared to hang on the silent MCP server.

## 1.0.7

- Nicer CLI output: colored PASS/FAIL, quality-score bars, `ERROR`/`WARN`/`INFO` badges, and a summary with average score.
- Running `skillmd` (or `skillmds`) with no command on a terminal now opens a guided interactive menu (lint, scan, search, init, list). Piped/CI still prints help.
- Progress spinner while scanning.

## 1.0.6

- Bundle the banner image in the package and serve it via jsDelivr so it renders on the npm page (the previous absolute URL was unreachable).

## 1.0.5

- The `skillmds` binary now dispatches: `skillmds <command>` (lint, scan, add, …) runs the CLI, while `skillmds` with no command starts the MCP server. This makes `npx skillmds lint .` work without the `-p` flag.

## 1.0.4

- `skillmd lint`/`scan` print a progress line to stderr and warn when scanning a home directory, so a directory scan never looks like a frozen blank screen.
- Directory scans skip large build/OS directories (`AppData`, `node_modules`, `target`, …) and cap recursion depth, so `lint .` in a big tree terminates quickly.
- Clearer message when no `SKILL.md` is found.
- Bare `skillmd` (no command) prints help.

## 1.0.3

- CLI (`skillmd`) and MCP server (`skillmds`) now report their version from `package.json` instead of a hardcoded string.
- READMEs rewritten; added this changelog.

## 1.0.2

- `skillmd lint`: skip directories that cannot be read (e.g. `EPERM` on protected system folders) instead of aborting the scan.

## 1.0.1

- Fix `skillmd_lint` in the MCP server: keep `yaml` external in the bundled engine so it loads at runtime (bundling a CommonJS module into ESM raised `Dynamic require of "process"`).

## 1.0.0

- Add the `skillmd` CLI, shipped alongside the MCP server in this package. Commands: `lint`/`check`, `scan`, `rules`, `init`, `search`, `add`, `list`, `remove`, `update`, `publish`/`submit`, `login`, `logout`.
- Validation engine shared with the SkillMD registry: `SKILL.md` parser, lint rules `SK001`–`SK040`, security scan, quality score, and `text`/`json`/`sarif`/`github` output.
- Add the `skillmd_lint` MCP tool.
- MCP server and CLI authenticate with `Authorization: Bearer` tokens.

## 0.1.1

- Initial MCP server: `skillmd_search`, `skillmd_get`, `skillmd_install`, `skillmd_trending`, `skillmd_recommend`, `skillmd_list_saved`.
