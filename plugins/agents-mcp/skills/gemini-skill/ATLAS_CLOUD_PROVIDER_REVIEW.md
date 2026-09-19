# Atlas Cloud Provider Review

## 本次改动

- 新增 `src/atlas-provider.js`，封装 Atlas Cloud 的 OpenAI 兼容接口
- 在 `src/mcp-server.js` 注册 `atlas_list_models`、`atlas_send_message`、`atlas_stream_message`
- 在 `src/index.js` 导出 `createAtlasProvider()`，支持作为库直接调用
- 在 `src/config.js` 补充 Atlas Cloud 相关配置项
- 更新 `.env`，新增 `.env.example`，补充 Atlas Cloud 环境变量说明
- 更新 `README.md` 与 `README.en.md`，加入 Atlas Cloud 图片、接入说明、MCP 工具说明和 UTM 链接

## 设计取舍

- 维持现有 Gemini 浏览器自动化链路，不做大规模架构重构
- Atlas Cloud provider 走纯 API 集成，避免与浏览器登录态耦合
- Streaming 通过服务端消费 SSE 并聚合，便于在本地和 CI 做稳定验证

## 本地验证

- 验证了 Atlas Cloud `/v1/models` 可正常返回模型列表
- 验证了非流式 `chat/completions` 最小请求
- 验证了流式 `chat/completions` 可消费并聚合文本输出
- 验证了 `npm run mcp` 能正常启动并加载新工具

## 未提交内容

- 本地私有 `ATLAS_API_KEY` 放在 git 忽略文件中，仅用于集成测试
- 临时测试脚本仅用于本地验证，不会进入最终 PR
