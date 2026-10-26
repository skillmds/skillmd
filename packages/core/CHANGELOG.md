# Changelog

All notable changes to `@skillmds/core` are documented here. Versions follow [semver](https://semver.org).

## 1.0.1

- `slugify` no longer ends in a hyphen when the 60-character cut lands right after a word break (`"…-informacion-reading-"` → `"…-informacion-reading"`). A slug's name becomes the installed folder and the skill's `name`, and the Agent Skills spec rejects a name ending in a hyphen.

## 1.0.0

- Published under the `@skillmds` scope (matching the `skillmds` package and the github.com/skillmds org). Earlier docs referred to it as `@skillmd/core`; that name was never published.

- First public release. The engine that has powered the SkillMD registry, the `skillmd` CLI, and the `skillmds` MCP server (previously bundled inside `skillmds` as a private vendor build) is now its own package.
- Exports: `parseSkillMd`, `lint`, `runRules`/`RULES`, `scanSecurity`, `qualityScore`, the `toText`/`toJson`/`toSarif`/`toGithub` formatters, and the registry helpers `skillMdFor`, `reconstructSkillMd`, `isAllowedSourceUrl`.
- ESM-only, typed, no runtime dependency beyond `yaml`.
