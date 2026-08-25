# @skillmd/core

[![npm version](https://img.shields.io/npm/v/@skillmd/core.svg)](https://www.npmjs.com/package/@skillmd/core)
[![license](https://img.shields.io/npm/l/@skillmd/core.svg)](https://github.com/skillmds/skillmd/blob/main/LICENSE)

The SKILL.md engine behind [SkillMD](https://skillmd.com): parser, lint rules, security scanner, quality score, and report formatters for [Agent Skills](https://docs.claude.com/en/docs/agents-and-tools/agent-skills). The same code runs in the SkillMD registry, the [`skillmd` CLI, and the `skillmds` MCP server](https://www.npmjs.com/package/skillmds) — so a skill that lints clean locally is valid everywhere.

ESM-only. No runtime dependencies beyond `yaml`. Runs unchanged in Node (≥18), browsers, and edge runtimes.

## Install

```bash
npm i @skillmd/core
```

## Usage

```ts
import { lint } from "@skillmd/core";

const result = lint(rawSkillMd, { slug: "my-skill" });

result.ok;           // false when any error-severity diagnostic fired
result.score;        // quality score 0–100
result.diagnostics;  // [{ id: "SK011", severity: "warn", message: "...", line? }]
result.security;     // { flags: ["network_calls", ...], findings: [...] }
```

## API surface

| Export | What it does |
|---|---|
| `lint(raw, options?)` | Parse → rules → security scan → quality score, in one call. |
| `parseSkillMd(raw, type?)` | Parse SKILL.md frontmatter + body into a `ParsedSkill` (or a parse error). |
| `runRules(skill, ctx?)` / `RULES` | Run (or inspect) the individual lint rules. |
| `scanSecurity(body)` | Line-aware scan for scripts, network calls, and secret access. |
| `qualityScore(diagnostics, security, opts?)` | The 0–100 score used across SkillMD. |
| `toText` / `toJson` / `toSarif` / `toGithub` | Report formatters (SARIF uploads to GitHub Code Scanning). |
| `skillMdFor(skill)` / `reconstructSkillMd(skill)` | Materialize an installable SKILL.md from a registry response. |
| `isAllowedSourceUrl(url)` | Client-side SSRF guard for companion-file downloads. |
| `slugify(name)` / `categorize(...)` | Naming + category helpers shared with the registry. |

Full rule reference: [docs/rules.md](https://github.com/skillmds/skillmd/blob/main/docs/rules.md).

## License

[MIT](https://github.com/skillmds/skillmd/blob/main/LICENSE)
