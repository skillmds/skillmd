# Lint rules & scoring

`skillmd lint` (and the registry, and the `skillmd_lint` MCP tool) run the same rule set from [`@skillmd/core`](../packages/core). Errors make a skill invalid (`ok: false`, non-zero exit); warnings advise.

## Rules

| ID | Severity | Checks |
|---|---|---|
| SK001 | error | SKILL.md parses at all: frontmatter fences present, YAML valid (synthesized when parsing fails) |
| SK002 | error | `name` present in frontmatter, ≤ 120 chars |
| SK003 | error | `description` present, ≤ 1024 chars |
| SK010 | warn | `description` ≥ 20 chars (not too terse for discovery) |
| SK011 | warn | `license` declared in frontmatter |
| SK020 | warn | body ≥ 200 chars (not a stub) |
| SK021 | warn | body contains at least one Markdown heading |
| SK030 | error | total size ≤ 256 KB |
| SK040 | warn | `name` slug matches the directory/slug it lives under |

`skillmd rules` prints this list; `skillmd rules SK011` shows one rule.

## Security flags

Alongside lint rules, every skill body is scanned line-by-line. Flags are **information, not verdicts** — a skill that documents `curl` gets `network_calls` even though nothing runs at install time:

| Flag | Meaning |
|---|---|
| `docs_only` | Nothing executable found — pure instructions |
| `network_calls` | Fetches, curls, or otherwise talks to the network |
| `executes_scripts` | Runs commands or bundled scripts |
| `reads_secrets` | Touches env vars, tokens, or credential files |
| `untrusted_install` | Fetch-and-execute from a non-standard source (custom registries, piped installers) |

`skillmd scan` prints each finding with its line number and snippet. Installing never executes anything regardless of flags; `--deny <flag>` opts into refusing flagged skills.

## Quality score

Every lint result carries a 0–100 score derived from diagnostics and security findings: errors cost heavily, warnings mildly, and security flags cost only a little (they're pattern matches on prose, not proof of harm). Registry-verified skills are floored at 85 unless they fail to parse.
