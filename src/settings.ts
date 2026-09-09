import { Notice } from 'obsidian';
import { PickerSetting as Setting, closePickerWithin } from './picker';
import type PdfSelectionTranslatorPlugin from './main';
import type { TriggerMode } from './core';
import { TARGET_LANGUAGES } from './models';

export class SettingsForm {
  private test: AbortController | null = null;
  private discovery: AbortController | null = null;
  private models: string[] = [];
  private modelContainer!: HTMLElement;
  private customLanguage = false;
  private disposed = false;
  constructor(private container: HTMLElement, private plugin: PdfSelectionTranslatorPlugin) {
    plugin.forms.add(this);
    this.refresh();
  }
  private t(zh: string, en: string): string { return this.plugin.settings.uiLanguage === 'en' ? en : zh; }

  connectionChanged(): void {
    this.discovery?.abort();
    this.models = [];
    this.renderModels();
  }

  refresh(): void {
    this.test?.abort(); this.discovery?.abort();
    const { container, plugin } = this;
    const s = plugin.settings;
    const t = (zh: string, en: string) => this.t(zh, en);
    closePickerWithin(container);
    container.empty();
    container.classList.add('pst-settings-container');
    new Setting(container).setName('界面语言 / Interface language')
      .addPicker(d => d.addOptions({ 'zh-CN': '简体中文', en: 'English' }).setValue(s.uiLanguage).onChange(async value => {
        s.uiLanguage = value === 'en' ? 'en' : 'zh-CN';
        plugin.refreshSettingsForms();
        await plugin.saveSettings();
      }));
    container.createEl('p', { cls: 'pst-settings-intro', text: t(
      '双击单词或拖选句子，在选区附近查看译文。翻译会把选中文字和启用的附近上下文发送到你填写的接口。',
      'Double-click a word or select a passage to translate it nearby. Translation sends selected text and enabled nearby context to your configured endpoint.') });
    new Setting(container).setName(t('模型连接', 'Model connection')).setHeading();
    new Setting(container).setName(t('接口地址', 'Endpoint')).setDesc(t('填写 Base URL 或完整 /chat/completions 地址。', 'Enter a Base URL or full /chat/completions endpoint.'))
      .addText(text => text.setPlaceholder('https://api.example.com/v1').setValue(s.baseUrl).onChange(async value => {
        s.baseUrl = value.trim(); plugin.connectionChanged(); await plugin.saveSettings();
      }));
    new Setting(container).setName('API Key').setDesc(t('本地无认证服务可留空。默认仅在本次会话中使用。', 'Leave empty for local services without authentication. Session-only by default.'))
      .addText(text => {
        text.inputEl.type = 'password'; text.inputEl.autocomplete = 'off'; text.inputEl.spellcheck = false;
        text.setPlaceholder(t('填写 API Key', 'Enter API key')).setValue(s.apiKey).onChange(async value => {
          s.apiKey = value.trim(); plugin.connectionChanged(); await plugin.saveSettings();
        });
      });
    new Setting(container).setName(t('重启后记住 API Key', 'Remember API key')).setDesc(t(
      '开启后以明文保存在 data.json，可能随配置同步。关闭会移除磁盘中的 Key，本次会话仍可使用。',
      'Stores the key in plain text in data.json, which may sync with your configuration. Turning this off removes the saved key but keeps it for this session.'))
      .addToggle(toggle => toggle.setValue(s.rememberKey).onChange(async value => { s.rememberKey = value; await plugin.saveSettings(); }));
    this.modelContainer = container.createDiv();
    this.renderModels();
    const languageContainer = container.createDiv();
    const renderLanguage = () => {
      closePickerWithin(languageContainer);
      languageContainer.empty();
      const known = TARGET_LANGUAGES.some(([value]) => value === s.targetLanguage);
      new Setting(languageContainer).setName(t('目标语言', 'Target language')).setDesc(t('与界面语言独立，可选择常用语言或自定义。', 'Independent of the interface language. Choose a preset or enter your own.'))
        .addPicker(d => {
          for (const [value, zh, en] of TARGET_LANGUAGES) d.addOption(value, t(zh, en));
          d.addOption('__custom__', t('自定义…', 'Custom…')).setValue(this.customLanguage || !known ? '__custom__' : s.targetLanguage);
          d.onChange(async value => {
            this.customLanguage = value === '__custom__';
            if (!this.customLanguage) { s.targetLanguage = value; await plugin.saveSettings(); }
            renderLanguage();
          });
        });
      if (this.customLanguage || !known) new Setting(languageContainer).setName(t('自定义目标语言', 'Custom target language'))
        .addText(text => text.setValue(s.targetLanguage).onChange(async value => { s.targetLanguage = value; await plugin.saveSettings(); }));
    };
    renderLanguage();
    new Setting(container).setName(t('阅读交互', 'Reading')).setHeading();
    new Setting(container).setName(t('触发方式', 'Translation trigger')).setDesc(t('自动、点击按钮或仅通过命令触发。', 'Translate automatically, on click, or only through a command.'))
      .addPicker(d => d.addOptions({ auto: t('选中后自动翻译', 'Automatic'), button: t('点击翻译按钮', 'Click to translate'), command: t('仅命令 / 快捷键', 'Command / hotkey only') })
        .setValue(s.triggerMode).onChange(async value => { s.triggerMode = value as TriggerMode; await plugin.saveSettings(); }));
    new Setting(container).setName(t('选词等待时间', 'Selection delay')).setDesc(t('单位：毫秒。减少连续调整选区产生的调用。', 'Milliseconds. Reduces calls while adjusting a selection.'))
      .addSlider(slider => slider.setLimits(150, 2000, 50).setValue(s.delayMs).onChange(async value => { s.delayMs = value; await plugin.saveSettings(); }));
    new Setting(container).setName(t('结合附近文字翻译', 'Include nearby context')).setDesc(t('附带前后各最多 350 字符，辅助术语消歧。', 'Includes up to 350 characters on each side to clarify terminology.'))
      .addToggle(toggle => toggle.setValue(s.includeContext).onChange(async value => { s.includeContext = value; await plugin.saveSettings(); }));
    this.numberSetting(t('单次选区上限', 'Selection character limit'), t('超过上限时会提示缩小选区。', 'Oversized selections are rejected rather than truncated.'), 'maxChars', 100, 20000);
    this.numberSetting(t('请求超时（秒）', 'Request timeout (seconds)'), t('超过时间后停止等待。', 'Stop waiting after this duration.'), 'timeoutSeconds', 5, 180);
    new Setting(container).setName(t('测试与缓存', 'Test and cache')).setHeading();
    new Setting(container).setName(t('测试连接', 'Test connection')).setDesc(t('发送一条固定例句验证所选模型，可能产生服务商费用。', 'Sends a fixed sentence to test the selected model. Provider charges may apply.'))
      .addButton(button => button.setButtonText(t('测试翻译', 'Test translation')).setCta().onClick(async () => {
        this.test?.abort(); const controller = new AbortController(); this.test = controller;
        button.setDisabled(true).setButtonText(t('测试中…', 'Testing…'));
        output.textContent = t('正在请求服务商…', 'Contacting provider…');
        try {
          const result = await plugin.testConnection(controller);
          if (!this.disposed && !controller.signal.aborted) output.textContent = t('连接成功\n', 'Connection successful\n') + result;
        } catch (error) {
          if (!this.disposed) output.textContent = controller.signal.aborted ? t('测试已取消。', 'Test cancelled.') : this.errorText(error);
        } finally {
          button.setDisabled(false).setButtonText(t('测试翻译', 'Test translation'));
          if (this.test === controller) this.test = null;
        }
      }));
    const output = container.createDiv({ cls: 'pst-test-result', attr: { 'aria-live': 'polite' } });
    new Setting(container).setName(t('清除翻译缓存', 'Clear translation cache')).setDesc(t('最近 100 条成功译文仅保存在内存。', 'The last 100 successful translations are kept only in memory.'))
      .addButton(button => button.setButtonText(t('清除缓存', 'Clear cache')).onClick(() => { plugin.translator.clearCache(); new Notice(t('翻译缓存已清除', 'Translation cache cleared')); }));
    container.createEl('p', { cls: 'pst-settings-intro', text: t('支持桌面端、有文字层的 PDF 和 Chat Completions 兼容接口。可在 Obsidian 快捷键设置中绑定翻译命令。', 'Supports desktop PDFs with selectable text and Chat Completions compatible services. Assign the translation command in Obsidian hotkey settings.') });
  }

