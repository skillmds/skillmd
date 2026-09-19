# Maxim Skill — Marketing

> Layer 1 — Supreme Authority | Executive Office: CMO

## Domain

Growth marketing, campaign execution, GTM strategy, localization marketing, and conversion optimization. Channel-specific execution across Instagram, TikTok, Twitter/X, and Reddit — plus full-funnel growth strategy.

## Dispatch Rule

Maxim agents check this skill FIRST before community-packs/ or composable-skills/.
If this skill activates → Maxim behavioral layer wins all conflicts.
Confidence tag: 🟢 HIGH (Maxim skill matched + behavioral layer applied)

## Lead Agent

`content-strategist` — CMO Office

## Active Agents

- `growth-hacker` — user acquisition, viral growth, growth experiments
- `email-campaign-writer` — email marketing, nurture sequences, campaign execution
- `landing-page-optimizer` — conversion rate optimization, landing page design and copy
- `gtm-strategist` — go-to-market strategy, launch planning, market penetration
- `localization-specialist` — multilingual marketing, cultural adaptation, Bill 96 compliance
- `seo-specialist` — campaign-aligned search strategy (also primary agent in search-visibility domain)

**Op-C Skill DNA modes (demoted channel agents now embedded in marketing/SKILL.md):**
- Mode: Instagram — from `instagram-curator`
- Mode: TikTok — from `tiktok-strategist`
- Mode: Twitter/X — from `twitter-engager`
- Mode: Reddit — from `reddit-community-builder`

**Deprecated:** `app-store-optimizer` — absorbed into `gtm-strategist` and `growth-hacker` (not a separate mode)

## Skill Modes

- `Instagram` — visual-first content strategy, stories, reels, community growth
- `TikTok` — short-form video strategy, trend participation, creator-led campaigns
- `Twitter/X` — thought leadership, real-time engagement, community building
- `Reddit` — community-native participation, AMA strategy, subreddit authority building

## Ethics Gate

None. Standard Maxim behavioral output quality applies.
Note: `localization-specialist` outputs touching Bill 96 or language law → compliance skill auto-looped.

## External Sources Consumed

Layer 2 (community-packs/):
- `community-packs/claude-skills-library/marketing-skill/` — growth frameworks, channel playbooks, campaign templates, GTM patterns (consumed by `seo-specialist` · `growth-hacker` · `email-campaign-writer` · `landing-page-optimizer` · `content-strategist`)

Conflict resolution: Maxim ALWAYS WINS

## Triggers (auto-activation signals)

Any task matching these phrases activates the marketing skill:

- `growth hacking`, `user acquisition`, `viral growth`, `growth experiments`
- `campaign`, `launch strategy`, `go-to-market`, `GTM`
- `landing page`, `conversion rate`, `CRO`, `A/B test`
- `email marketing`, `nurture sequence`, `drip campaign`
- `social media`, `Instagram`, `TikTok`, `Twitter`, `Reddit`
- `localization`, `multilingual`, `translation marketing`
- `growth`, `funnel`, `retention`, `churn reduction`

## Cross-Agent Auto-Loops

When marketing skill activates, the following agents are auto-notified:

- `content-strategist` — CMO lead, ensures brand-voice consistency across all campaigns
- `behavior-science-persuasion` skill — auto-looped for campaign psychology and conversion triggers
- `search-visibility` skill — auto-looped for SEO/AEO alignment with campaign content
- `brand` skill — auto-looped to validate brand consistency in campaign assets
- `compliance` skill — auto-looped when localization or regulated claims are present (CSO auto-loop rule)

## Skill Gap Logging

If this domain has NO matching Maxim skill for a sub-task:
→ Log to .mxm-skills/agents-skill-gaps.log format:
[YYYY-MM-DD HH:MM] | marketing | {task-description} | {suggested-skill-name} | {project}

## Source of Truth

config/agent-registry.json v3.2.1 | documents/reference/SKILLS_MAP.md | CLAUDE.md
Maintained by: DrNabeelKhan | iSimplification.io
Last updated: 2026-03-18
