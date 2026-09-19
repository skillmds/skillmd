<div align="center">

<img src="https://img.shields.io/badge/Agentic-AI%20Driven%20Kaggle-9cf?style=for-the-badge&logo=kaggle&logoColor=white" alt="Agentic Kaggle"/>

<br>

# Agentic Kaggle Skill
# 智能体驱动的 Kaggle Skill

<p align="center">
  <strong>Turn AI agents into Kaggle teammates</strong><br>
  <strong>让 AI 智能体成为你的 Kaggle 队友</strong>
  <br/>
  <sub>Reusable workflow for validation, modeling, Kaggle execution, debugging, ensembling, and scored submission.</sub><br>
  <sub>覆盖验证、建模、Kaggle 执行、调试、集成和最终得分提交的可复用工作流。</sub>
</p>

<p align="center">
  <a href="#what-it-does--这个-skill-能做什么">What It Does</a> |
  <a href="#install--安装">Install</a> |
  <a href="#repository-layout--仓库结构">Layout</a> |
  <a href="#attribution-and-safety--归属与安全">Safety</a>
</p>

<p align="center">
  <img src="https://img.shields.io/github/stars/FrankS-IntelLab/agentic-kaggle-skill?style=social" alt="GitHub stars"/>
  <img src="https://img.shields.io/github/forks/FrankS-IntelLab/agentic-kaggle-skill?style=social" alt="GitHub forks"/>
</p>

**Distilled from real Kaggle competition experience**
**提炼自真实 Kaggle 竞赛实践**

Including: **RL Game AI** | **Audio Classification** | **LLM Reasoning** | Multi-stage debugging journeys
包括：**强化学习游戏 AI** | **音频分类** | **LLM 推理** | 多阶段调试实践

</div>

## Supported Agents / 支持的智能体

| Agent | Status 状态 | Notes 说明 |
| --- | --- | --- |
| Codex | First-class 一等支持 | Uses `SKILL.md`, `agents/openai.yaml`, `references/`, and `scripts/`. |
| Hermes | Supported 支持 | Uses the same skill folder. Hermes-era examples remain in `references/research/`. |

## Canonical Skill Identity / 统一 Skill 名称

This repository keeps one canonical skill identity:

本仓库使用一个统一的 skill 名称：

```yaml
name: agentic-kaggle-skill
```

The skill is written in the open agent skills format so it can be used by multiple agents. Codex-specific metadata lives in `agents/openai.yaml`; Hermes users can consume the same root `SKILL.md` and bundled resources.

该 skill 使用开放 agent skill 格式编写，可被多个智能体使用。Codex 专属元数据放在 `agents/openai.yaml`；Hermes 用户可以直接使用根目录的 `SKILL.md` 以及配套的 `references/` 和 `scripts/`。

## What It Does / 这个 Skill 能做什么

Transform Kaggle work from scattered manual iteration into an agent-assisted competition loop:

将 Kaggle 工作从零散的手动试错转为智能体辅助的竞赛闭环：

| Before 之前 | After 之后 |
| --- | --- |
| Manual notebook analysis 手动分析 notebook | Agent scouts public notebooks and discussions as signals 智能体将公开 notebook 和讨论作为线索 |
| Guess why submissions fail 猜测提交失败原因 | Agent diagnoses format, path, runtime, and hidden rerun issues 智能体诊断格式、路径、运行时和隐藏重跑问题 |
| Try random improvements 随机尝试改进 | Fold-driven validation and OOF-safe iteration 基于 fold 和 OOF 的稳健迭代 |
| One overloaded notebook 一个超载 notebook | Producer/consumer pipeline with private artifact datasets 使用私有 artifact dataset 的生产者/消费者流水线 |

Core capabilities:

核心能力：

- Read Kaggle rules, data terms, metric, submission format, and scoring mode before modeling.
  建模前先阅读竞赛规则、数据条款、指标、提交格式和评分模式。
- Build metric-correct baselines with stable folds and out-of-fold predictions.
  构建指标正确、fold 稳定、带 OOF 预测的 baseline。
- Use public notebook and discussion intelligence as scouting signals, not copied source.
  将公开 notebook 和讨论作为侦察信号，而不是直接复制来源。
- Offload heavy work to Kaggle notebooks/scripts when local compute is insufficient.
  本地算力不足时，将重任务转移到 Kaggle notebook/script。
- Support staged producer/consumer notebook pipelines with private artifact datasets.
  支持带私有 artifact dataset 的多阶段生产者/消费者 notebook 流水线。
