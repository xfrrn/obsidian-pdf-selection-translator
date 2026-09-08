# PDF Selection Translator 0.1.1

First public release: translate selected PDF words and passages in a popover while reading in Obsidian and PDF++.

- Bring your own OpenAI-compatible Chat Completions endpoint, model and API key.
- Automatic, click-to-translate and command-only modes.
- Optional nearby context, copy translation, in-memory cache and cancellation of superseded requests.
- Keep PDF++ context menus usable by dismissing the translation popover before they open.

Requires Obsidian desktop 1.13.7 or later and a selectable PDF text layer. The interface is in Simplified Chinese; the target translation language is configurable. Hosted model usage may require a paid provider account. API keys are session-only unless plaintext persistence is explicitly enabled.

For manual installation, extract `pdf-selection-translator-0.1.1.zip` into your vault's configuration `plugins` directory and enable **PDF Selection Translator**. The three individual assets are also attached for Obsidian-compatible installers.

Validation: 24 automated tests, TypeScript checking and release-asset validation. Core PDF++ UI behavior was tested on Windows with a loopback mock endpoint. Actual provider connectivity and translation quality depend on your chosen service.

---

首个公开版本：在 Obsidian / PDF++ 里选词后查看翻译浮窗。支持自定义大模型接口、自动 / 点击 / 快捷键翻译、上下文辅助、复制与缓存。

需要桌面版 Obsidian 1.13.7+，PDF 必须有文字层。外部模型可能按量收费。安装、隐私和配置详情请查看仓库 README。
