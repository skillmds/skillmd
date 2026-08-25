# SkillMD Lint — GitHub Action

Validate `SKILL.md` files against the [SkillMD](https://skillmd.com) spec on every push or
pull request, and surface findings in the GitHub **Security → Code scanning** tab via SARIF.

It wraps the `skillmd` CLI (`skillmd lint --format sarif`).

## Usage

```yaml
name: Lint skills
on: [push, pull_request]

permissions:
  contents: read
  security-events: write   # required to upload SARIF

jobs:
  skillmd-lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: skillmds/skillmd/action@v1
        with:
          path: skills        # default: "."
          strict: "true"      # treat warnings as errors
```

## Inputs

| Input             | Default | Description                                    |
| ----------------- | ------- | ---------------------------------------------- |
| `path`            | `.`     | File or directory to lint.                     |
| `strict`          | `false` | Treat warnings as errors.                      |
| `fail-on-warning` | `false` | Exit non-zero when warnings exist.             |
| `upload-sarif`    | `true`  | Upload SARIF to GitHub Code Scanning.          |

The job fails if any skill has lint **errors** (or warnings, under `strict`/`fail-on-warning`).
