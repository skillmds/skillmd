# Create and Share Agent Skills

11 Agent Skills from SkillMD.
https://skillmd.com/plugins/skillmd/create-agent-skills

## Claude Code

This archive is a Claude Code plugin. You do not need to unzip it — one
command installs it, adding the marketplace on the way:

    npx skillmds@latest add plugin:skillmd/create-agent-skills

Or add `skillmds/skillmd` as a marketplace in the Plugins tab, then:

    /plugin install create-agent-skills@skillmd

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

- planning-and-task-breakdown
- create-skill
- verification-before-completion
- skill-share
- goal-loop
- hermes-dojo
- agent-skill-creator
- product
- github-copilot-prompt-files
- skill-publisher
- openclaw-docs
