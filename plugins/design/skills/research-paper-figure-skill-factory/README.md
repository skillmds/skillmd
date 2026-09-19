# 论文制图 Skill 工厂

`research-paper-figure-skill-factory` 用来为论文作图任务创建可复用的专项制图 skill。它不是只帮你临时画一张图，而是把某一类论文图的设计方法、候选方案、视觉风格、状态字段、图像生成边界和检查标准沉淀成一个可以反复使用的作图助手。

![论文启发案例图制图 Skill](docs/assets/inspiration-case-figure-skill.svg)

![论文框架图制图 Skill](docs/assets/paper-framework-figure-skill.svg)

## 设计目的

不同论文图有不同的表达目标。方法框架图、机制解释图、流程图、案例示意图、taxonomy 图、结果总结图和失败分析图，需要不同的判断方式、视觉结构和修改标准。

这个工厂 skill 的目的，是为某一类论文图生成一个专项制图 skill，让后续面对不同论文时，可以按稳定步骤完成 diagram / figure 设计、候选图比较、正式图提示词打磨、修订建议、caption / legend 和正文引用文本。

## 适合用在什么时候

- 想为某一类论文图建立长期可复用的制图流程。
- 不只是想画一张图，而是想生成一个之后能反复使用的作图助手。
- 希望基于本地论文、PDF、图例和参考材料总结图类规律。
- 希望用户先看子类型/风格示意图，再决定图的方向。
- 希望 diagram 的第一轮候选图足够多样，第二轮再围绕论文局部模块、标签、证据/案例和审稿可读性优化。
- 希望把生成的专项制图 skill 打包给 ChatGPT Sources、Codex skills、OpenClaw 或 ClawHub 使用。

## 主要规则

- **专项 skill 优先**：默认流程是先构建某一类论文图的专项制图 skill，再用这个专项 skill 为具体论文制图；除非用户明确选择快速生产路径，否则不能直接跳过构建阶段。
- **尽量使用完整本地语料**：当项目中已有论文 PDF、索引或检索清单时，应枚举完整相关候选集，并尽量处理所有可访问的相关 PDF。少量样本只能支持试验性或受限锁定。
- **首轮只给启动计划**：第一次触发时只输出启动计划，不分析论文、不生成 taxonomy、不生成候选方案、不调用生图。
- **内置子类型/风格图谱**：生成的专项 skill 必须保存 subtype/style atlas，并在启动和后续抽象视觉决策中用 Markdown 图片嵌入展示可用参考图。
- **抽象视觉决策必须配图**：当文本回复解释或比较 subtype、布局语法、视觉风格、密度、metaphor、建模模式、候选方案差异或最终内容架构时，必须嵌入已保存参考图，或嵌入非目标论文的概念图/建模示例图。
- **视觉结构不能只用文字描述**：当文本回复解释视觉结构、布局骨架、panel choreography、module topology、arrow grammar、candidate-board structure、second-round optimization geometry 或 final image-brief structure 时，必须嵌入保存的结构参考图或非目标概念/建模示例图。不能只用段落、列表、表格、ASCII、Mermaid、SVG 或代码渲染草图来替代。
- **目标论文图像严格隔离**：目标论文候选图、二轮变体图、草稿图、正式图、最终图和修订图必须在独立 `IMAGE_ONLY` 步骤中输出，不能嵌入普通文本回复。文本回复中允许嵌入的图片只能是已保存参考图或非目标论文概念/建模示例图。
- **文本候选后必须看图**：出现 4-6 个文本候选方案后，必须进入视觉候选设置和 `IMAGE_ONLY` 候选图生成，通常生成 6 张候选图，不能只让用户从文字中锁定最终方向。
- **第一轮多样，第二轮局部优化**：第一轮候选图应尽量拉开方向差异，用来搭建整体视觉方向。P6 选出当前最佳方向后，必须进入 P6b / P6b-IMAGE / P6c 二轮选择，从论文局部模块关系、证据/案例锚点、标签经济性、panel 过渡、色彩语义、callout 位置和审稿可读性角度进一步优化。
- **自由提问也要对齐状态**：即使用户没有按推荐句式提问，例如直接说“继续”“出图”“改得更简洁”，生成的专项 skill 也必须判断请求对应原流程的哪一步，执行当前可执行部分，并记录处理前后的状态。
- **固定渲染路线**：ChatGPT 网页端使用 Create image / ChatGPT Images 2.0；Codex 中优先使用 `$imagegen`；不可用时再使用批准的图像生成 API。目标论文图像不能用 SVG、Mermaid、TikZ、Graphviz、HTML/CSS、canvas、matplotlib 或代码绘图替代。