- Handle code-competition hidden rerun failures, vague scoring errors, timeouts, and OOMs.
  处理代码竞赛隐藏重跑失败、模糊评分错误、超时和 OOM。
- Track reproducibility artifacts, run logs, score receipts, and ensemble evidence.
  记录可复现 artifact、运行日志、提交回执和集成证据。
- Continue toward a scored Kaggle submission or record a concrete blocker.
  持续推进到 Kaggle 得分提交，或记录明确阻塞原因。

## Install / 安装

### Codex

Install as a user-level Codex skill:

作为用户级 Codex skill 安装：

```bash
mkdir -p ~/.agents/skills
git clone https://github.com/FrankS-IntelLab/agentic-kaggle-skill.git \
  ~/.agents/skills/agentic-kaggle-skill
```

Restart Codex if the skill does not appear immediately. Invoke it explicitly with:

如果 skill 没有立即出现，请重启 Codex。可以这样显式调用：

```text
Use $agentic-kaggle-skill to help me start this Kaggle competition.
```

For repo-scoped development, place or symlink this folder under a repository's `.agents/skills/` directory:

如果只想在某个仓库中启用，可以把该目录放到或软链接到仓库的 `.agents/skills/`：

```bash
mkdir -p .agents/skills
ln -s /path/to/agentic-kaggle-skill .agents/skills/agentic-kaggle-skill
```

### Hermes

Install the whole skill folder so references and scripts are available:

安装完整 skill 目录，确保 references 和 scripts 都可用：

```bash
mkdir -p ~/.hermes/skills/data-science
git clone https://github.com/FrankS-IntelLab/agentic-kaggle-skill.git \
  ~/.hermes/skills/data-science/agentic-kaggle
```

Then ask Hermes to use the agentic Kaggle skill for competition work.

然后让 Hermes 使用 agentic Kaggle skill 来处理竞赛任务。

### Helper Script Dependencies / 辅助脚本依赖

Most scripts use only the Python standard library. `scripts/make_folds.py` requires pandas and numpy; scikit-learn is recommended for standard splitters.

大部分脚本只依赖 Python 标准库。`scripts/make_folds.py` 需要 pandas 和 numpy；推荐安装 scikit-learn 以使用标准切分器。

```bash
python3 -m pip install -r requirements.txt
```

## Repository Layout / 仓库结构

```text
agentic-kaggle-skill/
├── SKILL.md
├── agents/
│   └── openai.yaml
├── references/
│   ├── method-map.md
│   ├── information-sharing-policy.md
│   ├── competition-intel.md
│   ├── cross-validation-and-metrics.md
│   ├── tabular-workflow.md
│   ├── image-text-workflow.md
│   ├── kaggle-code-competition-pipeline.md
│   ├── advanced-notebook-architecture.md
│   ├── kaggle-offload.md
│   ├── kaggle-pipeline-datasets.md
│   ├── submission-endgame.md
│   ├── code-competition-debugging.md
│   ├── ensembling-and-reproducibility.md
│   └── research/
├── scripts/
│   ├── scaffold_competition.py
│   ├── make_folds.py
│   ├── prepare_kaggle_kernel.py
│   └── prepare_kaggle_dataset.py
├── examples/
│   ├── rl-game-case-study.md
│   └── audio-classification-case-study.md
├── requirements.txt
├── README.md
└── LICENSE
```

## Case Studies / 案例研究

### RL Strategy Game Competition / 强化学习策略游戏竞赛

| Lesson 教训 | Details 详情 |
| --- | --- |
| Feature completeness 功能完整性 | Top agents used much richer decision logic; simplified agents underperformed. 顶级 agent 使用更完整的决策逻辑，简化版表现明显较弱。 |
| Time budget 时间预算 | Strict turn limits require profiling after each change. 严格回合限制要求每次改动后都做性能分析。 |

[Full case study / 完整案例](examples/rl-game-case-study.md)

### Audio Classification Competition / 音频分类竞赛

| Lesson 教训 | Details 详情 |
| --- | --- |
| Hybrid ensemble 混合集成 | Temporal model plus SED-style models can improve robustness. 时序模型加 SED 风格模型可提升稳健性。 |
| Silent failures 静默失败 | Log exceptions during feature extraction and inference. 特征提取和推理阶段需要记录异常。 |

[Full case study / 完整案例](examples/audio-classification-case-study.md)

## Design Notes / 设计说明

