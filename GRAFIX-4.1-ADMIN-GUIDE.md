# Grafix 4.1 — Руководство администратора

## Хранилище

Grafix работает local-first. Основное состояние хранится в каталоге userData в `schedule-studio-data.json`, резервная копия — в `schedule-studio-data.backup.json`.

Storage Manager использует revision, atomic write и восстановление из backup при повреждении или более свежей резервной версии.

## Филиалы и shared resources

Каждый объект получает `branchId`. Общий ресурс может содержать `branchIds` и `shared=true`. Генератор и контроль конфликтов учитывают межфилиальное использование и travel time.

## Ограничения

Используйте HARD для недопустимых комбинаций и SOFT для предпочтений. Вес SOFT определяет влияние на quality/objective, но не должен превращать допустимое ограничение в скрытый hard rule.

## Solver

CP-SAT используется через `solver-cp-sat-adapter.js` и отдельный worker. Отмена решателя выполняется через поддерживаемый cancellation API.

## Безопасность

- `contextIsolation: true`.
- `nodeIntegration: false`.
- навигация ограничена локальным `index.html`.
- permissions отклоняются по умолчанию.
- импорт ограничен по размеру.
- проверяются path traversal и небезопасные конструкции в release/security tests.
- `sandbox: false` сохраняется как документированное архитектурное ограничение совместимости.

## Диагностика

Раздел настроек показывает путь данных, backup, revision, время сохранения, размер файла и статус storage.

## Backup policy

Перед крупными импортами, изменением правил генерации и массовыми заменами рекомендуется создавать JSON backup и хранить его вне каталога приложения.

## Release policy

Нельзя объявлять Grafix 4.1 Production Ready до прохождения финальной Windows acceptance matrix, включая установку, UI, persistence, packaging, uninstall и update.
