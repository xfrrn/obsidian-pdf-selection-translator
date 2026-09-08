# PDF 选词翻译

在 Obsidian 中阅读论文时，双击单词或选中一段文字，在选区附近查看大模型译文。与原生 PDF 阅读器及 PDF++ 一起使用。

[English](README.md) · [下载安装包](https://github.com/xfrrn/obsidian-pdf-selection-translator/releases/latest) · [反馈问题](https://github.com/xfrrn/obsidian-pdf-selection-translator/issues)

## 安装与配置

社区插件目录上架前，可手动安装：

1. 从 Releases 下载 `pdf-selection-translator-0.1.1.zip`。
2. 解压到知识库的 `.obsidian/plugins/`，得到 `pdf-selection-translator` 文件夹。若修改过 Obsidian 配置目录名称，请使用实际配置目录。
3. 确认该文件夹内直接包含 `main.js`、`manifest.json`、`styles.css`。
4. 重启 Obsidian，在第三方插件中启用 **PDF Selection Translator**。
5. 打开插件设置，填写接口地址、模型名称、API Key，点击 **测试翻译**。

要求：Obsidian **桌面版 1.13.7 或更新版本**，PDF 需要可选中的文字层。扫描图片需要先用其他工具 OCR。

支持 OpenAI 兼容的 **Chat Completions** 接口。可填 Base URL，例如 `https://api.example.com/v1`，或完整的 `/chat/completions` 地址。模型名称填写服务商的完整模型 ID。上述网址只是格式示例。

## 使用

- **自动翻译**：双击单词或选中段落，松开鼠标后默认等待 450 毫秒再调用。
- **点击翻译**：先显示浮窗，点击“翻译”才发送请求。
- **仅命令 / 快捷键**：为 `PDF Selection Translator: 翻译 PDF 选中文字` 绑定按键。
- **复制与关闭**：点击“复制译文”；Esc、点击外部、滚动或右键会收起浮窗。
- **上下文**：可附带前后各最多 350 字符辅助术语消歧。
- **缓存**：最近 100 条成功译文仅保存在内存；“重新翻译”会跳过缓存并再次调用。

插件界面为简体中文，目标语言可自行填写。PDF++ 的原有右键菜单仍可使用。

## 数据、Key 与费用

插件免费，使用 MIT 开源协议。外部模型服务通常需要单独注册账号、申请 API Key 并按量付费。本地允许无认证的兼容服务可以不填 Key。

翻译请求只发送到你配置的接口，内容包括选中文字、翻译指令和开启的附近上下文。不会上传整个 PDF 文件、文件路径或无关笔记；没有遥测和开发者中转服务，也不会自动修改 PDF 或写入笔记。

API Key 默认只用于本次会话。开启“重启后记住 API Key”会把 Key **明文保存到插件 data.json**，可能随配置同步或备份。关闭后会移除磁盘中的 Key，本次会话仍可使用。

服务商的数据处理和计费政策由服务商决定。自动翻译、测试连接和重试都可能收费；取消本机连接不保证服务商停止已受理请求的计费。

## 已知限制

- 只支持桌面端、可选文字的 PDF，不提供 OCR 或整篇 PDF 翻译。
- 使用非流式 `/chat/completions`，暂不支持原生 `/responses`、`/messages`、额外认证头或服务商专用参数。
- 请求直接连接接口，不自动继承系统 HTTP 代理。
- 双栏、公式、表格、行尾断字可能影响文字提取，请展开原文核对。
- Windows + Obsidian 1.13.7 + PDF++ 0.40.31 已进行本地模拟接口交互验证；真实模型的翻译质量需自行试译。macOS 和 Linux 尚未手动验证。

源码构建和发布约定见 [English README](README.md#development)。

## 许可

[MIT](LICENSE)，作者 xfrrn。本插件独立开发，与 Obsidian、PDF++ 官方没有隶属关系。
