# РИТМ 2.1.0 — архитектура, persistence и ребрендинг

## Приложение

Electron desktop-приложение без сервера.

- `main.js` — native Electron, IPC, файловое хранилище, экспорт/PDF;
- `preload.js` — context-isolated bridge;
- `index.html` — renderer и UI;
- `storage-manager.js` — единая persistence-служба;
- `assets/` — логотип и иконки.

## Постоянная модель

```text
organization
branches[]
teachers[]
rooms[]
people[]
lessons[]
printSettings
```

## Жизненный цикл данных

```text
User action
  ↓
mutate in-memory db
  ↓
save()/autosave
  ↓
revision++
  ↓
localStorage recovery mirror
  ↓
one queued IPC payload
  ↓
storage-manager
  ↓
read current disk revision
  ↓
reject stale write if revision <= persisted revision
  ↓
backup previous primary
  ↓
temp file + fsync
  ↓
atomic replacement
  ↓
saved state
```

При запуске:

```text
localStorage mirror + disk envelope
          ↓
compare revision
          ↓
newest valid source
          ↓
normalize database
          ↓
restore activeBranchId
          ↓
load printSettings
          ↓
render application
```

При закрытии:

```text
beforeunload/pagehide
  ↓
one guarded shutdown save
  ↓
revision++
  ↓
sync IPC
  ↓
storage-manager
```

Если ранее запланированный async save приходит после shutdown-save, storage-manager видит меньшую revision и отклоняет запись.

## Backup/recovery

Основной файл:

```text
%APPDATA%/Schedule Studio/schedule-studio-data.json
```

Резервная копия:

```text
%APPDATA%/Schedule Studio/schedule-studio-data.backup.json
```

При повреждении primary выбирается валидный backup. Если backup новее primary, он также считается источником восстановления.

## Диагностика

Настройки → Диагностика хранилища показывает:

- реальный путь базы;
- путь backup;
- revision;
- время последнего сохранения;
- размер файла;
- источник загрузки;
- статус storage;
- последнюю ошибку.
