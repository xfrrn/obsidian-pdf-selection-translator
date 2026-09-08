# PDF Selection Translator

Translate selected words and passages while reading PDFs in Obsidian. Bring your own OpenAI-compatible Chat Completions endpoint and model. Works with Obsidian's built-in PDF viewer and alongside [PDF++](https://github.com/RyotaUshio/obsidian-pdf-plus).

[中文说明](README.zh-CN.md) · [Download](https://github.com/xfrrn/obsidian-pdf-selection-translator/releases/latest) · [Report a problem](https://github.com/xfrrn/obsidian-pdf-selection-translator/issues)

## Features

- Translate a word after double-clicking, or select a passage to translate it.
- Automatic, click-to-translate and command-only modes.
- A popover near the selection with expandable source text and a copy button.
- Configurable endpoint, model, target language, selection limit, delay and timeout.
- Optional nearby context for terminology disambiguation.
- In-memory cache for the last 100 successful translations.
- Cancel superseded requests; dismiss the popover before PDF++ opens a context menu.
- No automatic changes to your PDFs or notes.

The current interface is in Simplified Chinese. The target translation language is configurable and defaults to Simplified Chinese.

## Requirements

- **Obsidian desktop 1.13.7 or later.** Mobile is not supported.
- A PDF with a selectable text layer. Scanned images require OCR in another tool first.
- Access to an OpenAI-compatible **Chat Completions** service, or a local compatible model server.

The plugin is free and MIT licensed. A hosted model provider typically requires a separate account, API key and paid usage. A local service that permits requests without authentication can be used without a key.

## Install

Until the plugin is approved for the community directory, install it manually:

1. Download `pdf-selection-translator-0.1.2.zip` from [Releases](https://github.com/xfrrn/obsidian-pdf-selection-translator/releases/latest).
2. Extract the `pdf-selection-translator` folder into `<vault>/<config-dir>/plugins/`. The default config directory is `.obsidian`.
3. The plugin folder must directly contain `main.js`, `manifest.json` and `styles.css`.
4. Restart Obsidian and enable **PDF Selection Translator** under **Settings → Community plugins**.

Alternatively, download the three individual release assets into the same plugin folder. You do not need Node.js or npm to use the plugin.

## Configure

Open the plugin settings or run **PDF Selection Translator: 打开翻译设置** in the command palette.

| Field | Value |
| --- | --- |
| 接口地址 | Your provider's Base URL or full `/chat/completions` endpoint. |
| 模型名称 | The exact model ID from your provider. |
| API Key | Your provider's API key. Leave empty only for a service that allows it. |
| 目标语言 | Target language, such as `简体中文` or `English`. |

Click **测试翻译** to send a fixed example sentence. This is a real model call and may incur provider charges.

Example URL handling:

| Entered URL | Request URL |
| --- | --- |
| `https://api.example.com` | `https://api.example.com/v1/chat/completions` |
| `https://api.example.com/v1` | `https://api.example.com/v1/chat/completions` |
| `https://api.example.com/custom/v1` | `https://api.example.com/custom/v1/chat/completions` |
| `https://api.example.com/chat/completions` | Unchanged. |
| `http://127.0.0.1:1234/v1` | `http://127.0.0.1:1234/v1/chat/completions` |

These are format examples, not model service recommendations. Keys are sent in the `Authorization: Bearer ...` header. Query parameters and credentials embedded in the URL are not supported.

## Read and translate

- **Automatic:** select text and release the mouse; the default delay is 450 ms.
- **Click:** select text, then click **翻译** in the popover.
- **Command only:** bind a hotkey to **PDF Selection Translator: 翻译 PDF 选中文字** in Obsidian's hotkey settings.
- **Copy:** click **复制译文**. The source text can be expanded separately.
- **Dismiss:** press Escape, click outside, scroll or open the PDF context menu.
- **Retry:** **重新翻译** bypasses the cache and makes another model call.

Click the status-bar label **译 · 自动 / 点击 / 快捷键** to switch between automatic and click modes.

## Privacy, network use and cost

- Translation requests go **only to the endpoint you configure**. The request includes the selected text and translation instructions. If nearby context is enabled, it also includes up to 350 characters before and after the selection and a short selected-text marker.
- The plugin does not upload complete PDF files, file paths or unrelated notes. Selecting a large passage still sends that passage, subject to the configured limit.
- It has no analytics or telemetry, no developer-operated translation backend and no automatic updater. It does not modify your PDF or write translation notes.
- Model responses are rendered as plain text. The plugin does not load images or execute HTML from model output.
- API keys are **session-only by default**. Opting into **重启后记住 API Key** stores the key in **plain text** in the plugin's `data.json`; that file may be included in your configuration sync or backups. Turning the option off removes the saved key while keeping it available for the current session.
- Translation text and cache entries are kept in memory. Restarting or unloading the plugin clears them. Changing configuration also clears the cache.
- Hosted providers apply their own data policies and billing. Automatic selection translation, retries and connection tests may be billable. Cancelling the local request cannot guarantee that a provider stops processing or charging for a request it already accepted.

## Compatibility and limitations

- Uses non-streaming `/chat/completions` requests. Native Responses API, Anthropic Messages API, custom authentication headers and extra provider-specific parameters are not supported in this version.
- The desktop HTTP client connects directly and does not automatically inherit system HTTP proxy settings. Use a directly reachable compatible endpoint if your provider requires a proxy.
- PDF text extraction can be imperfect for formulas, tables, columns and line-end hyphenation. Expand the source text to check the extracted selection.
- PDF integration uses the viewer's DOM text layer. Future Obsidian or PDF++ changes may require an update.
- No OCR, whole-document translation, mobile support or persistent translation history.

The selection popover, copying, whole-line selection and PDF++ context menu behavior have been exercised on **Windows with Obsidian 1.13.7 and PDF++ 0.40.31**, using a loopback mock service. Automated tests cover selection handling, request cancellation, stale results, errors, caching and real local HTTP transport. This is not a provider-by-provider compatibility or translation-quality certification. macOS and Linux have not been manually tested.

## Development

Use Node.js 22 or later:

```sh
npm ci
npm run check
```

The check runs TypeScript validation, the test suite, a production build and release-asset validation. Installable files are written to `dist/pdf-selection-translator/`. Tests use synthetic text and local mock servers; no paid model key is needed.

Release tags must exactly match `manifest.json`, for example `0.1.2` without a `v` prefix. Attach `main.js`, `manifest.json` and `styles.css` individually, even when also providing a ZIP. Update `package.json` and `versions.json` with the release version.

## License and attribution

[MIT](LICENSE) — Copyright 2026 xfrrn.

This is an independent plugin, not an official Obsidian or PDF++ product. PDF++ is referenced for compatibility; this repository does not bundle PDF++ source. Obsidian supplies the runtime plugin API. Build and test dependencies are listed in `package.json`; they are not bundled into the runtime plugin.
