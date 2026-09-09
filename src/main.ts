import { App, Modal, Notice, Plugin, PluginSettingTab } from 'obsidian';
import { DEFAULT_SETTINGS, normalizeSettings, Translator, type Settings } from './core';
import { SelectionController } from './controller';
import { desktopTransport } from './transport';
import { SettingsForm } from './settings';
import { fetchModels } from './models';

export default class PdfSelectionTranslatorPlugin extends Plugin {
  settings: Settings = { ...DEFAULT_SETTINGS };
  translator = new Translator(desktopTransport);
  private controllers = new Map<Document, SelectionController>();
  private tests = new Set<AbortController>();
  private status: HTMLElement | null = null;
  private stopped = false;
  private saveQueue = Promise.resolve();
  forms = new Set<SettingsForm>();
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
    try { await this.saveQueue; } catch { new Notice(this.settings.uiLanguage === 'en' ? 'Could not save settings. Check vault write permissions.' : '翻译设置未能保存，请检查知识库是否可写。'); }
  }

  private updateStatus(): void {
    if (this.status) this.status.textContent = `译 · ${this.settings.triggerMode === 'auto' ? '自动' : this.settings.triggerMode === 'button' ? '点击' : '快捷键'}`;
  }

  private async toggleMode(): Promise<void> {
    this.settings.triggerMode = this.settings.triggerMode === 'auto' ? 'button' : 'auto';
    await this.saveSettings();
    new Notice(this.settings.triggerMode === 'auto' ? 'PDF：选中文字后自动翻译' : 'PDF：选中文字后点击翻译');
  }

  refreshSettingsForms(): void {
    this.forms.forEach(form => form.refresh());
    this.modals.forEach(modal => modal.updateTitle());
  }

  connectionChanged(): void { this.forms.forEach(form => form.connectionChanged()); }

  async loadModels(controller: AbortController): Promise<string[]> {
    this.tests.add(controller);
    try { return await fetchModels({ ...this.settings }, desktopTransport, controller.signal); }
    finally { this.tests.delete(controller); }
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
    this.forms.forEach(form => form.destroy());
    this.forms.clear();
    this.controllers.forEach((controller) => controller.destroy());
    this.controllers.clear();
    this.tests.forEach((controller) => controller.abort());
    this.tests.clear();
    this.translator.clearCache();
    this.settings.apiKey = '';
  }
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
  updateTitle(): void { this.setTitle(this.plugin.settings.uiLanguage === 'en' ? 'PDF Selection Translator' : 'PDF 选词翻译'); }
  onOpen(): void { this.updateTitle(); this.form = new SettingsForm(this.contentEl, this.plugin); }
  onClose(): void { this.form?.destroy(); this.contentEl.empty(); this.didClose(); }
}
