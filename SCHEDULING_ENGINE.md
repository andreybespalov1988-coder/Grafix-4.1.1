# Scheduling Engine

## Hard constraints
Проверяются наличие ресурсов, пересечения педагога/группы/кабинета, доступность, рабочее время, вместимость, тип помещения, филиал, длительность, locked lessons, дневные лимиты, max consecutive и blocked slots.

## Soft constraints
Поддерживаются избегание позднего времени, compactness, gaps, preferred days и single room. Каждая soft-цель имеет приоритет Critical/High/Medium/Low и вес.

## Варианты
Профили: balanced, teacher, group. Каждый вариант содержит метрики completion, hardConflicts, softPenalty, gaps, placed/unplaced, locked и quality.

## Solver
Встроенный алгоритм — эвристический. `solver-adapter.js` не привязывает UI к нему. Для production-grade exact/CP-SAT solver требуется отдельный локальный runtime/библиотека; в этой сборке он не объявлен реализованным.

## Explainability
Для занятия рассчитываются hard reasons, число доступных слотов и возможные решения. Это используется Conflict Center и диалогом «Почему?».

## Grafix 4.1 engine changes
Scheduling now accounts for Activity occupied time (setup + active + teardown), call/travel windows, shared cross-branch resources and branch travel conflicts. The generator exposes 10 profiles: Balanced, Teacher Priority, Group Priority, Room Priority, Minimal Gaps, Minimal Movement, Compact Day, Fair Load, Branch Utilization and Custom. A final repair/validation pass rejects generated results that still contain hard conflicts.
