# MCP Security Audit Pipeline

12 Agent Skills from SkillMD.
https://skillmd.com/plugins/skillmd/mcp-security-audit-pipeline

## Claude Code

This archive is a Claude Code plugin. You do not need to unzip it — one
command installs it, adding the marketplace on the way:

    npx skillmds@latest add plugin:skillmd/mcp-security-audit-pipeline

Or add `skillmds/skillmd` as a marketplace in the Plugins tab, then:

    /plugin install mcp-security-audit-pipeline@skillmd

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

- mcp-security-audit
- agent-supply-chain
- agent-owasp-compliance
- security-scan
- prompt-guard
- dbs-skill-cleaner
- reverse-skill-router
- cloud-k8s
- pentest-tools
- js-reverse
- api-security
- browser-automation