  private renderModels(): void {
    const s = this.plugin.settings;
    const t = (zh: string, en: string) => this.t(zh, en);
    closePickerWithin(this.modelContainer);
    this.modelContainer.empty();
    let manual: { setValue(value: string): unknown };
    new Setting(this.modelContainer).setName(t('模型名称', 'Model name')).setDesc(t('获取列表后可直接选择；也可手动填写模型 ID。', 'Fetch the list to select a model, or enter a model ID manually.'))
      .addText(text => { manual = text; text.setPlaceholder(t('模型 ID', 'Model ID')).setValue(s.model).onChange(async value => {
        s.model = value.trim(); selected?.setValue(this.models.includes(s.model) ? s.model : ''); await this.plugin.saveSettings();
      }); })
      .addButton(button => button.setButtonText(t('获取模型', 'Fetch models')).onClick(async () => {
        this.discovery?.abort(); const controller = new AbortController(); this.discovery = controller;
        button.setDisabled(true).setButtonText(t('获取中…', 'Fetching…'));
        status.textContent = t('正在获取模型列表…', 'Fetching model list…');
        try {
          const models = await this.plugin.loadModels(controller);
          if (this.disposed || controller.signal.aborted || this.discovery !== controller) return;
          this.models = models; this.renderModels();
        } catch (error) {
          if (!this.disposed && this.discovery === controller) status.textContent = controller.signal.aborted
            ? t('获取已取消，请重试。', 'Fetch cancelled. Please retry.') : this.errorText(error);
        } finally {
          button.setDisabled(false).setButtonText(t('获取模型', 'Fetch models'));
          if (this.discovery === controller) this.discovery = null;
        }
      }));
    let selected: { setValue(value: string): unknown } | undefined;
    if (this.models.length) new Setting(this.modelContainer).setName(t('选择模型', 'Select model'))
      .addPicker(d => {
        selected = d; d.addOption('', t('请选择模型…', 'Choose a model…'));
        for (const id of this.models) d.addOption(id, id);
        d.setValue(this.models.includes(s.model) ? s.model : '').onChange(async value => {
          if (!value) return;
          s.model = value; manual.setValue(value); await this.plugin.saveSettings();
        });
      });
    const status = this.modelContainer.createDiv({ cls: 'pst-test-result', attr: { 'aria-live': 'polite' } });
    status.textContent = this.models.length ? t(`已获取 ${this.models.length} 个模型。`, `Fetched ${this.models.length} models.`) : '';
    this.modelContainer.createEl('p', { cls: 'pst-settings-intro', text: t('列表来自当前接口和 Key。是否支持翻译请用“测试翻译”确认；不支持获取列表时可手动填写。', 'Models are listed by your endpoint and key. Use Test translation to confirm chat support; manual entry remains available if listing is unsupported.') });
  }

