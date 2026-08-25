# Security Policy

## Reporting a vulnerability

Email **hi@skillmd.com** with the details — proof of concept, affected versions, and impact as you understand it. Please do not open a public issue for anything exploitable.

You'll get an acknowledgment within a few days. We ask for a reasonable disclosure window (up to 90 days) to ship a fix before details go public, and we'll credit you in the release notes unless you prefer otherwise.

## Scope

- The npm packages `skillmds` and `@skillmd/core` (this repository)
- The `skillmds/skillmd/action` GitHub Action
- The SkillMD registry and API at `skillmd.com` / `api.skillmd.com`

## What these tools already defend against

Reports that break one of these guarantees are especially valuable:

- **Installing a skill never executes code.** `skillmd add` and the MCP `skillmd_install` tool only write files; scripts in a skill are surfaced as security flags, never run.
- **Path containment.** Skill names are validated against a strict slug alphabet and every written file passes a zip-slip guard — nothing lands outside the target skill directory.
- **Content integrity.** Registry-stored files are content-addressed; downloads are verified against their recorded SHA-256 and refused wholesale on mismatch (no partial installs).
- **Egress containment.** Companion files are only ever fetched from the pinned GitHub raw hosts; any other `source_url` in a registry response is refused (client-side SSRF guard).

## Supported versions

Only the latest published version of each package receives fixes.
