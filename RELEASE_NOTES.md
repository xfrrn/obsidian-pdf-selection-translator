# PDF Selection Translator 0.1.2

This update addresses feedback from the Obsidian Community directory review.

- Make the build output discoverable for source-to-release verification.
- Use each PDF window's own selection timer, and explicit Node timers for HTTP requests.
- Validate provider response structures before reading translation fields.
- Remove a deprecated slider tooltip call.

Download `pdf-selection-translator-0.1.2.zip`, extract its plugin folder into your vault's plugin directory, and enable PDF Selection Translator. Obsidian desktop 1.13.7+ and a PDF with selectable text are required. The interface is in Simplified Chinese; the target language and OpenAI-compatible model are configurable.

The plugin is free and MIT licensed. Hosted model services may require an API account and paid usage. API keys are session-only by default; optional persistence stores them in plain text. See the README for network and privacy details.

Validation: TypeScript, 24 automated tests, production build, and release-asset verification. The tests use local mock services and do not certify real-provider translation quality.

## 中文

根据 Obsidian 社区审核反馈，修复构建文件查找路径、独立窗口定时器和模型响应类型检查，并移除已弃用的滑块提示调用。下载 ZIP 后按 README 安装；升级时保留原有 data.json 配置文件。
