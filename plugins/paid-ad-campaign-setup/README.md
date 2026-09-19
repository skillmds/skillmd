# Paid Ad Campaign Setup

13 Agent Skills from SkillMD.
https://skillmd.com/plugins/skillmd/paid-ad-campaign-setup

## Claude Code

This archive is a Claude Code plugin. You do not need to unzip it — one
command installs it, adding the marketplace on the way:

    npx skillmds@latest add plugin:skillmd/paid-ad-campaign-setup

Or add `skillmds/skillmd` as a marketplace in the Plugins tab, then:

    /plugin install paid-ad-campaign-setup@skillmd

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

- competitive-ads-extractor
- paid-ads
- adobe-create-social-variations
- ads-test
- ads-launch
- ads-creative
- ads-optimize
- inskillflow-paid-ads
- nimoqup046-collab-paid-ads
- jorcan-paid-ads
- oyi77-paid-ads
- phoroth-paid-ads
- lucaspmarie-a11y-paid-ads
