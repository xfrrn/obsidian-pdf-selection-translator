import { abortError, completionUrl, type Settings, type Transport } from './core';

export function modelsUrl(baseUrl: string): string {
  const url = new URL(completionUrl(baseUrl));
  url.pathname = url.pathname.replace(/\/chat\/completions$/, '/models');
  return url.toString();
}

export async function fetchModels(settings: Settings, transport: Transport, signal: AbortSignal): Promise<string[]> {
  const t = (zh: string, en: string) => settings.uiLanguage === 'en' ? en : zh;
  if (signal.aborted) throw abortError();
  const response = await transport({
    url: modelsUrl(settings.baseUrl), method: 'GET', body: '',
    headers: { Accept: 'application/json', ...(settings.apiKey.trim() ? { Authorization: `Bearer ${settings.apiKey.trim()}` } : {}) },
    timeoutMs: settings.timeoutSeconds * 1000,
  }, signal);
  if (signal.aborted) throw abortError();
  if (response.status < 200 || response.status >= 300) {
    const reason = response.status === 401 || response.status === 403
      ? t('请检查 API Key 和账号权限。', 'Check your API key and account permissions.')
      : response.status === 404 || response.status === 405
        ? t('服务商未提供模型列表，请手动填写模型 ID。', 'This service does not provide a model list. Enter a model ID manually.')
        : t('获取失败，请稍后重试或手动填写模型 ID。', 'Could not fetch models. Retry later or enter a model ID manually.');
    throw new Error(`HTTP ${response.status}: ${reason}`);
  }
  let data: unknown;
  try { data = JSON.parse(response.text); } catch { throw new Error(t('模型列表不是有效 JSON，请检查接口地址。', 'The model list is not valid JSON. Check the endpoint.')); }
  const entries: unknown = data && typeof data === 'object' && 'data' in data ? data.data : undefined;
  if (!Array.isArray(entries)) throw new Error(t('不支持此模型列表格式，请手动填写模型 ID。', 'Unsupported model list format. Enter a model ID manually.'));
  const ids = new Set<string>();
  for (const entry of entries as unknown[]) {
    if (entry && typeof entry === 'object' && 'id' in entry && typeof entry.id === 'string' && entry.id.trim()) ids.add(entry.id.trim());
  }
  if (!ids.size) throw new Error(t('没有返回可选择的模型，请检查权限或手动填写。', 'No models were returned. Check permissions or enter a model ID manually.'));
  return [...ids].sort((a, b) => a.localeCompare(b));
}

/** Stable prompt values are independent of the settings interface language. */
export const TARGET_LANGUAGES = [
  ['简体中文', '简体中文', 'Chinese (Simplified)'], ['繁體中文', '繁体中文', 'Chinese (Traditional)'],
  ['English', '英语', 'English'], ['Japanese', '日语', 'Japanese'], ['Korean', '韩语', 'Korean'],
  ['French', '法语', 'French'], ['German', '德语', 'German'], ['Spanish', '西班牙语', 'Spanish'],
  ['Portuguese', '葡萄牙语', 'Portuguese'], ['Italian', '意大利语', 'Italian'], ['Russian', '俄语', 'Russian'],
  ['Arabic', '阿拉伯语', 'Arabic'], ['Hindi', '印地语', 'Hindi'], ['Thai', '泰语', 'Thai'],
  ['Vietnamese', '越南语', 'Vietnamese'], ['Indonesian', '印度尼西亚语', 'Indonesian'],
] as const;