`SKILL.md` is the canonical entry point. It stays concise and tells the agent which reference file to load for each Kaggle workflow.

`SKILL.md` 是统一入口，保持简洁，并告诉智能体在不同 Kaggle 工作流中应该加载哪个参考文件。

`agents/openai.yaml` is Codex-facing UI metadata. It does not fork the workflow; it only improves how the skill appears and is invoked in Codex.

`agents/openai.yaml` 是面向 Codex 的 UI 元数据，不分叉工作流，只改善该 skill 在 Codex 中的展示与调用体验。

`references/` contains detailed workflow guidance loaded only when relevant. The `references/research/` folder preserves earlier Hermes-era lessons, troubleshooting notes, automation patterns, and case-specific insights.

`references/` 存放按需加载的详细流程说明。`references/research/` 保留早期 Hermes 阶段的经验、故障排除、自动化模式和具体案例洞察。

`scripts/` contains repeatable utilities for scaffolding a Kaggle project, making folds, preparing Kaggle kernels, and preparing private Kaggle artifact datasets.

`scripts/` 存放可复用工具，用于创建 Kaggle 项目骨架、生成 folds、准备 Kaggle kernels，以及准备私有 Kaggle artifact datasets。

## Attribution And Safety / 归属与安全

This skill is source-agnostic. It packages general competitive ML and Kaggle workflow procedures rather than copying named public notebooks, books, or papers.

该 skill 是 source-agnostic 的。它封装的是通用竞赛机器学习和 Kaggle 工作流流程，而不是复制某个公开 notebook、书籍或论文。

When using public notebooks or discussions during an active competition, treat them as scouting signals. Do not copy code, text, model artifacts, generated features, or data-derived outputs without checking the competition rules, data license, third-party license obligations, and attribution requirements.

在进行中的竞赛中使用公开 notebook 或讨论时，应将其视作侦察信号。不要在未检查竞赛规则、数据许可、第三方许可证义务和归属要求前复制代码、文本、模型 artifact、生成特征或数据派生输出。

## Development / 开发维护

Keep the public identity aligned everywhere:

请保持所有位置的公开名称一致：

```text
agentic-kaggle-skill
```

When updating the skill:

更新 skill 时：

1. Keep the canonical workflow in `SKILL.md`.
   将统一工作流保留在 `SKILL.md`。
2. Put detailed procedure in `references/`.
   将详细流程放入 `references/`。
3. Put deterministic helpers in `scripts/`.
   将确定性辅助工具放入 `scripts/`。
4. Regenerate or update `agents/openai.yaml` when the skill name, scope, or default prompt changes.
   当 skill 名称、范围或默认 prompt 变化时，更新 `agents/openai.yaml`。
5. Validate the skill metadata before release.
   发布前验证 skill 元数据。

## Why Star This Repo? / 为什么 Star？

- Battle-tested patterns from real competitions.
  来自真实竞赛的实战模式。
- Bilingual documentation for English and Chinese users.
  面向英文与中文用户的双语文档。
- Practical troubleshooting for common Kaggle issues.
  覆盖常见 Kaggle 问题的实用故障排除。
- Codex-ready organization with Hermes compatibility.
  Codex-ready 的组织方式，同时兼容 Hermes。
- Case studies with concrete competition lessons.
  带有具体竞赛经验的案例研究。

## Contributing / 贡献

Found a new pattern or solved a tricky error?

发现了新模式或解决了棘手错误？

1. Fork the repo.
   Fork 仓库。
2. Add your insight to `references/research/`, `references/`, or `examples/`.
   将你的洞察添加到 `references/research/`、`references/` 或 `examples/`。
3. Submit a pull request.
   提交 PR。

## License / 许可证

MIT. See `LICENSE`.

MIT。见 `LICENSE`。

<div align="center">

**Made by [Frank S (IntelLab)](https://github.com/FrankS-IntelLab)**
**由 [Frank S (IntelLab)](https://github.com/FrankS-IntelLab) 创建**

[![Kaggle](https://img.shields.io/badge/Kaggle-franksunp-blue?logo=kaggle)](https://www.kaggle.com/franksunp)
[![GitHub](https://img.shields.io/badge/GitHub-FrankS--IntelLab-black?logo=github)](https://github.com/FrankS-IntelLab)

<br>

*If this skill helped your Kaggle journey, star the repo.*
*如果这个 skill 帮助了你的 Kaggle 旅程，欢迎 Star 这个仓库。*

</div>
