#!/usr/bin/env bash
# End-to-end check of the built CLI against a throwaway HOME. Uses the real
# registry for one small skill (trailofbits/code-improver).
#
# Run it after `npm run build -w skillmds`. It needs network access for that
# one skill; everything else is local filesystem.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN="$ROOT/packages/skillmds/bin/skillmd.mjs"

# node is a Windows process under Git Bash: it never translates an MSYS path
# like /tmp/xyz. Arguments get converted for us, but HOME/USERPROFILE are
# passed through verbatim, so convert the temp root to a real C:/... path with
# forward slashes before anything is exported.
T="$(mktemp -d)"
CLEAN="$T"
trap 'rm -rf "$CLEAN"' EXIT
if command -v cygpath >/dev/null 2>&1; then T="$(cygpath -m "$T")"; fi

export HOME="$T/home" USERPROFILE="$T/home" SKILLMD_NO_TELEMETRY=1
# Anything that would make the CLI think it is inside an agent, a CI runner, or
# someone else's config tree has to go: the point is a pristine machine.
unset CLAUDECODE CURSOR_AGENT CODEX_SANDBOX GEMINI_CLI CI CLAUDE_CONFIG_DIR CODEX_HOME SKILLMD_TOKEN SKILLMD_API || true

mkdir -p "$HOME/.claude" "$HOME/.cursor" "$T/desktop" "$T/repo/.git" "$T/repo/.claude"

echo "== stray folder, piped stdin, no flags -> exit 1 with hint, nothing written"
if (cd "$T/desktop" && node "$BIN" add trailofbits/code-improver </dev/null); then echo "expected exit 1"; exit 1; fi
[ -z "$(ls -A "$T/desktop")" ] || { echo "desktop was littered"; ls -A "$T/desktop"; exit 1; }

echo "== stray folder + -y -> global, canonical + links, no desktop dirs"
(cd "$T/desktop" && node "$BIN" add trailofbits/code-improver -y)
[ -f "$HOME/.agents/skills/code-improver/SKILL.md" ]
[ -e "$HOME/.claude/skills/code-improver/SKILL.md" ]
[ -e "$HOME/.cursor/skills/code-improver/SKILL.md" ]
[ -z "$(ls -A "$T/desktop")" ]
grep -q '"registry:trailofbits/code-improver"' "$HOME/.skillmd/lock.json"

echo "== project with .claude only -> only .claude linked, cursor skipped"
(cd "$T/repo" && node "$BIN" add trailofbits/code-improver -y | tee "$T/out.txt")
[ -f "$T/repo/.agents/skills/code-improver/SKILL.md" ]
[ -e "$T/repo/.claude/skills/code-improver/SKILL.md" ]
[ ! -e "$T/repo/.cursor" ]
grep -q "cursor" "$T/out.txt"
[ -f "$T/repo/skills-lock.json" ]

echo "== json purity"
(cd "$T/repo" && node "$BIN" list --json > "$T/list.json" 2>"$T/list.err")
node -e 'const d=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")); if(!Array.isArray(d)||!d.length) process.exit(1)' "$T/list.json"
(cd "$T/repo" && node "$BIN" add trailofbits/code-improver -y --json > "$T/add.json" 2>/dev/null)
node -e 'const d=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")); if(d.ok!==true) process.exit(1)' "$T/add.json"

echo "== check / update / remove"
(cd "$T/repo" && node "$BIN" check)
(cd "$T/repo" && node "$BIN" update)
(cd "$T/repo" && node "$BIN" remove code-improver -y -p)
[ ! -e "$T/repo/.claude/skills/code-improver" ]
[ ! -e "$T/repo/.agents/skills/code-improver" ]
(cd "$T/desktop" && node "$BIN" remove code-improver -g -y)
[ ! -e "$HOME/.agents/skills/code-improver" ]
[ ! -e "$HOME/.claude/skills/code-improver" ]

echo "== help + version"
node "$BIN" add --help | grep -q -- "--project"
node "$BIN" --version | grep -q "1.2.0"
echo "E2E OK"