## 核心工作流

1. 明确目标图类和要生成的专项制图 skill 目标。
2. 规划并收集合法来源的论文、PDF、图例或本地语料。
3. 尽量处理完整可访问 PDF，提取图形证据、caption、图类标签和视觉观察。
4. 建立图类 taxonomy，并规划 subtype/style atlas 覆盖范围。
5. 生成并保存 subtype/style atlas，包括带标签的总览 board 和必要的分层 board。
6. 生成专项制图 skill，并把 atlas、状态模板、候选图流程、视觉结构配图规则和渲染规则写入包内。
7. 测试并修补生成的 skill，确认启动行为、atlas 展示、概念/结构配图、候选图桥接、二轮选择、文本/图像隔离和状态记录都符合要求。
8. 锁定并打包专项 skill。
9. 使用锁定后的专项 skill 为具体论文制作 figure。

## 生成的专项制图 skill 如何工作

1. **P1 启动/材料导入**：只显示启动计划、材料状态和已保存 atlas，不生成目标论文图像。
2. **P2 图需求诊断**：判断读者问题、论文位置、叙事功能和可能图类，并展示相关参考图。
3. **P3 文本候选**：提出 4-6 个文本方案，通常 6 个，并要求进入视觉候选图流程。
4. **P4 视觉候选设置**：定义候选图数量、多样化轴、固定元素、比较标准和渲染路线；如解释结构，必须嵌入结构参考图。
5. **P5 第一轮候选图**：用 `IMAGE_ONLY` 生成或展示 4-6 张第一轮候选图，通常 6 张，重点是方向多样性。
6. **P6 第一轮复盘**：记录第一轮 image batch，比较候选图，选出当前最佳方向，但不能直接进入最终 prompt。
7. **P6b 二轮优化设置**：从最佳实践和论文局部细节出发，提出 4-6 个优化轴，通常 6 个，并说明固定元素和变化元素。
8. **P6b-IMAGE 二轮变体图**：用新的 `second_round_candidate_batch_id` 生成 4-6 张目标论文二轮变体图，不能复用第一轮 batch 或概念图 id。
9. **P6c 二轮选择**：记录二轮 batch，比较变体，锁定或组合最终方向。
10. **P7 最终图 brief / prompt**：在 P6c 后构建正式图像提示和版面要求。
11. **P8 正式生成/修订**：用 `IMAGE_ONLY` 生成正式图或修订图。
12. **P9 审稿式检查与整合**：输出 critique、caption、legend、正文引用文本和修改建议。

## 简单使用方式

```text
请使用 research-paper-figure-skill-factory，生成一个用于论文 method framework diagram 的制图 skill。
```


生成完成后，你会得到一个新的专项制图 skill zip。之后可以把这个 zip 放入 ChatGPT网页版某个项目的Sources里，然后在聊天时要求严格按照这个zip文件中skill的步骤为具体论文绘图（extended thinking模式）；或安装到 Codex skills 中，用它为具体论文绘图。

## 包信息

- Skill key: `research-paper-figure-skill-factory`
- Version: `v2.0.5`
- License: `MIT-0`
- Entrypoint: `SKILL.md`
- Metadata: `metadata.json`
