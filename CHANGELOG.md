# Changelog — Графикс

## 4.1.1 — 2026-09-25
- Реализован реальный OpenRouter Free LLM transport.
- Добавлен AI-помощник в пользовательский интерфейс.
- API key перенесён в main process и не передаётся в renderer.
- Добавлена автоматическая инициализация AI при старте приложения.
- Добавлена обработка отсутствия ключа, 401, 429, 4xx, 5xx, timeout и network errors.
- Добавлены реальные AI service, OpenRouter и Electron UI regression tests.
- Добавлен полный sweep всех 17 UI-разделов.
- Исправлен реальный runtime bug в planner/conflict rendering при одиночном конфликте без объекта b.
- QA acceptance scripts исключены из packaged app.
- Финальная production-сборка переведена на 4.1.1.
- Подтверждены clean install, runtime, installer, Portable, update, uninstall/reinstall и persistence.
- Подтверждена безопасность packaged app: source maps отсутствуют, OpenRouter secret material отсутствует.

## 4.1.0
- Constraint Studio.
- Schedule Advisor.
- Activity/Resource Model.
- Cross-branch resources and travel-aware conflicts.
- Calendar and substitution foundations.
- CP-SAT solver foundation and Windows acceptance.
