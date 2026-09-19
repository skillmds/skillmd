# 第三方出處與授權（Third-Party Notices）

本 skill 的核心工作流（內容清點、敏感攔截、圖表數據驗算、視覺驗收）為原創。
以下資產來自第三方，依其授權條款重新散布，並在此標記出處。

## bold-template-pack/

- **內容**：34 個視覺風格的設計規格（`design.md`／`preview.md`）、`selection-index.json`、`README.md`、`deck-stage.js`。皆為「設計配方」文件，不含可直接執行的 `template.html`。
- **來源**：[frontend-slides](https://github.com/) skill，作者 **Zara Zhang**。
- **授權**：MIT License，`Copyright (c) 2025 Zara Zhang`。完整條文見 `bold-template-pack/LICENSE`。
- **上游**：這些設計系統源自 **`zarazhangrui/beautiful-html-templates`**。可直接執行的 `template.html` 模板留在該上游 repo，未隨本包散布；若日後要納入，需另行確認該 repo 的授權。

## references/design-taste.md

- **內容**：設計品味準則（設計判讀、三旋鈕配置、字體／配色紀律、版型紀律、AI 味禁用清單、動效紀律、品味驗收清單）。
- **來源**：改寫自 [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) 的 `design-taste-frontend` skill。原作針對網頁前端（landing page／portfolio），本檔已全面改寫為適用於單一 HTML 簡報的版本。
- **授權**：MIT License，`Copyright (c) 2026 Leonxlnx`。原始條文見該 repo 的 `LICENSE`；本節即為 MIT 要求的出處聲明。

### MIT 合規重點（散布本 skill 時務必保留）

1. 保留 `bold-template-pack/LICENSE`（含版權聲明與授權全文）隨包散布。
2. 本 `CREDITS.md` 一併保留。
3. 上 GitHub 時，於專案 README 增設「Acknowledgements / Credits」段落，連結 frontend-slides（Zara Zhang）、`zarazhangrui/beautiful-html-templates` 與 `Leonxlnx/taste-skill`，並註明 MIT。

> 註：MIT 允許複製、修改、再散布與商用，唯一條件是附上上述版權與授權聲明。本文件即為履行該條件。
