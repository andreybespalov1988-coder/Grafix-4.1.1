# Графикс 3.1.0 — Final Audit

## Scope
Продолжение разработки Графикс 3.0.0 без создания нового проекта. Перед изменениями создана резервная точка `../Графикс-3.0.0.backup`.

## Архитектура
Scheduling Engine вынесен в `scheduling-engine.js` и логически разделён на:
- DATA MODEL adapters;
- CONSTRAINT ENGINE — hard/soft constraints;
- SCHEDULING ENGINE — построение вариантов;
- OPTIMIZATION ENGINE — weighted soft scoring;
- CONFLICT ENGINE — Conflict Center;
- EXPLANATION ENGINE — причины и варианты решения;
- MANUAL EDITOR integration — проверка ручных изменений;
- VALIDATION ENGINE — evaluate/hardReasons;
- ANALYTICS integration.

Интерфейс не зависит от конкретного алгоритма: генератор вызывается через публичный API SchedulingEngine, поэтому в дальнейшем эвристический алгоритм можно заменить solver-ом без переписывания UI.

## Реализовано
- Hard constraints: ресурсы, рабочее время, доступность, вместимость, тип кабинета, филиал, дневные лимиты, max consecutive, blocked slots, закреплённые занятия.
- Soft constraints с приоритетами critical/high/medium/low.
- 3 варианта: баланс / педагоги / группы.
- Метрики качества, completion, hard conflicts, soft penalty, окна.
- Объяснение невозможности и предложения решения.
- Conflict Center и подтверждаемое автоисправление.
- Lock/PIN сохраняется при генерации.
- Ручное изменение сразу проходит проверку hard constraints.
- Замены педагогов с подбором кандидатов.
- Учебный период с weekly / odd-even / cycle моделью и исключениями в данных.
- XLSX import wizard с сопоставлением колонок.
- XLSX export.
- PNG/JPG экспорт расписания.
- Расширенная аналитика педагогов и кабинетов.
- Version 3.1.0 и release notes.
- Существующие storage/import/print/public функции сохранены.

## Тесты
| Проверка | Результат |
|---|---|
| Static syntax | PASS |
| Smoke | PASS |
| Storage | PASS |
| Restart lifecycle | PASS |
| A4 print | PASS |
| UI static | PASS |
| Release static | PASS |
| Public generation | PASS |
| Print editor | PASS |
| Dashboard/teacher availability | PASS |
| Data migration | PASS |
| Scheduling Engine unit/runtime | PASS |
| Scheduling benchmark 10 | PASS |
| Scheduling benchmark 30 | PASS |
| Scheduling benchmark 50 | PASS |
| Scheduling benchmark 100 | PASS |
| XLSX writer opened by openpyxl | PASS |
| Real Electron installer build | BLOCKED — `node_modules` отсутствуют, попытка `npx electron` не завершилась в доступное время |
| Real XLSX import inside Electron renderer | NOT TESTED — нужен реальный renderer/browser execution |
| Tilda external publication | BLOCKED — внешний сервис/аккаунт не подключён |
| AI provider | NOT TESTED — API key отсутствует |
| Server RBAC/CSRF/rate limiting | NOT APPLICABLE to local-only build; no server |

## Performance benchmark
- 10 lessons: 63 ms
- 30 lessons: 195 ms
- 50 lessons: 295 ms
- 100 lessons: 883 ms

Тесты запускались на текущем runtime окружении. Это не является универсальным benchmark для всех Windows-компьютеров.

## Known limitations
1. Текущий Scheduling Engine остаётся эвристическим. Он модульно подготовлен к solver replacement, но не является промышленным CP-SAT/constraint solver.
2. Учебные периоды уже имеют модель и настройки, но полноценная дата-за-датой генерация повторяющегося расписания требует отдельного цикла календарного движка.
3. XLSX import wizard реализован в renderer и требует реального Electron/browser execution для полного runtime PASS.
4. Live Tilda publication и AI остаются внешними интеграциями.
5. Windows installer не собран в текущем окружении.
