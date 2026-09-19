# Prompt patterns

## Pattern: read-only review command
**Use when:** A developer repeatedly requests the same bounded read-only review.
**Inspect first:** Available read/search tools and the repository's review rules.
**Invariants:** No edits; findings cite evidence; severity and scope are explicit.
```markdown
---
name: review-boundary
description: Review one boundary without editing files
argument-hint: "[path or symbol]"
agent: ask
tools: [search/codebase, search/usages]
---
Review `${input:target:path or symbol}`. Report only correctness, security, and
contract defects with file evidence. Do not edit. End with checks to run.
```
**Do not use when:** The review requires a persistent persona or several workflow stages.
**Verify:** Parse YAML, run from `/review-boundary`, and assert no workspace files change.
