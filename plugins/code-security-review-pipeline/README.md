# Code Security Review Pipeline

15 Agent Skills from SkillMD.
https://skillmd.com/plugins/skillmd/code-security-review-pipeline

## Claude Code

This archive is a Claude Code plugin. You do not need to unzip it — one
command installs it, adding the marketplace on the way:

    npx skillmds@latest add plugin:skillmd/code-security-review-pipeline

Or add `skillmds/skillmd` as a marketplace in the Plugins tab, then:

    /plugin install code-security-review-pipeline@skillmd

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

- find-bugs
- logic-lens
- fix-review
- security-and-hardening
- cred-omega
- security-audit
- caveman-review
- brooks-lint
- ai-engineering-standards
- reverse-skill-router
- code-audit
- apk-reverse
- api-security
- dotnet-reverse
- reverse-engineering
