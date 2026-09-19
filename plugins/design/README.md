# Design

30 Agent Skills from SkillMD.
https://skillmd.com/plugins/skillmd/design

## Claude Code

This archive is a Claude Code plugin. You do not need to unzip it — one
command installs it, adding the marketplace on the way:

    npx skillmds@latest add plugin:skillmd/design

Or add `skillmds/skillmd` as a marketplace in the Plugins tab, then:

    /plugin install design@skillmd

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

- ads-x
- web-design
- design-is
- agentic-kaggle-skill
- brand
- xhs-cover
- figma
- html-anything
- guizang-social-card-skill
- ifq-design-skills
- poster-hero
- research-paper-figure-skill-factory
- hp-design-analysis
- surrealdb
- ads-dna
- openspec-propose
- design
- grok-designer
- media-use
- kinetic-multicam
- waitlist-page
- article-poster-generator
- bmw-design-analysis
- civitai-mcp-ultimate
- remotion-markup
- snowe-ui-skill
- ui-ux-pro-max
- claude-design
- pwdev-solucoes-figma
- impeccable
