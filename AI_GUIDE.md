# Grafix 4.1 — AI / OpenRouter

## Назначение
Grafix содержит встроенный AI-помощник на базе OpenRouter Free. AI используется как вспомогательный интерфейс для текстовых запросов и анализа, а детерминированный Schedule Advisor продолжает работать независимо от генеративного AI.

## Архитектура
UI → preload / IPC → main process → AIService → OpenRouter API.

Renderer не получает API key. Переменная окружения OPENROUTER_API_KEY читается только в main process.

## Провайдер
- Endpoint: https://openrouter.ai/api/v1/chat/completions
- Model: openrouter/free
- Timeout по умолчанию: 30 секунд
- Максимальный timeout: 120 секунд
- Максимальный размер сообщения: 120000 символов
- Максимальный размер диалога: 40 сообщений на transport-уровне

## Запуск
AIService создаётся при старте Grafix. При отсутствии OPENROUTER_API_KEY приложение продолжает полноценную работу; AI-раздел показывает понятное состояние «API key не настроен», а отправка запроса блокируется.

Для Windows:
1. Задайте переменную среды OPENROUTER_API_KEY на уровне пользователя или системы.
2. Полностью перезапустите Grafix.
3. Откройте «AI-помощник» и проверьте статус.

Сам ключ не хранится в файлах Grafix и не встраивается в packaged app.

## Обработка ошибок
- AI_NO_API_KEY — ключ отсутствует.
- AI_UNAUTHORIZED — OpenRouter вернул HTTP 401.
- AI_RATE_LIMITED — OpenRouter вернул HTTP 429.
- AI_PROVIDER_4XX — прочая ошибка HTTP 4xx.
- AI_PROVIDER_5XX — ошибка HTTP 5xx.
- AI_TIMEOUT — превышен timeout.
- AI_NETWORK_ERROR — ошибка сетевого соединения.
- AI_EMPTY_RESPONSE — ответ без текста модели.
- AI_INVALID_REQUEST / AI_REQUEST_TOO_LARGE — локальная валидация запроса.

Ни одна из этих ошибок не должна завершать процесс Grafix.

## Проверка
npm run test:ai-service проверяет локальный контракт и обработку ошибок.
npm run test:openrouter выполняет реальный запрос к OpenRouter с неправильным ключом для проверки 401. При наличии OPENROUTER_API_KEY дополнительно выполняется реальный запрос модели openrouter/free.
npm run test:electron-ai-ui проверяет реальный UI-путь AI в Electron.

## Граница с Schedule Advisor
Schedule Advisor — детерминированная функция Grafix. Он не зависит от OpenRouter, не отправляет расписание наружу и остаётся работоспособным без API key и без интернета.
