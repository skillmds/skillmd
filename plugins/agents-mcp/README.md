# Agents & MCP

34 Agent Skills from SkillMD.
https://skillmd.com/plugins/skillmd/agents-mcp

## Claude Code

This archive is a Claude Code plugin. You do not need to unzip it — one
command installs it, adding the marketplace on the way:

    npx skillmds@latest add plugin:skillmd/agents-mcp

Or add `skillmds/skillmd` as a marketplace in the Plugins tab, then:

    /plugin install agents-mcp@skillmd

## Any other agent

Every agent that reads SKILL.md uses the same layout, one directory per skill,
and differs only in where that directory lives. Copy the contents of `skills/`
into your agent's skills directory:

    Claude Code      .claude/skills/
    Cursor           .cursor/skills/
    Codex            .codex/skills/
    Windsurf         .windsurf/skills/
    Gemini CLI       .agents/skills/
    GitHub Copilot   .agents/skills/

The full list, project and global paths for each agent, is at
https://skillmd.com/agents

## Skills in this plugin

- ads-math
- repo-task-proof-loop
- design-is
- total-recall
- refine-live
- gemini-skill
- gemma-dev
- agent-recall
- code-walkthrough
- gsd-browser
- figma
- graphsignal-profiler
- dbs-bridge
- ip-diagram-creator
- aihot
- iota-agent-mcp
- bmw-design-analysis
- hermes-dojo
- knowledge-agent
- html-anything
- gemma-trainer
- forter-agentic-readiness-audit
- media-use
- b0
- copilot-sdk
- lambda-lang
- mcp-builder
- mesh-memory
- surrealmcp
- bioqc-mcp
- cli-anything-hermes
- claw-orchestrator
- server
- civitai-mcp-ultimate
