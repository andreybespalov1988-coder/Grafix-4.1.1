'use strict';

const DEFAULT_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'openrouter/free';
const DEFAULT_TIMEOUT_MS = 30000;
const MAX_MESSAGE_CHARS = 120000;
const MAX_MESSAGES = 40;
function clampTimeout(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_TIMEOUT_MS;
  return Math.min(120000, Math.max(1000, Math.trunc(parsed)));
}
function errorResult(code, message, extra = {}) { return { ok: false, code, message, ...extra }; }

class AIService {
  constructor(options = {}) {
    this.endpoint = options.endpoint || DEFAULT_ENDPOINT;
    this.model = DEFAULT_MODEL;
    this.timeoutMs = clampTimeout(options.timeoutMs ?? process.env.OPENROUTER_TIMEOUT_MS);
    this.apiKey = String(options.apiKey ?? process.env.OPENROUTER_API_KEY ?? '').trim();
    this.initializedAt = new Date().toISOString();
  }
  initialize() { return this.status(); }
  status() {
    if (!this.apiKey) return { state: 'no-api-key', configured: false, model: this.model, initializedAt: this.initializedAt };
    return { state: 'ready', configured: true, model: this.model, initializedAt: this.initializedAt };
  }
  normalizeMessages(messages) {
    if (!Array.isArray(messages) || !messages.length) return errorResult('AI_INVALID_REQUEST', 'Введите запрос для AI.');
    const normalized = messages.map(message => ({role:['system','user','assistant'].includes(message?.role) ? message.role : 'user', content:String(message?.content ?? '').trim()})).filter(message => message.content);
    if (!normalized.length) return errorResult('AI_INVALID_REQUEST', 'Введите непустой запрос.');
    if (normalized.length > MAX_MESSAGES) return errorResult('AI_REQUEST_TOO_LARGE', `Диалог превышает лимит ${MAX_MESSAGES} сообщений.`);
    if (normalized.some(message => message.content.length > MAX_MESSAGE_CHARS)) return errorResult('AI_REQUEST_TOO_LARGE', `Сообщение превышает допустимый размер ${MAX_MESSAGE_CHARS} символов.`);
    return { ok: true, messages: normalized };
  }
  async ask(messages, options = {}) {
    const normalized = this.normalizeMessages(messages);
    if (!normalized.ok) return normalized;
    if (!this.apiKey) return errorResult('AI_NO_API_KEY', 'OPENROUTER_API_KEY не настроен. Добавьте переменную окружения Windows и перезапустите Grafix.');
    const timeoutMs = clampTimeout(options.timeoutMs ?? this.timeoutMs);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://grafix.local',
          'X-Title': 'Grafix 4.1'
        },
        body: JSON.stringify({ model: this.model, messages: normalized.messages, temperature: 0.2, stream: false }),
        signal: controller.signal
      });
      let payload = null;
      try { payload = await response.json(); } catch (_) { payload = null; }
      if (!response.ok) {
        const providerMessage = String(payload?.error?.message || payload?.message || '').trim();
        if (response.status === 401) return errorResult('AI_UNAUTHORIZED', providerMessage || 'OpenRouter отклонил API key.', { status: 401 });
        if (response.status === 429) return errorResult('AI_RATE_LIMITED', providerMessage || 'OpenRouter ограничил частоту запросов.', { status: 429 });
        if (response.status >= 400 && response.status < 500) return errorResult('AI_PROVIDER_4XX', providerMessage || `OpenRouter вернул HTTP ${response.status}.`, { status: response.status });
        if (response.status >= 500) return errorResult('AI_PROVIDER_5XX', providerMessage || `OpenRouter вернул HTTP ${response.status}.`, { status: response.status });
        return errorResult('AI_PROVIDER_ERROR', providerMessage || `OpenRouter вернул HTTP ${response.status}.`, { status: response.status });
      }
      const content = payload?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || !content.trim()) return errorResult('AI_EMPTY_RESPONSE', 'OpenRouter вернул ответ без текста модели.');
      return { ok: true, model: this.model, content: content.trim(), usage: payload?.usage || null, requestId: response.headers.get('x-request-id') || null };
    } catch (error) {
      if (error?.name === 'AbortError') return errorResult('AI_TIMEOUT', `OpenRouter не ответил за ${timeoutMs / 1000} сек.`);
      return errorResult('AI_NETWORK_ERROR', `Не удалось подключиться к OpenRouter: ${error?.message || 'ошибка сети'}`);
    } finally { clearTimeout(timer); }
  }
}

if (typeof module !== 'undefined' && module.exports) module.exports = AIService;