  private errorText(error: unknown): string {
    const message = error instanceof Error ? error.message : '';
    if (this.plugin.settings.uiLanguage !== 'en' || !/[\u3400-\u9fff]/.test(message)) return message || this.t('请求失败。', 'Request failed.');
    const status = message.match(/HTTP \d+/)?.[0];
    return `${status ? status + ': ' : ''}Request failed. Check the endpoint, API key, model, network and timeout settings.`;
  }

  private numberSetting(name: string, description: string, key: 'maxChars' | 'timeoutSeconds', min: number, max: number): void {
    new Setting(this.container).setName(name).setDesc(description).addText(text => {
      text.inputEl.type = 'number'; text.inputEl.min = String(min); text.inputEl.max = String(max);
      text.setValue(String(this.plugin.settings[key]));
      text.inputEl.addEventListener('change', () => {
        const value = Number(text.getValue());
        if (!Number.isFinite(value) || value < min || value > max) {
          new Notice(this.t(`请输入 ${min}–${max} 之间的数字`, `Enter a number from ${min} to ${max}.`));
          text.setValue(String(this.plugin.settings[key])); return;
        }
        this.plugin.settings[key] = Math.round(value); void this.plugin.saveSettings();
      });
    });
  }
  destroy(): void {
    closePickerWithin(this.container);
    this.disposed = true; this.test?.abort(); this.discovery?.abort(); this.models = [];
    this.plugin.forms.delete(this);
  }
}
