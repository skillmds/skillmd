# Grok Designer

Grok Designer is a Grok 4.5 design advisor skill for agents. It helps with UI critique, UX critique, component-choice review, interaction-flow review, design direction, HTML mockups, SVG icons, handwritten wordmarks, and file-based design feedback.

The skill asks Grok 4.5 for design judgment through the bundled `grok-designer` CLI, then lets the main agent decide how to apply the advice in the current workspace.

## Install

The easiest way is to give this GitHub repository to an agent such as Codex, Claude Code, or Cursor and ask it to install the skill:

```text
https://github.com/oil-oil/grok-designer
```

You can also install it directly from a terminal:

```bash
npx skills add oil-oil/grok-designer
```

After installation, agents should use the `grok-designer` skill when a task needs external design judgment.

## Authorization

The CLI reads local configuration from:

```text
~/.config/grok-designer/config.toml
```

By default, the API key is read from:

```text
~/.config/grok-designer/api_key
```

Do not commit API keys or local config files. The repository ignores common local secret files, including `.env`, `config.toml`, and `api_key`.

## What Agents Should Know

- Grok is stateless. It only sees the current prompt, files passed with `-f`, and images passed with `-i`.
- For visual/UI review, use `grok-designer ui`.
- For UX, component-choice, task-flow, interaction, friction, or state-feedback review, use `grok-designer ux`.
- For combined UI + UX review, use `grok-designer ui,ux` or run `ui` and `ux` separately.
- For broad art direction or design imagery markdown, use `grok-designer direction`.
- For new standalone HTML mockups, use `grok-designer html`.
- For SVG icons, simple illustrations, and single handwritten wordmarks, use `grok-designer svg`.
- Pass complete relevant files when Grok needs to judge an existing design.
- Pass screenshots or visual references with `-i` when the visible result or state sequence matters.
- Do not ask Grok to patch project files directly. Use its advice, then apply the changes in the workspace.

## CLI

The skill installs a global command:

```bash
grok-designer
```

Typical examples:

```bash
grok-designer ui "给这个页面提视觉/UI设计建议" -f ./design.html -o design-page-ui.md
grok-designer ux "评审这个页面的任务流、交互摩擦和状态反馈" -f ./design.html -o design-page-ux.md
grok-designer ui,ux "同时从 UI 和 UX 角度评审这个标签编辑组件" -f ./TagEditor.tsx -o tag-editor-review.md
grok-designer direction "给这个产品生成设计意象 markdown" -o product-design-imagery.md
grok-designer html "生成一个完整的产品页面设计稿" -f ./brief.md -o ./designs/product-page.html
grok-designer svg "为 Museon 生成一个手写 SVG 字标" -o museon-wordmark.svg
```

Bare output filenames are saved under `.grok-designer/` in the current workspace.

For multi-command markdown review, a single `-o` value is suffixed per command. For example, `-o tag-editor-review.md` writes `tag-editor-review-ui.md` and `tag-editor-review-ux.md`.

## Repository Layout

```text
SKILL.md
scripts/grok-designer
scripts/install_cli
```

`SKILL.md` tells agents when and how to use Grok. `scripts/install_cli` installs the CLI into the user's local bin directory. `scripts/grok-designer` is the command agents call.
