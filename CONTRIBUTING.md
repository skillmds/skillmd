# Contributing to SkillMD

Thanks for helping make Agent Skills safer and easier to share. Issues and pull requests are welcome.

## Development setup

Node **≥ 18** runs the published packages; Node **≥ 20** is recommended for development (vitest and tsup are happiest there).

```bash
git clone https://github.com/skillmds/skillmd.git
cd skillmd
npm ci
npm run build        # builds @skillmds/core, then skillmds
npm test             # vitest across both packages (builds core first — the MCP smoke test spawns the real bin)
npm run typecheck    # strict tsc across both packages
npm run lint:skills  # dogfood: lint the example skill with the local build
```

## Repository layout

| Path | What it is |
|---|---|
| `packages/core` | `@skillmds/core` — SKILL.md parser, lint rules, security scanner, quality score, formatters. |
| `packages/skillmds` | `skillmds` — the `skillmd` CLI (`src/`, bundled to `dist/cli.js`) and the `skillmds` MCP server (`bin/skillmd-mcp.mjs`, plain readable ESM). |
| `action/` | The `skillmds/skillmd/action@v1` composite GitHub Action (SARIF lint for CI). |
| `docs/` | CLI, MCP, lint-rule, and registry API references. |
| `examples/` | MCP client configs and the fixture skill CI lints. |

Two things worth knowing before you change code:

- **The MCP server bin is deliberately a plain `.mjs` file**, not a build artifact — anyone can read exactly what runs when their MCP client spawns it. Keep it dependency-light and readable.
- **The dispatch block at the bottom of `bin/skillmd-mcp.mjs` is behavior-critical**: args or a TTY → CLI; bare + piped stdin → MCP server. `src/mcp.test.ts` guards it; don't change one without the other.

## Pull requests

- Add or update tests for what you change. `npm test` and `npm run typecheck` must pass.
- Keep the packages' public API surfaces deliberate — `@skillmds/core` exports are a compatibility contract.
- Match the surrounding code style (no lint tooling is configured; the codebase is small and consistent — read a file before editing it).
- One logical change per PR.

## Release process (maintainers)

Releases are tag-driven; CI publishes to npm with provenance.

1. Bump the package's `version` in its `package.json` and add a dated section to its `CHANGELOG.md`.
2. For `skillmds` releases, bump `version` in the root `server.json` too (MCP registry manifest).
3. Commit, then tag and push:
   - `@skillmds/core` → `git tag core-vX.Y.Z && git push origin core-vX.Y.Z`
   - `skillmds` → `git tag vX.Y.Z && git push origin vX.Y.Z`
   - Publishing order matters when both change: core first — the `skillmds` release job refuses to publish until its `@skillmds/core` range resolves on npm.
4. CI publishes the package and creates a GitHub Release with the matching CHANGELOG section.
5. If the GitHub Action changed, move the floating tag: `git tag -f v1 && git push -f origin v1` (the release workflow only matches three-part tags, so `v1` never triggers it).
6. Re-publish the MCP registry entry when `server.json` changed: `mcp-publisher publish` (requires the `com.skillmd` domain verification).

## Security issues

Please do not open public issues for vulnerabilities — see [SECURITY.md](SECURITY.md).
