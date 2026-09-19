# paper-to-course

> Transform any academic paper into a beautiful, interactive single-page HTML course.

A [Claude Code](https://claude.ai/code) skill that converts research papers into self-contained interactive courses — with scroll-based navigation, formula breakdowns, literature timelines, method comparisons, ablation diagrams, and comprehension quizzes.

**Target users:** researchers who need to quickly understand a paper's contributions, and students/newcomers learning a new field through the lens of a specific paper.

## Quick Start

### 1. Install the skill

Copy this entire folder to your Claude Code skills directory:

```bash
cp -r paper-to-course ~/.claude/skills/
```

### 2. Use it

Open any project in Claude Code (or a standalone conversation), then say:

```
Turn this paper into a course
```

Point it at a PDF or LaTeX source, and it will:

1. Read and analyze the paper structure
2. Design a 6-module curriculum
3. Generate HTML modules with interactive elements
4. Bundle everything into a single `index.html`

### 3. Open the course

```bash
open index.html   # macOS
xdg-open index.html   # Linux
```

No server required — it's a fully self-contained HTML file.

## What You Get

Each course includes **7 interactive element types**:

| Element | What it does |
|---------|-------------|
| **Formula Breakdown** | Math formulas translated line-by-line into plain English |
| **Literature Timeline** | Animated history of the field's key milestones |
| **Comparison Table** | Hover to see detailed trade-off analysis between methods |
| **Ablation Diagram** | Visual ablation study showing each component's contribution |
| **Method Chat** | Animated component conversations explaining how the method works |
| **Comprehension Quiz** | Multiple-choice questions to test your understanding |
| **Glossary Tooltips** | Hover any technical term for a plain-English definition |

## Course Modules

Every paper course follows this 6-module structure:

1. **Problem & Motivation** — Why does this matter? What's the bottleneck?
2. **Literature Timeline** — How did the field evolve? Key breakthroughs?
3. **SOTA Comparison** — What are the current主流方法? Pros and cons?
4. **Method Deep-Dive** — Architecture, formulas, algorithm flow
5. **Experiments & Results** — Benchmarks, ablations, SOTA comparisons
6. **Limitations & Future Work** — Open problems, next steps

## File Structure

```
paper-to-course/
├── SKILL.md                  # Claude Code skill instructions
├── README.md                 # This file
├── LICENSE                  # MIT License
└── references/
    ├── styles.css           # Complete design system + paper-specific components
    ├── main.js              # Interactive engine (animations, quizzes, tooltips)
    ├── build.sh             # HTML bundler
    ├── _base.html           # HTML template header
    ├── _footer.html         # HTML template footer
    └── paper-elements.md    # HTML implementation patterns for all 7 element types
```

## Design

- **Aesthetic:** Warm "developer notebook" — off-white (#FAF7F2) + coral accent (#D94F30)
- **Fonts:** Bricolage Grotesque (headings) · DM Sans (body) · JetBrains Mono (formulas/code)
- **Output:** Single `index.html` — no dependencies, works offline, mobile-friendly

## Requirements

- [Claude Code](https://claude.ai/code) (any plan)
- A paper in PDF or LaTeX format

## Extending with Other AI Coding Tools

paper-to-course is a Markdown skill file — it works wherever AI coding tools support custom instructions or skills.

### Claude Code (Recommended)

Copy the skill to your Claude Code skills directory:

```bash
cp -r paper-to-course ~/.claude/skills/
```

Then add to your VS Code settings (`~/.config/Code/User/settings.json`):

```json
{
  "claudeCode.skills": [
    {
      "name": "paper-to-course",
      "description": "📚 论文 → 交互式课程（HTML + PPT + 笔记）",
      "path": "/path/to/paper-to-course/SKILL.md"
    }
  ]
}
```

Reload VS Code (`Ctrl+Shift+P` → "Reload Window"). Then in Claude Code chat:

```
/paper-to-course /path/to/your-paper.pdf
```

### VS Code Copilot (Native)

If your VS Code workspace has a `.claude/` directory, place `paper-to-course/` inside it:

```bash
mkdir -p ./.claude/skills/
cp -r /path/to/paper-to-course ./.claude/skills/
```

Add to workspace `.vscode/settings.json`:

```json
{
  "claudeCode.skills": [
    {
      "name": "paper-to-course",
      "description": "📚 论文 → 交互式课程",
      "path": ".claude/skills/paper-to-course/SKILL.md"
    }
  ]
}
```

### GitHub Copilot Chat

GitHub Copilot Chat supports custom instructions via workspace `CLAUDE.md` or `.github/copilot-instructions.md`. Reference the skill:

1. Copy `paper-to-course/` to your project:

```bash
cp -r /path/to/paper-to-course ./vendor/
```

2. Add to `.github/copilot-instructions.md`:

```
# Paper-to-Course
When asked to study or understand a paper, use the instructions in ./vendor/paper-to-course/SKILL.md
to generate an interactive HTML course, Markdown notes, and PPTX slides.
```

3. In GitHub Copilot Chat, ask:

```
@paper-to-course /path/to/paper.pdf
```

Or simply:

```
Study this paper and generate a course: <attach PDF>
```

### Codex (OpenAI) / Agentic Tools

Codex and similar agentic tools that support `npx skills add`:

```bash
# Option A: If you have a public GitHub repo for paper-to-course
npx skills add your-username/paper-to-course

# Option B: Clone and install locally
git clone https://github.com/your-username/paper-to-course.git
cd paper-to-course
# Follow the tool's local install instructions (usually: point to SKILL.md)
```

### openclaw

```bash
# Method A: Copy to openclaw skills directory
cp -r paper-to-course ~/.openclaw/skills/

# Method B: Via openclaw Web IDE
# Settings → Skills → Add Skill → point to paper-to-course/SKILL.md
```

Then in openclaw:

```
/paper-to-course /path/to/paper.pdf
```

### Cline / Roo Code / Other VS Code AI Extensions

Most VS Code AI extensions respect the same `claudeCode.skills` setting or read `.md` skill files:

```bash
# Copy to workspace
cp -r paper-to-course ./.claude/skills/

# Or reference it in your project CLAUDE.md:
echo "Use paper-to-course/SKILL.md for paper study tasks" >> CLAUDE.md
```

---

## License

MIT License — free to use, modify, and distribute.
