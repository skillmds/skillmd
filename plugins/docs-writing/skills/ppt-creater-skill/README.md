# ppt-creater-skills

**[中文](#中文)** · **[English](#english)**

---

## 中文

把凌亂的文件（會議逐字稿、多場會議混檔、實驗／數據報告、論文、財報）變成**可直接上台的設計感簡報**的 Claude skill。

它跟一般「一鍵生成簡報」工具不同——它**先一次問完所有設定**，再**一層一層地**把內容想清楚、把數據驗算對，最後交給視覺生產：

0. **預設問卷** — 一次問完所有設定（素材來源、受眾、尺寸、品牌資產、版型偏好），**填完就一路跑到底**。
1. **提煉＋清點** — 回報文件範圍、每個區塊標記去向、**把敏感資料攔進備援區**，然後**停下來等你確認**；若你帶著自己的大綱來，切換為**診斷模式**：找漏洞、查邏輯、不直接生產。
2. **模板選擇** — 根據你的內容與場合，從 **34 種風格模板庫**篩出 3–5 個候選，⛔ 等你挑選後再進配色。
3. **風格規格** — 把「有設計感」翻成具體色碼、字體、版型；套入選定模板；若有品牌資產則先擷取品牌色；並依**設計品味準則**（設計判讀＋三旋鈕＋字體／配色紀律）節制每個設計決策。
4. **生成** — 單一 HTML、對應 Canvas 格式（16:9 / 4:3 / 9:16 / A4）、不准加料；可選 **Morph Transition**（Keynote Magic Move 式轉場：前後頁同一物件平滑移動／縮放，零依賴 FLIP 實作，說「我要 Magic Move 效果」即可）。
5. **圖表驗算** — 所有圖用原始數據實際計算，**畫圖前先重算文件聲稱的統計值**，抓出原文錯誤，標註待核。
6. **視覺驗收** — 預期 vs 實際、截圖逐頁核對、只改指定頁；並加掃 **AI 味禁用清單**（破折號、章節編號眉標、裝飾圓點、假精確數字…）。
7. **複盤封裝** — 把整套流程存成可重用 SOP。

設計哲學：**AI 量產，人把關**；也可以**人做判斷，AI 找問題**。不要外包大腦給 AI——你整理大綱、AI 診斷缺口，比讓 AI 猜你要說什麼有效得多。三個裁決權永遠在人：備援區去留、模板選擇、圖表數字不一致。

### 安裝

**方法 A — 終端一步安裝（最快）**

不需要 Git，直接貼進終端機執行：

```bash
curl -L https://github.com/Yu-0312/ppt-creater-skills/archive/refs/heads/main.zip -o /tmp/ppt-creater-skill.zip \
  && unzip -q /tmp/ppt-creater-skill.zip -d /tmp \
  && mkdir -p ~/.claude/skills \
  && mv /tmp/ppt-creater-skills-main ~/.claude/skills/ppt-creater-skill \
  && rm /tmp/ppt-creater-skill.zip \
  && echo "✅ 安裝完成"
```

> 日後更新：重新執行以上指令即可（會覆蓋舊版）。

**方法 B — 直接下載 ZIP**

**👉 [點這裡下載最新版 ZIP](https://github.com/Yu-0312/ppt-creater-skills/archive/refs/heads/main.zip)**

下載後：

```bash
unzip ~/Downloads/ppt-creater-skills-main.zip -d ~/Downloads \
  && mkdir -p ~/.claude/skills \
  && mv ~/Downloads/ppt-creater-skills-main ~/.claude/skills/ppt-creater-skill
```

**方法 C — Git Clone（想追蹤更新）**

```bash
git clone https://github.com/Yu-0312/ppt-creater-skills.git ~/.claude/skills/ppt-creater-skill
```

> 日後更新：`cd ~/.claude/skills/ppt-creater-skill && git pull`

**確認安裝**

重新啟動 Claude Desktop，丟入任意文件說：

> 「幫我做成簡報」

### 在其他 AI 使用（ChatGPT／Claude.ai 網頁版／Gemini 等）

這套 skill 的本體，就是 `SKILL.md` 的工作流程 ＋ `references/` 的紀律規則 ＋ `bold-template-pack/` 的模板規格。除了 Claude Code／Desktop 會**依檔名自動觸發**外，任何 AI 只要能「讀到這些檔案 ＋ 照著 `SKILL.md` 跑」就能用。差別只在**怎麼把檔案餵進去**，以及**哪些步驟能原汁原味執行**。

**先解決一個共同問題：檔案數量。** 本 repo 有 `SKILL.md` ＋ 5 個 references ＋ 約 34 個模板檔，總數超過多數平台的知識庫上限。所以在 Claude.ai 以外的平台，建議先**打包精簡**：把 `SKILL.md` 和 5 個 `references/*.md` 合併成一份，模板只放你這次真正要用的那 1–2 個（或合併成一份）。

#### 1. Claude.ai 網頁版／App（最接近原生，推薦）

Claude.ai 現已原生支援 Skills，幾乎等同 Claude Desktop：

1. **Settings → Capabilities**，開啟 **Code execution and file creation**（Skills 依賴程式執行，關掉就無法使用）。
2. 把整個 `ppt-creater-skill` 資料夾壓成 **.zip**（注意：zip 內要包含**資料夾本身**、`SKILL.md` 在資料夾裡，不能只壓一個 `SKILL.md`）。
3. **Customize → Skills → 上傳** 你的 .zip。
4. 之後在對話裡丟入文件說「幫我做成簡報」，Claude 會自動載入這個 skill。

- 適用方案：Free／Pro／Max／Team／Enterprise（組織統一佈署需 Team／Enterprise）。
- 保真度：**高**——可跑圖表驗算、產出 HTML artifact。唯一較弱的是 Step 6 逐頁截圖比對，改為人眼看 artifact 預覽。

#### 2. ChatGPT（Custom GPT 或 Projects）

ChatGPT 沒有 skill 機制，用「知識庫 ＋ 指令」模擬：

- **做法 A — Custom GPT（可分享、較穩定，需 Plus 以上）**：建立 GPT → **Configure → Knowledge** 上傳檔案（最多 20 個、單檔 512MB）→ 把 `SKILL.md` 全文貼進 **Instructions**，並加一句「嚴格照這份工作流程執行，需要時查閱知識庫檔案」。
- **做法 B — Projects（免費也能用）**：建立 Project → **Sources → Add Sources** 上傳檔案（Free 5 個、Plus/Go 25、Pro 40）→ 在 Project 的 **custom instructions** 貼上 `SKILL.md`。
- Step 5 圖表驗算交給 **Code Interpreter（進階資料分析）**；輸出的 HTML 用 Canvas 或直接複製程式碼存檔、用瀏覽器開。
- 限制：不會依檔名自動觸發，要自己開這個 GPT／Project；逐頁截圖 QA 無法原生執行。

#### 3. Google Gemini（Gems）

1. 建立 **Gem → Instructions** 貼上 `SKILL.md`。
2. **Knowledge → Add files** 上傳參考檔（**上限 10 個**，所以務必先合併精簡）。

- 免費、綁 Google 帳號，與 Workspace 整合。
- 限制：知識檔上限低、程式執行與 HTML 預覽較弱，**圖表驗算與視覺 QA 保真度最低**；較適合「內容大綱 ＋ 模板規格」這種偏文字的步驟。

#### 4. 其他 AI（Grok、Copilot、DeepSeek 等）通用做法

沒有知識庫功能的 AI，用「貼上即用」：

1. 開新對話，第一則訊息貼上 `SKILL.md` 全文（若平台可附檔，順便附上 `references/*.md` 和要用的模板）。
2. 加一句：「以上是你要嚴格遵守的工作流程，現在等我提供素材。」
3. 再丟你的文件。

- 保真度視該 AI 是否支援程式執行與長內容而定。

#### 平台對照

| 平台 | 載入方式 | 自動觸發 | 圖表驗算（需程式） | 視覺 QA 截圖 | 檔案上限 |
| --- | --- | :---: | :---: | :---: | :---: |
| Claude Code／Desktop | `~/.claude/skills/` | ✅ | ✅ | ✅ | 無上限 |
| Claude.ai 網頁／App | 上傳 skill zip | ✅ | ✅ | ⚠️ 人眼 | 高 |
| ChatGPT Custom GPT | Knowledge ＋ Instructions | ❌ 手動開 | ✅ Code Interpreter | ⚠️ | 20 |
| ChatGPT Projects | Sources ＋ 指令 | ❌ 手動開 | ✅ Code Interpreter | ⚠️ | 5–40 |
| Gemini Gem | Knowledge ＋ Instructions | ❌ 手動開 | ⚠️ 弱 | ❌ | 10 |
| Grok／Copilot 等 | 貼上 `SKILL.md` | ❌ 手動開 | 視平台而定 | ❌ | 以附件為主 |

> **誠實聲明（不誇大）：** 除了 Claude，其他平台有兩個先天限制，會讓保真度下降，請照實評估：
>
> - **無法依檔名自動觸發**——只有 Claude 系列（Claude Code／Desktop 與 Claude.ai Skills）會自動載入；ChatGPT、Gemini、Grok 等都得手動開啟對應的 GPT／Gem／Project，或先把 `SKILL.md` 貼進去。
> - **做不到 Step 6 逐頁截圖比對**——只有 Claude Code／Desktop 有無頭瀏覽器能真正截圖、做像素級核對；Claude.ai 只能人眼看 artifact 預覽，其他平台更無法執行。

### 流程總覽

| 步 | 做什麼 | 人工裁決 |
|---|---|---|
| **0** | 預設問卷：一次問完素材、受眾、格式、品牌、設計偏好 | ✅ 全部功能開關 |
| 前置 | 路徑分流（有素材 / 主題研究 / 跨 session 銜接）| — |
| **1** | 提煉＋清點 → ⛔ 停下確認範圍與備援區 | ✅ 備援區去留 |
| **2** | 模板選擇：從 34 種風格篩出 3–5 候選 → ⛔ 等你選 | ✅ 使用者挑模板 |
| **3** | 風格規格（套入模板；品牌色擷取；Refine Spec opt-in）| ✅ Refine Spec（opt-in）|
| **4** | 生成（單一 HTML，Canvas 格式對應 Step 0 設定）| — |
| **5** | 圖表驗算（原始數據繪製、重算統計值、抓錯標註）| ✅ 重大數字差異 |
| **6** | 視覺驗收（預期 vs 實際、截圖逐頁核對、品味清單）| ✅ |
| **7** | 複盤封裝（整理成可重用 SOP）| — |

### 檔案結構

```
ppt-creater-skills/
├── SKILL.md                      # 主流程（Step 0–7）
├── references/
│   ├── prompts.md                # 各步 prompt 模板
│   ├── chart-integrity.md        # 圖表驗算紀律
│   ├── visual-craft.md           # 版面工藝（不崩版）
│   ├── design-taste.md           # 設計品味準則（不像 AI 生的）
│   └── morph-transition.md       # Morph Transition（Magic Move 式轉場）
├── bold-template-pack/           # 34 種風格設計規格
├── CREDITS.md                    # 第三方授權
├── LICENSE                       # MIT License
└── README.md
```

### 與其他 Deck Skill 接力（可選）

本 skill 是「內容＋數據的大腦」，生成這一步可交棒給專做視覺生產的 skill：

- **guizang-ppt-skill** — 深度型，2 種精裝風格（電子雜誌風／瑞士國際主義風）＋驗版腳本。
- **frontend-slides** — 廣度型，30+ 種風格＋16:9 舞台＋PPTX 匯入＋部署 URL／PDF 匯出。
- **[open-slide](https://open-slide.dev)** — 框架型，React/MDX 簡報專案＋原生 `MorphElement`（Morph Transition）＋主題系統＋export。適合要長期維護、或重度使用 Morph 轉場的簡報（`npx @open-slide/cli init` 建專案）。

### 致謝與授權

- 本專案**原創部分**採 **MIT License**，見 [`LICENSE`](LICENSE)。
- `bold-template-pack/` 來自 **[frontend-slides](https://github.com/zarazhangrui/frontend-slides)**，作者 **Zara Zhang**，MIT License，見 [`bold-template-pack/LICENSE`](bold-template-pack/LICENSE)。上游為 **[`zarazhangrui/beautiful-html-templates`](https://github.com/zarazhangrui/beautiful-html-templates)**。
- 部分工作流設計概念（主題研究前置、執行紀律標記、品牌擷取）參考並改寫自 **[hugohe3/ppt-master](https://github.com/hugohe3/ppt-master)**（MIT License，Copyright © 2025–2026 Hugo He）。
- `references/design-taste.md` 的設計品味準則改寫自 **[Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill)**（MIT License，Copyright © 2026 Leonxlnx），原作針對網頁前端，本專案改寫為簡報版。
- `references/morph-transition.md` 的「同 id 配對契約」概念參考 **[open-slide](https://open-slide.dev/docs/primitive/morph-element)** 的 `MorphElement` primitive（作者 1weiho），本專案以 FLIP 技術移植為單一 HTML 版本。
- 完整說明見 [`CREDITS.md`](CREDITS.md)。

---

## English

A Claude skill that transforms messy documents (meeting transcripts, multi-meeting dumps, experiment/data reports, papers, financial statements) into **presentation-ready, design-quality slides**.

Unlike typical "one-click slide generators," this skill starts by **collecting all your preferences upfront in a single message**, then proceeds layer by layer: content first, then design spec, then generation:

0. **Upfront Config** — Collects all settings in one message (source material, audience, canvas format, brand assets, style preferences) before any work begins.
1. **Distill + Inventory** — Reports scope, tags every section, intercepts sensitive data into a reserve area, then **stops and waits for your confirmation**. If you bring your own outline, switches to **critique mode**: finds gaps and logic issues instead of producing.
2. **Template Selection** — Shortlists 3–5 templates from a **34-style library** based on your content and context; ⛔ waits for your pick before proceeding to color.
3. **Style Specification** — Translates "make it look designed" into hex codes, fonts, and layouts, applied on top of your chosen template, with brand color extraction and **design-taste rules** (design read, three dials, typography/color discipline) governing every decision.
4. **Generate** — Single HTML file, matching canvas format (16:9 / 4:3 / 9:16 / A4), no improvising; optional **Morph Transition** (Keynote Magic Move-style: the same object glides and scales across page cuts, zero-dependency FLIP implementation — just say "I want Magic Move").
5. **Chart Verification** — Every chart is drawn from raw data; re-computes every claimed statistic before drawing and flags discrepancies without guessing or inventing.
6. **Visual QA** — Expected vs. actual, screenshot-by-screenshot, only the specified pages get touched, plus an **anti-AI-slop checklist sweep** (em-dashes, numbered eyebrows, decorative dots, fake-precise numbers…).
7. **Retrospective Packaging** — Saves the entire workflow as a reusable SOP.

Design philosophy: **AI produces, humans decide**, or flip it: **you lead the thinking, AI finds the gaps**. Don't outsource your brain. Bring your own outline; let AI diagnose what's missing or unclear. Either way, three decisions always stay with you: reserve area, template pick, chart discrepancies.

### Installation

**Option A — One-line Terminal Install (fastest)**

No Git required. Paste and run in Terminal:

```bash
curl -L https://github.com/Yu-0312/ppt-creater-skills/archive/refs/heads/main.zip -o /tmp/ppt-creater-skill.zip \
  && unzip -q /tmp/ppt-creater-skill.zip -d /tmp \
  && mkdir -p ~/.claude/skills \
  && mv /tmp/ppt-creater-skills-main ~/.claude/skills/ppt-creater-skill \
  && rm /tmp/ppt-creater-skill.zip \
  && echo "✅ Installed successfully"
```

> To update: re-run the same command (overwrites the old version).

**Option B — Direct ZIP Download**

**👉 [Download the latest ZIP](https://github.com/Yu-0312/ppt-creater-skills/archive/refs/heads/main.zip)**

After downloading:

```bash
unzip ~/Downloads/ppt-creater-skills-main.zip -d ~/Downloads \
  && mkdir -p ~/.claude/skills \
  && mv ~/Downloads/ppt-creater-skills-main ~/.claude/skills/ppt-creater-skill
```

**Option C — Git Clone (stay in sync)**

```bash
git clone https://github.com/Yu-0312/ppt-creater-skills.git ~/.claude/skills/ppt-creater-skill
```

> To update later: `cd ~/.claude/skills/ppt-creater-skill && git pull`

**Verify installation**

Restart Claude Desktop, drop in a document and say:

> "Turn this into slides."

### Using in Other AIs (ChatGPT / Claude.ai web / Gemini, etc.)

This skill *is* the workflow in `SKILL.md` + the discipline rules in `references/` + the template specs in `bold-template-pack/`. Only Claude Code / Desktop **auto-triggers it by filename** — but any AI can use it as long as it can *read these files and follow `SKILL.md`*. The only differences are **how you feed the files in** and **which steps run at full fidelity**.

**Solve one shared problem first: file count.** This repo has `SKILL.md` + 5 references + ~34 template files — more than most platforms' knowledge-base limits. So outside Claude.ai, **bundle and trim first**: merge `SKILL.md` with the 5 `references/*.md` into one file, and include only the 1–2 templates you actually need for this deck (or merge them into one).

#### 1. Claude.ai web / App (closest to native — recommended)

Claude.ai now supports Skills natively, almost identical to Claude Desktop:

1. **Settings → Capabilities**, turn on **Code execution and file creation** (Skills depend on code execution; disabling it disables Skills).
2. Zip the whole `ppt-creater-skill` folder into a **.zip** (note: the zip must contain the **folder itself** with `SKILL.md` inside — not a bare `SKILL.md`).
3. **Customize → Skills → upload** your .zip.
4. In any chat, drop in a document and say "Turn this into slides." Claude loads the skill automatically.

- Plans: Free / Pro / Max / Team / Enterprise (org-wide provisioning needs Team / Enterprise).
- Fidelity: **high** — runs chart verification, produces an HTML artifact. The only weak spot is Step 6's per-page screenshot diff, which becomes eyeballing the artifact preview.

#### 2. ChatGPT (Custom GPT or Projects)

ChatGPT has no skill mechanism; emulate it with "knowledge + instructions":

- **Option A — Custom GPT (shareable, more stable; needs Plus+):** Create a GPT → **Configure → Knowledge** to upload files (up to 20 files, 512MB each) → paste `SKILL.md` into **Instructions** with a line like "Follow this workflow strictly; consult the knowledge files when needed."
- **Option B — Projects (works on Free):** Create a Project → **Sources → Add Sources** to upload files (Free 5, Plus/Go 25, Pro 40) → paste `SKILL.md` into the Project's **custom instructions**.
- Step 5 chart verification runs on **Code Interpreter (Advanced Data Analysis)**; take the output HTML from Canvas or copy the code, save it, and open in a browser.
- Limits: won't auto-trigger by filename — you open the GPT/Project yourself; per-page screenshot QA can't run natively.

#### 3. Google Gemini (Gems)

1. Create a **Gem → Instructions** and paste `SKILL.md`.
2. **Knowledge → Add files** to upload references (**10-file cap**, so bundle/trim first).

- Free, tied to your Google account, integrates with Workspace.
- Limits: low knowledge cap, weaker code execution and HTML preview — **lowest fidelity for chart verification and visual QA**; best for the text-heavy steps (content outline + template spec).

#### 4. Other AIs (Grok, Copilot, DeepSeek, etc.) — the generic method

For any AI without a knowledge base, use "paste-and-go":

1. In a new chat, paste the full `SKILL.md` as your first message (if the platform allows attachments, attach `references/*.md` and the template you'll use too).
2. Add: "That's the workflow you must follow strictly. Now wait for my source material."
3. Then drop in your document.

- Fidelity depends on whether that AI supports code execution and long context.

#### Platform comparison

| Platform | How to load | Auto-trigger | Chart verify (needs code) | Visual-QA screenshots | File cap |
| --- | --- | :---: | :---: | :---: | :---: |
| Claude Code / Desktop | `~/.claude/skills/` | ✅ | ✅ | ✅ | none |
| Claude.ai web / App | Upload skill zip | ✅ | ✅ | ⚠️ by eye | high |
| ChatGPT Custom GPT | Knowledge + Instructions | ❌ open manually | ✅ Code Interpreter | ⚠️ | 20 |
| ChatGPT Projects | Sources + instructions | ❌ open manually | ✅ Code Interpreter | ⚠️ | 5–40 |
| Gemini Gem | Knowledge + Instructions | ❌ open manually | ⚠️ weak | ❌ | 10 |
| Grok / Copilot, etc. | Paste `SKILL.md` | ❌ open manually | depends | ❌ | attachments |

> **Honest caveat (no overselling):** Outside Claude, two inherent limits lower fidelity — plan around them:
>
> - **No filename auto-trigger** — only the Claude family (Claude Code / Desktop and Claude.ai Skills) auto-loads by description; ChatGPT, Gemini, Grok, etc. all require you to open the GPT/Gem/Project manually or paste `SKILL.md` first.
> - **No Step 6 per-page screenshot diff** — only Claude Code / Desktop has a headless browser for real pixel-level screenshot checks; Claude.ai falls back to eyeballing the artifact, and other platforms can't do it at all.

### Workflow Overview

| Step | What | Human Decision |
|---|---|---|
| **0** | Upfront config: source, audience, format, brand, style in one message | ✅ All toggles |
| Pre | Path routing (has material / topic research / cross-session resume) | — |
| **1** | Distill + inventory → ⛔ confirm scope and reserve area | ✅ Reserve area |
| **2** | Template selection: 3–5 candidates from 34 styles → ⛔ your pick | ✅ Template pick |
| **3** | Style spec (template applied; brand extraction; Refine Spec opt-in) | ✅ Refine Spec (opt-in) |
| **4** | Generate (single HTML, canvas format from Step 0) | — |
| **5** | Chart verification (draw from raw data, re-compute stats, flag errors) | ✅ Major discrepancies |
| **6** | Visual QA (expected vs. actual, per-page screenshots, taste checklist) | ✅ |
| **7** | Retrospective packaging (reusable SOP) | — |

### File Structure

```
ppt-creater-skills/
├── SKILL.md                      # Main workflow (Step 0–7)
├── references/
│   ├── prompts.md                # Ready-to-paste prompt templates
│   ├── chart-integrity.md        # Chart data verification rules
│   ├── visual-craft.md           # Visual craft (no broken layouts)
│   ├── design-taste.md           # Design taste (anti-AI-slop)
│   └── morph-transition.md       # Morph Transition (Magic Move-style)
├── bold-template-pack/           # 34 style design specs
├── CREDITS.md                    # Third-party attribution
├── LICENSE                       # MIT License
└── README.md
```

### Chaining with Other Deck Skills (Optional)

This skill is the **content + data brain**. The generation step can hand off to a visual production skill:

- **guizang-ppt-skill** — Depth-focused: 2 refined styles (e-magazine / Swiss International) + verification script.
- **frontend-slides** — Breadth-focused: 30+ styles + fixed 16:9 stage + PPTX import + deploy URL / PDF export.
- **[open-slide](https://open-slide.dev)** — Framework-based: React/MDX slide projects + native `MorphElement` (Morph Transition) + theme system + export. Best for long-lived decks or heavy Morph usage (`npx @open-slide/cli init`).

### Acknowledgements

- The **original work** is released under the **MIT License**; see [`LICENSE`](LICENSE).
- `bold-template-pack/` comes from **[frontend-slides](https://github.com/zarazhangrui/frontend-slides)** by **Zara Zhang**, MIT License; see [`bold-template-pack/LICENSE`](bold-template-pack/LICENSE). Upstream: **[`zarazhangrui/beautiful-html-templates`](https://github.com/zarazhangrui/beautiful-html-templates)**.
- Some workflow concepts (topic research pre-step, execution discipline markers, brand extraction) are adapted from **[hugohe3/ppt-master](https://github.com/hugohe3/ppt-master)** (MIT License, Copyright © 2025–2026 Hugo He).
- The design-taste rules in `references/design-taste.md` are adapted from **[Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill)** (MIT License, Copyright © 2026 Leonxlnx); the original targets web frontends, rewritten here for slide decks.
- The same-id matching contract in `references/morph-transition.md` is inspired by the `MorphElement` primitive of **[open-slide](https://open-slide.dev/docs/primitive/morph-element)** (by 1weiho), ported here to single-file HTML via the FLIP technique.
- Full third-party attribution: [`CREDITS.md`](CREDITS.md).
