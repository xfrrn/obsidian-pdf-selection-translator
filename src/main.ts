import { App, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { DEFAULT_SETTINGS, normalizeSettings, Translator, type Settings, type TriggerMode } from './core';
import { SelectionController } from './controller';
import { desktopTransport } from './transport';

export default class PdfSelectionTranslatorPlugin extends Plugin {
  settings: Settings = { ...DEFAULT_SETTINGS };
  translator = new Translator(desktopTransport);
  private controllers = new Map<Document, SelectionController>();
  private tests = new Set<AbortController>();
  private status: HTMLElement | null = null;
  private stopped = false;
  private saveQueue = Promise.resolve();
  private modals = new Set<TranslatorSettingsModal>();

  async onload(): Promise<void> {
    this.settings = normalizeSettings(await this.loadData());
    this.addSettingTab(new TranslatorSettingTab(this.app, this));
    this.addCommand({
      id: 'translate-pdf-selection', name: '翻译 PDF 选中文字',
      callback: () => this.getActiveController()?.translateCommand(),
    });
    this.addCommand({
      id: 'open-translator-settings', name: '打开翻译设置',
      callback: () => this.openSettings(),
    });
    this.addCommand({
      id: 'toggle-auto-translation', name: '切换自动翻译 / 点击翻译',
      callback: () => { void this.toggleMode(); },
    });
    this.status = this.addStatusBarItem();
    this.status.classList.add('pst-statusbar');
    this.status.title = 'PDF 翻译：点击切换自动 / 点击翻译';
    this.registerDomEvent(this.status, 'click', () => { void this.toggleMode(); });
    this.updateStatus();
    this.app.workspace.onLayoutReady(() => {
      if (this.stopped) return;
      this.attachDocument(document);
      this.scanWindows();
    });
    this.registerEvent(this.app.workspace.on('layout-change', () => this.scanWindows()));
    this.registerEvent(this.app.workspace.on('window-open', (_workspace, win) => this.attachDocument(win.document)));
    this.registerEvent(this.app.workspace.on('window-close', (_workspace, win) => {
      this.controllers.get(win.document)?.destroy();
      this.controllers.delete(win.document);
    }));
    this.registerEvent(this.app.workspace.on('file-open', () => this.closePopovers()));
    this.registerEvent(this.app.workspace.on('active-leaf-change', () => this.closePopovers()));
  }

  private scanWindows(): void {
    if (this.stopped) return;
    this.app.workspace.iterateAllLeaves((leaf) => this.attachDocument(leaf.view.containerEl.ownerDocument));
  }

  private attachDocument(doc: Document): void {
    if (this.stopped || this.controllers.has(doc) || !doc.defaultView) return;
    this.controllers.set(doc, new SelectionController(
      doc, () => this.settings, this.translator,
      () => this.openSettings(), (message) => new Notice(message),
    ));
  }

  private getActiveController(): SelectionController | undefined {
    const doc = typeof activeDocument !== 'undefined' ? activeDocument : document;
    this.attachDocument(doc);
    return this.controllers.get(doc);
  }

  private closePopovers(): void {
    this.controllers.forEach((controller) => controller.close());
  }

  openSettings(): void {
    const modal = new TranslatorSettingsModal(this.app, this, () => this.modals.delete(modal));
    this.modals.add(modal);
    modal.open();
  }

  async saveSettings(): Promise<void> {
    this.closePopovers();
    this.tests.forEach((controller) => controller.abort());
    this.translator.clearCache();
    this.updateStatus();
    const data = { ...this.settings, apiKey: this.settings.rememberKey ? this.settings.apiKey : '' };
    // Serialize saves so slower disk writes cannot restore an older credential/config.
    this.saveQueue = this.saveQueue.catch(() => {}).then(() => this.saveData(data));
    try { await this.saveQueue; } catch { new Notice('翻译设置未能保存，请检查知识库是否可写。'); }
  }

  private updateStatus(): void {
    if (this.status) this.status.textContent = `译 · ${this.settings.triggerMode === 'auto' ? '自动' : this.settings.triggerMode === 'button' ? '点击' : '快捷键'}`;
  }

  private async toggleMode(): Promise<void> {
    this.settings.triggerMode = this.settings.triggerMode === 'auto' ? 'button' : 'auto';
    await this.saveSettings();
    new Notice(this.settings.triggerMode === 'auto' ? 'PDF：选中文字后自动翻译' : 'PDF：选中文字后点击翻译');
  }

  async testConnection(signal: AbortController): Promise<string> {
    this.tests.add(signal);
    try {
      const result = await this.translator.translate({ ...this.settings, includeContext: false }, {
        text: 'The model learns useful representations from data.', context: '',
      }, signal.signal, true);
      return result.text;
    } finally { this.tests.delete(signal); }
  }

  onunload(): void {
    this.stopped = true;
    this.modals.forEach((modal) => modal.close());
    this.modals.clear();
    this.controllers.forEach((controller) => controller.destroy());
    this.controllers.clear();
    this.tests.forEach((controller) => controller.abort());
    this.tests.clear();
    this.translator.clearCache();
    this.settings.apiKey = '';
  }
}

/** The settings screen owns its connection test and cancels it when dismissed. */
class SettingsForm {
  private test: AbortController | null = null;
  constructor(private container: HTMLElement, private plugin: PdfSelectionTranslatorPlugin) { this.render(); }

  private render(): void {
    const { container, plugin } = this;
    const settings = plugin.settings;
    container.empty();
    container.classList.add('pst-settings-container');
    container.createEl('p', {
      cls: 'pst-settings-intro',
      text: '双击单词或拖选句子，在原位置阅读译文。支持 Obsidian PDF 阅读器和 PDF++。翻译时会把所选文字发送到你填写的接口；开启上下文后会附带附近文字。',
    });
    new Setting(container).setName('模型连接').setHeading();
    new Setting(container).setName('接口地址').setDesc('填写 Base URL 或完整 /chat/completions 地址。带路径的地址会保留原路径。')
      .addText((text) => text.setPlaceholder('https://你的服务商/v1').setValue(settings.baseUrl).onChange(async (value) => {
        settings.baseUrl = value.trim(); await plugin.saveSettings();
      }));
    new Setting(container).setName('模型名称').setDesc('填写服务商提供的完整模型 ID。')
      .addText((text) => text.setPlaceholder('模型 ID').setValue(settings.model).onChange(async (value) => {
        settings.model = value.trim(); await plugin.saveSettings();
      }));
    new Setting(container).setName('API Key').setDesc('本地无认证服务可留空。默认只在本次 Obsidian 会话中使用。')
      .addText((text) => {
        text.inputEl.type = 'password';
        text.inputEl.autocomplete = 'off';
        text.inputEl.spellcheck = false;
        text.setPlaceholder('在这里填写 Key').setValue(settings.apiKey).onChange(async (value) => {
          settings.apiKey = value.trim(); await plugin.saveSettings();
        });
      });
    new Setting(container).setName('重启后记住 API Key').setDesc('开启后以明文保存在本插件 data.json，可能随知识库配置一起同步。关闭会移除已保存的 Key，本次会话仍可使用。')
      .addToggle((toggle) => toggle.setValue(settings.rememberKey).onChange(async (value) => {
        settings.rememberKey = value; await plugin.saveSettings();
      }));
    new Setting(container).setName('目标语言').addText((text) => text.setValue(settings.targetLanguage).onChange(async (value) => {
      settings.targetLanguage = value; await plugin.saveSettings();
    }));
    new Setting(container).setName('阅读交互').setHeading();
    new Setting(container).setName('触发方式').setDesc('自动：松开鼠标后翻译；点击：先显示按钮；快捷键：只通过命令触发。')
      .addDropdown((dropdown) => dropdown.addOptions({ auto: '选中后自动翻译', button: '点击浮窗中的翻译按钮', command: '仅命令 / 快捷键' })
        .setValue(settings.triggerMode).onChange(async (value) => {
          settings.triggerMode = value as TriggerMode; await plugin.saveSettings();
        }));
    new Setting(container).setName('选词等待时间').setDesc('稍等片刻再发送，减少连续调整选区产生的调用。单位：毫秒。')
      .addSlider((slider) => slider.setLimits(150, 1500, 50).setValue(settings.delayMs).onChange(async (value) => {
        settings.delayMs = value; await plugin.saveSettings();
      }));
    new Setting(container).setName('结合附近文字翻译').setDesc('附带选区前后各最多 350 字符帮助术语消歧；不会上传整篇 PDF。')
      .addToggle((toggle) => toggle.setValue(settings.includeContext).onChange(async (value) => {
        settings.includeContext = value; await plugin.saveSettings();
      }));
    this.numberSetting('单次选区上限', '超过上限时会提示缩小选区，不会截断后偷偷发送。', 'maxChars', 100, 20000);
    this.numberSetting('请求超时（秒）', '超时、新选区、关闭浮窗或禁用插件时停止连接。', 'timeoutSeconds', 5, 180);
    new Setting(container).setName('测试与缓存').setHeading();
    new Setting(container).setName('测试连接').setDesc('发送一条固定英文例句，验证真实接口和模型；会产生一次模型调用。')
      .addButton((button) => button.setButtonText('测试翻译').setCta().onClick(async () => {
        this.test?.abort();
        const controller = new AbortController();
        this.test = controller;
        button.setDisabled(true).setButtonText('测试中…');
        output.textContent = '正在请求服务商…';
        try {
          const result = await plugin.testConnection(controller);
          if (!controller.signal.aborted) output.textContent = `连接成功\n${result}`;
        } catch (error) {
          output.textContent = controller.signal.aborted ? '测试已取消。' : error instanceof Error ? error.message : '测试失败。';
        } finally {
          button.setDisabled(false).setButtonText('测试翻译');
          if (this.test === controller) this.test = null;
        }
      }));
    const output = container.createDiv({ cls: 'pst-test-result', attr: { 'aria-live': 'polite' } });
    new Setting(container).setName('清除翻译缓存').setDesc('最近 100 条成功翻译仅保存在内存，重启即清空。')
      .addButton((button) => button.setButtonText('清除缓存').onClick(() => {
        plugin.translator.clearCache(); new Notice('翻译缓存已清除');
      }));
    container.createEl('p', {
      cls: 'pst-settings-intro',
      text: '可在 Obsidian 设置 → 快捷键中为“PDF Selection Translator: 翻译 PDF 选中文字”绑定按键。当前版本支持桌面端、有文字层的 PDF 和 Chat Completions 兼容接口。',
    });
  }

  private numberSetting(name: string, description: string, key: 'maxChars' | 'timeoutSeconds', min: number, max: number): void {
    new Setting(this.container).setName(name).setDesc(description).addText((text) => {
      text.inputEl.type = 'number';
      text.inputEl.min = String(min);
      text.inputEl.max = String(max);
      text.setValue(String(this.plugin.settings[key]));
      text.inputEl.addEventListener('change', () => {
        const value = Number(text.getValue());
        if (!Number.isFinite(value) || value < min || value > max) {
          new Notice(`请输入 ${min}–${max} 之间的数字`);
          text.setValue(String(this.plugin.settings[key]));
          return;
        }
        this.plugin.settings[key] = Math.round(value);
        void this.plugin.saveSettings();
      });
    });
  }

  destroy(): void { this.test?.abort(); this.test = null; }
}

class TranslatorSettingTab extends PluginSettingTab {
  private form?: SettingsForm;
  constructor(app: App, private plugin: PdfSelectionTranslatorPlugin) { super(app, plugin); }
  display(): void { this.form?.destroy(); this.form = new SettingsForm(this.containerEl, this.plugin); }
  hide(): void { this.form?.destroy(); }
}

class TranslatorSettingsModal extends Modal {
  private form?: SettingsForm;
  constructor(app: App, private plugin: PdfSelectionTranslatorPlugin, private didClose: () => void) { super(app); }
  onOpen(): void { this.setTitle('PDF 选词翻译'); this.form = new SettingsForm(this.contentEl, this.plugin); }
  onClose(): void { this.form?.destroy(); this.contentEl.empty(); this.didClose(); }
}
