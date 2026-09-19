# Docs & Writing

31 Agent Skills from SkillMD.
https://skillmd.com/plugins/skillmd/docs-writing

## Claude Code

This archive is a Claude Code plugin. You do not need to unzip it — one
command installs it, adding the marketplace on the way:

    npx skillmds@latest add plugin:skillmd/docs-writing

Or add `skillmds/skillmd` as a marketplace in the Plugins tab, then:

    /plugin install docs-writing@skillmd

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

- ads-report
- agent-recall
- make-plan
- dy-note
- design
- wechat-to-md
- transitions-dev
- sourcesage-cli
- figma
- final-review
- dbs-report
- ifq-design-skills
- hv-analysis
- research-paper-figure-skill-factory
- deck-replit
- mav-slidecraft-skill
- ollama-design-analysis
- zan-html-to-ppt
- wowerpoint
- grok-designer
- slides
- paper-to-course
- slideshow
- ppt-creater-skill
- docs-page
- diagram-generator
- docs-generator
- humanizer-academic-zh
- academic-pptx
- html-docs
- makedown-task-runner
