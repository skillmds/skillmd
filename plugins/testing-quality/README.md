# Testing & Quality

24 Agent Skills from SkillMD.
https://skillmd.com/plugins/skillmd/testing-quality

## Claude Code

This archive is a Claude Code plugin. You do not need to unzip it — one
command installs it, adding the marketplace on the way:

    npx skillmds@latest add plugin:skillmd/testing-quality

Or add `skillmds/skillmd` as a marketplace in the Plugins tab, then:

    /plugin install testing-quality@skillmd

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

- i-have-adhd
- gsd-browser
- ads-test
- iota-agent-mcp
- effect
- agentic-kaggle-skill
- hyperframes-cli
- b0
- ads-validate
- surrealkit
- seam-craft
- typescript-react-nextjs-patterns
- ads-server-side-tracking
- ue
- skill-creator
- review
- rpk
- qa
- debugger
- act
- push
- systematic-debugging
- test-driven-development
- eslint-code-review
