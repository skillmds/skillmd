# paper-to-course

### 将任意学术论文转换为交互式 HTML 课程 + Markdown + PPTX

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![ Claude Code Skill](https://img.shields.io/badge/Claude%20Code-Skill-7C3AED?style=flat-square)](https://claude.ai/code)
[![English README](https://img.shields.io/badge/README-English-blue?style=flat-square)](README.md)
[![中文说明](https://img.shields.io/badge/中文说明-DD94F30?style=flat-square)](README_zh.md)

**paper-to-course** 是一个 [Claude Code](https://claude.ai/code) 技能，能将任意学术论文转换为：

- **交互式 HTML 课程** — 单页可滚动，支持公式、时间线、对比表、消融图、对话动画、测验
- **Markdown 文档** — 纯文本版本，代码块、LaTeX 公式、表格均保留
- **PPTX 演示文稿** — 通用幻灯片系统，JSON 配置驱动，适用于所有工科论文

---

## ✨ 功能特色

- **7 种交互元素** — 公式拆解、发展时间线、方法对比表、消融图、组件对话动画、理解测验、术语提示
- **6 模块课程体系** — 问题与动机 → 发展脉络 → 主流方法对比 → 方法详解 → 实验与验证 → 局限与展望
- **通用 PPTX 生成器** — 基于 JSON 配置，适用于所有工科/研究论文
- **Markdown 导出** — 代码块、LaTeX 公式、表格均保留
- **单文件输出** — 完全自包含，零依赖，离线可用
- **温暖设计** — 米白 + 珊瑚红美学，别致字体

---

## 🚀 快速开始

### 方法一：`npx skills add`（推荐）

```bash
npx skills add KaguraTart/paper-to-course
```

### 方法二：手动复制

```bash
git clone https://github.com/KaguraTart/paper-to-course.git
cp -r paper-to-course ~/.claude/skills/
```

### 方法三：Claude Code 插件市场

```bash
/plugin marketplace add anthropics/skills
/plugin install paper-to-course
```

### 使用

在 Claude Code 中对任意项目说：

```
把这篇论文转成课程
```

---

## 📂 项目结构

```
paper-to-course/
├── SKILL.md                    # Claude Code 技能说明
├── README.md / README_zh.md    # 中英双语使用文档
├── scripts/
│   ├── build-all.js          # 统一流水线：HTML + MD + PPTX + 截图
│   ├── generate-pptx.js     # 通用 PPTX 生成器（JSON 配置驱动）
│   └── html-to-md.js         # HTML → Markdown 转换器
└── references/                 # 设计系统
    ├── styles.css             # 完整设计系统
    ├── main.js               # 交互引擎
    ├── _base.html            # HTML 模板
    ├── _footer.html          # HTML 尾部
    └── paper-elements.md      # 7 种元素实现模式
```

---

## 📦 统一构建流水线

```bash
# 构建中文版
node scripts/build-all.js ./my-paper-course --zh --output ./output

# 构建英文版
node scripts/build-all.js ./my-paper-course --en

# 仅生成 PPTX（HTML 已生成后）
node scripts/build-all.js ./output --slides-only
```

**期望的课程目录结构：**
```
my-paper-course/
├── modules/                   # module-01.html, module-02.html, ...
└── slides-config.json        # （可选）PPTX 幻灯片配置
```

**前置依赖：**
```bash
npm install -g pptxgenjs puppeteer-core
# Chrome/Chromium 需要安装并在 PATH 中（设置 CHROME_BIN 环境变量）
```

---

## 🖨️ 通用 PPTX 生成器

`generate-pptx.js` **完全基于 JSON 配置**，适用于所有工科/研究论文。

```bash
node scripts/generate-pptx.js output.pptx --config slides-config.json
```

### 支持的幻灯片类型

| Type | 说明 |
|------|------|
| `outline` | 双栏编号列表 |
| `content` | bullets / cards-2/3/4 / grid-2x2 / steps |
| `flow` | 水平流程管道（编号方块 + 箭头） |
| `table` | 多列对比表 |
| `bars` | 水平条形图 |
| `stats` | 大数字统计卡片 |
| `formula` | 公式 + 逐行解释 |
| `quote` | 核心启示引用框 |
| `timeline` | 垂直时间线 |
| `summary` | 双栏总结卡片 |

### slides-config.json 示例

```json
{
  "title": "论文标题",
  "subtitle": "副标题 / 论文名",
  "slides": [
    { "type": "outline", "items": ["第一部分", "第二部分", "第三部分"] },
    { "type": "content", "title": "背景", "layout": "cards-3",
      "cards": [
        { "title": "问题A", "text": "描述内容", "color": "#D94F30" },
        { "title": "问题B", "text": "描述内容", "color": "#7C3AED" }
      ]
    },
    { "type": "table", "title": "Benchmark 对比",
      "headers": ["模型", "Score"],
      "rows": [["A", "90%"], ["B", "85%"]]
    },
    { "type": "bars", "title": "消融实验",
      "items": [
        { "label": "完整模型", "value": 96, "baseline": 100, "isBaseline": true },
        { "label": "w/o X", "value": 80, "drop": 16 }
      ]
    }
  ]
}
```

---

## 🔌 接入其他 CLI 工具

```bash
# 安装 Codex
npx skills add openai/codex

# 安装 skill-publisher（自动发布）
npx skills add joeseesun/skill-publisher

# 从任意 GitHub 安装
npx skills add <owner>/<repo>
```

### openclaw 接入

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
openclaw onboard
cp -r paper-to-course ~/.openclaw/skills/
```

### Claude Code 插件市场

| 市场 | 命令 |
|------|------|
| Anthropic 官方 | `/plugin marketplace add anthropics/skills` |
| 社区市场 | `/plugin marketplace add jamesrochabrun/skills` |
| Focus.AI | `/plugin marketplace add the-focus-ai/claude-marketplace` |

---

## 🌍 发布到 Skills 平台

### 方式一：GitHub（推荐）

1. 创建公开仓库，包含有效 `SKILL.md`（含 YAML frontmatter）
2. 编写清晰文档
3. （可选）使用 `skill-publisher` 自动化发布
4. 用户通过 `npx skills add <owner>/<repo>` 安装

### 方式二：插件市场提交

- **Anthropic 官方 skills：** PR 到 `github.com/anthropics/skills`
- **社区市场：** PR 到各自仓库

### 方式三：openclaw Skills 平台

提交到 [openclaw skills 注册中心](https://openclaw.ai/skills)

### 方式四：OpenCode Skills

检查是否支持 `npx skills add` 命令，或通过 `/plugin marketplace add` 接入。

---

## 🎓 适用场景

| 使用者 | 如何受益 |
|--------|---------|
| **ML/AI 研究者** | 快速摸底新论文的核心贡献 |
| **博士生** | 系统学习新子领域 |
| **研究团队** | 为新成员创建入门材料 |
| **教育工作者** | 将论文转化为带测验的互动课件 |

---

## 📋 环境要求

- [Claude Code](https://claude.ai/code) — 任意版本
- Node.js（PPTX 生成用）
- Chrome/Chromium（截图用）

---

## 📜 协议

MIT — 可自由使用、修改和分发。引用请注明来源。
