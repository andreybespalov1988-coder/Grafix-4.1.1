# Графикс 3.1.0 — Developer Guide

## Core
`SchedulingEngine` экспортирует:
- `getRules`
- `hardReasons`
- `softPenalty`
- `evaluate`
- `candidateSlots`
- `generateVariant`
- `generateVariants`
- `conflicts`
- `explain`
- `findSubstitutes`
- `periodOccurrences`
- `readXLSX`
- `makeXlsx`

## Extension point
Чтобы заменить эвристику на solver, сохраните контракт `generateVariant(db, profile, seed)` и `generateVariants(db)`. UI использует только эти методы и возвращаемые `lessons`, `metrics`, `issues`.

## Data model
Занятия используют `teacherId`, `groupId`, `roomId`, `subjectId`, `programId`. Текстовые поля сохраняются для обратной совместимости и отображения.

## Testing
Основной набор: `npm run test:all`.
Scheduling-specific: `npm run test:scheduling-engine`.
Benchmark: `node scheduling_engine_benchmark.js`.

## Release
Версия задаётся в `package.json`, renderer `STORAGE_VERSION` и `storage-manager.js` синхронизированы на 3.1.0.
