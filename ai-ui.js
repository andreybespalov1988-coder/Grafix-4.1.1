'use strict';

(function setupGrafixAI() {
  if (!document.head) return;
  const style = document.createElement('style');
  style.textContent = `
    .ai-layout{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(300px,.65fr);gap:16px}
    .ai-card{background:rgba(255,253,249,.96);border:1px solid var(--line);border-radius:18px;padding:20px;box-shadow:var(--shadow)}
    .ai-status{display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:11px;background:var(--cream);font-weight:700}
    .ai-dot{width:9px;height:9px;border-radius:50%;background:var(--warn);flex:0 0 auto}
    .ai-status.ready .ai-dot{background:var(--ok)}
    .ai-status.error .ai-dot{background:var(--bad)}
    .ai-meta{display:grid;gap:9px;margin-top:14px}.ai-meta-row{display:flex;justify-content:space-between;gap:14px;font-size:13px}.ai-meta-row span:last-child{font-weight:700;color:var(--burg)}
    .ai-chat{display:grid;grid-template-rows:minmax(300px,1fr) auto;min-height:620px}
    .ai-messages{overflow:auto;display:grid;gap:10px;align-content:start;padding:2px}
    .ai-message{padding:12px 14px;border-radius:13px;white-space:pre-wrap;line-height:1.5;max-width:88%;border:1px solid var(--line);background:#fff}
    .ai-message.user{justify-self:end;background:var(--cream)}.ai-message.assistant{justify-self:start;background:#fffdf9}.ai-message.error{border-color:#e9b0b0;background:#fff3f3;color:var(--bad)}
    .ai-compose{display:grid;gap:9px;margin-top:14px}.ai-compose textarea{width:100%;min-height:110px;resize:vertical;border:1px solid var(--line);border-radius:12px;padding:12px;background:#fff}
    .ai-actions{display:flex;justify-content:space-between;gap:10px;align-items:center}.ai-hint{font-size:12px;color:var(--muted)}
    @media(max-width:1000px){.ai-layout{grid-template-columns:1fr}.ai-chat{min-height:520px}}
  `;
  document.head.appendChild(style);

  const nav = document.getElementById('nav');
  if (nav && !nav.querySelector('[data-view="ai"]')) {
    nav.insertAdjacentHTML('beforeend', '<button data-view="ai">🧠 AI-помощник</button>');
  }

  const main = document.querySelector('.main');
  if (main && !document.getElementById('ai')) {
    main.insertAdjacentHTML('beforeend', `
      <section id="ai" class="view">
        <div class="top"><div><div class="eyebrow">Grafix AI</div><h1>AI-помощник</h1><div class="subtitle">Безопасный доступ к OpenRouter Free для анализа расписания, формулировок и рабочих задач.</div></div><div class="actions"><button class="btn" onclick="refreshAIStatus()">Обновить статус</button><button class="btn" onclick="clearAIConversation()">Очистить диалог</button></div></div>
        <div class="ai-layout">
          <div class="ai-card ai-chat">
            <div id="aiMessages" class="ai-messages"><div class="empty">Начните диалог. AI работает через main process; API key в интерфейс не передаётся.</div></div>
            <div class="ai-compose">
              <textarea id="aiPrompt" placeholder="Например: объясни, почему в расписании возник этот конфликт, и предложи варианты исправления..."></textarea>
              <div class="ai-actions"><span id="aiHint" class="ai-hint">Ctrl+Enter — отправить</span><button id="aiSend" class="btn primary" onclick="sendAIMessage()">Отправить</button></div>
            </div>
          </div>
          <aside class="ai-card"><div class="section-head"><h2>Состояние AI</h2></div><div id="aiStatusBox" class="ai-status"><span class="ai-dot"></span><span>Проверка...</span></div><div class="ai-meta"><div class="ai-meta-row"><span>Модель</span><span id="aiModel">—</span></div><div class="ai-meta-row"><span>API key</span><span id="aiKeyState">—</span></div><div class="ai-meta-row"><span>Режим</span><span>OpenRouter Free</span></div></div><div class="notice" style="margin-top:16px">API key читается только в main process из <b>OPENROUTER_API_KEY</b>. Renderer получает только статус, текст ответа и нормализованную ошибку.</div></aside>
        </div>
      </section>
    `);
  }

  const state = { messages: [], lastError: null };
  window.__grafixAI = state;

  function renderMessages() {
    const root = document.getElementById('aiMessages');
    if (!root) return;
    if (!state.messages.length) {
      root.innerHTML = '<div class="empty">Начните диалог. AI работает через main process; API key в интерфейс не передаётся.</div>';
      return;
    }
    root.innerHTML = state.messages.map(message => '<div class="ai-message '+(message.error?'error ': '')+message.role+'">'+escAI(message.content)+'</div>').join('');
    root.scrollTop = root.scrollHeight;
  }

  function escAI(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }

  function friendlyAIError(result) {
    const code = result?.code || '';
    if (code === 'AI_NO_API_KEY') return 'OPENROUTER_API_KEY не настроен. Добавьте переменную окружения Windows и перезапустите Grafix.';
    if (code === 'AI_UNAUTHORIZED') return 'OpenRouter отклонил API key. Проверьте OPENROUTER_API_KEY и перезапустите Grafix.';
    if (code === 'AI_RATE_LIMITED') return 'OpenRouter временно ограничил частоту запросов. Повторите попытку позже.';
    if (code === 'AI_PROVIDER_5XX') return 'OpenRouter временно недоступен. Повторите запрос через некоторое время.';
    if (code === 'AI_TIMEOUT') return 'OpenRouter не ответил вовремя. Проверьте интернет-соединение и повторите запрос.';
    if (code === 'AI_NETWORK_ERROR') return 'Не удалось подключиться к OpenRouter. Проверьте интернет-соединение.';
    if (code === 'AI_EMPTY_RESPONSE') return 'OpenRouter вернул пустой ответ. Повторите запрос.';
    return String(result?.message || 'AI временно недоступен.');
  }

  window.refreshAIStatus = async function refreshAIStatus(preserveError = false) {
    const box = document.getElementById('aiStatusBox');
    if (!preserveError) state.lastError = null;
    try {
      const result = await window.dteDesktop.aiStatus();
      const ready = result?.state === 'ready';
      const hasError = Boolean(preserveError && state.lastError);
      box.className = 'ai-status '+(hasError || !ready ? 'error' : 'ready');
      const statusText = hasError ? friendlyAIError(state.lastError) : (ready ? 'AI настроен' : 'AI недоступен');
      box.innerHTML = '<span class="ai-dot"></span><span>'+escAI(statusText)+'</span>';
      document.getElementById('aiModel').textContent = result?.model || '—';
      document.getElementById('aiKeyState').textContent = ready ? 'настроен' : 'не настроен';
      document.getElementById('aiHint').textContent = ready ? 'Ctrl+Enter — отправить' : 'Настройте OPENROUTER_API_KEY и перезапустите Grafix';
      document.getElementById('aiSend').disabled = !ready;
      return result;
    } catch (error) {
      state.lastError = { code:'AI_STATUS_ERROR', message:error.message };
      box.className = 'ai-status error';
      box.innerHTML = '<span class="ai-dot"></span><span>Не удалось получить статус AI</span>';
      return {ok:false,error:error.message};
    }
  };

  window.clearAIConversation = function clearAIConversation() { state.messages.length = 0; state.lastError = null; renderMessages(); refreshAIStatus(); };

  window.sendAIMessage = async function sendAIMessage() {
    const input = document.getElementById('aiPrompt');
    const button = document.getElementById('aiSend');
    const content = String(input?.value || '').trim();
    if (!content || button.disabled) return;
    state.messages.push({role:'user',content});
    if (state.messages.length > 20) state.messages.splice(0, state.messages.length - 20);
    input.value = '';
    renderMessages();
    button.disabled = true;
    button.textContent = 'Отправка…';
    button.setAttribute('aria-busy','true');
    const prior = state.messages.map(m => ({role:m.role,content:m.content}));
    const system = {role:'system',content:'Ты AI-помощник Grafix 4.1. Отвечай по существу, не выдумывай данные расписания. Если вопрос требует данных, которых нет в диалоге, прямо скажи об этом.'};
    try {
      const result = await window.dteDesktop.aiAsk({messages:[system,...prior]});
      if (result?.ok) {
        state.lastError = null;
        state.messages.push({role:'assistant',content:result.content});
      } else {
        state.lastError = result || {code:'AI_INTERNAL_ERROR',message:'AI временно недоступен.'};
        state.messages.push({role:'assistant',content:friendlyAIError(result),error:true});
      }
      if (state.messages.length > 20) state.messages.splice(0, state.messages.length - 20);
    } catch (error) {
      state.lastError = {code:'AI_INTERNAL_ERROR',message:error?.message || 'неизвестная ошибка'};
      state.messages.push({role:'assistant',content:'AI временно недоступен: '+(error?.message || 'неизвестная ошибка'),error:true});
    } finally {
      button.disabled = false;
      button.textContent = 'Отправить';
      button.removeAttribute('aria-busy');
      renderMessages();
      refreshAIStatus(true);
    }
  };

  document.addEventListener('keydown', event => {
    if (event.ctrlKey && event.key === 'Enter' && document.activeElement?.id === 'aiPrompt') {
      event.preventDefault();
      window.sendAIMessage();
    }
  });

  document.addEventListener('DOMContentLoaded', () => { window.refreshAIStatus(); });
})();
