# Changelog

All notable changes to `@skillmd/core` are documented here. Versions follow [semver](https://semver.org).

## 1.0.0

- First public release. The engine that has powered the SkillMD registry, the `skillmd` CLI, and the `skillmds` MCP server (previously bundled inside `skillmds` as a private vendor build) is now its own package.
- Exports: `parseSkillMd`, `lint`, `runRules`/`RULES`, `scanSecurity`, `qualityScore`, the `toText`/`toJson`/`toSarif`/`toGithub` formatters, and the registry helpers `skillMdFor`, `reconstructSkillMd`, `isAllowedSourceUrl`.
- ESM-only, typed, no runtime dependency beyond `yaml`.
