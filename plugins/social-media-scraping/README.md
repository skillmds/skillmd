# Social Media Scraping

12 Agent Skills from SkillMD.
https://skillmd.com/plugins/skillmd/social-media-scraping

## Claude Code

This archive is a Claude Code plugin. You do not need to unzip it — one
command installs it, adding the marketplace on the way:

    npx skillmds@latest add plugin:skillmd/social-media-scraping

Or add `skillmds/skillmd` as a marketplace in the Plugins tab, then:

    /plugin install social-media-scraping@skillmd

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

- x-tweet-search
- xiaohongshu-search
- instagram-profile-meta
- instagram-post-comments
- instagram-profile-posts
- facebook-groups-scrape-posts
- chrome-extensions
- js-reverse
- browser-automation
- src-hunter
- browser-extension-reverse
- xiaohongshu-skills
