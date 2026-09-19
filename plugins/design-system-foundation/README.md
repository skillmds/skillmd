# Design System Foundation

16 Agent Skills from SkillMD.
https://skillmd.com/plugins/skillmd/design-system-foundation

## Claude Code

This archive is a Claude Code plugin. You do not need to unzip it — one
command installs it, adding the marketplace on the way:

    npx skillmds@latest add plugin:skillmd/design-system-foundation

Or add `skillmds/skillmd` as a marketplace in the Plugins tab, then:

    /plugin install design-system-foundation@skillmd

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

- design-principles
- naming-convention
- design-token
- documentation-template
- brand
- design-system
- cal-com-design-analysis
- miro-design-analysis
- nvidia-design-analysis
- ollama-design-analysis
- aica
- design-color
- design-setup
- extract
- openfoodjournal-ui
- maxim-brand
