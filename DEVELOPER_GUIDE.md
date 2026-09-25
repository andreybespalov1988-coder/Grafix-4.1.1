# Графикс 4.0.0 — руководство разработчика

## Файлы
- `index.html` — renderer/UI и существующая бизнес-логика приложения.
- `main.js` — Electron main process, IPC, файловые диалоги и PDF.
- `preload.js` — минимальный IPC bridge.
- `storage-manager.js` — атомарное локальное хранилище.
- `scheduling-engine.js` — ограничения, эвристический solver, диагностика, XLSX.
- `calendar-engine.js` — даты и экземпляры занятий.
- `solver-adapter.js` — интерфейс замены solver.
- `solver-worker.js` — worker для генерации без блокировки UI.
- `ai-service.js` — необязательный AI transport adapter.

## Принцип изменений
UI не должен знать детали конкретного solver. Любой будущий CP-SAT/ILP/другой solver подключается через adapter и возвращает нормализованные варианты.

## Тесты
`npm run test:all` запускает статические проверки, smoke, storage/restart, печать, UI, публикацию, generator, data model, scheduling engine, calendar engine, solver adapter и AI fallback.

## Grafix 4.1 development boundary
The domain boundary is implemented in `domain-api.js`; local persistence remains behind the existing storage layer and collaboration operations are isolated in `collaboration-foundation.js`. New scheduling features should enter through domain/runtime APIs rather than directly coupling UI logic to storage.

P0.2/P0.3/P0.4 automated tests are part of `npm run test:all`. Electron UI acceptance requires the Electron runtime and is intentionally not inferred from static tests.
