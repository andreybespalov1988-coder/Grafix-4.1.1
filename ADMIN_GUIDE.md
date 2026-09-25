# Grafix 4.1 — руководство администратора

## Данные
Основной файл и backup находятся в пользовательском каталоге Electron. Приложение сохраняет данные атомарно и использует revision для защиты от записи устаревшей версии.

## Филиалы
Каждая сущность расписания содержит `branchId`. Переключатель филиала ограничивает рабочий набор данных текущим филиалом. Удаление филиала требует подтверждения и удаляет его локальные сущности.

## Ограничения
Правила расписания хранят рабочее время, шаг сетки, дневные лимиты, максимальную непрерывную нагрузку, допустимые дни, заблокированные интервалы и soft-constraints с приоритетами.

## Резервирование
Рекомендуется перед массовым импортом делать JSON backup. Восстановление из JSON нормализует структуру и сохраняет данные в текущую базу.

## AI
AI работает через OpenRouter Free. Модель — openrouter/free, endpoint — https://openrouter.ai/api/v1/chat/completions. Ключ OPENROUTER_API_KEY читается только в main process. При отсутствии ключа, сети или доступности OpenRouter основное приложение продолжает работать; AI-раздел показывает понятное состояние и ошибку без падения Grafix.

## Grafix 4.1 administration
Grafix 4.1 remains local-first. The runtime enforces context isolation, disables renderer Node integration, uses a navigation allowlist, denies permissions by default and applies import size guards. The renderer remains `sandbox: false` for compatibility; this is a documented security limitation, not a sandboxed deployment claim.

Before production rollout, execute `acceptance-final/GRAFIX-4.1-FINAL-WINDOWS-ACCEPTANCE.cmd` on the target Windows 11 environment and retain its log with the release manifest.
