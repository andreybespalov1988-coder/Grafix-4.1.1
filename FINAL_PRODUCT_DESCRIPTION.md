# Графикс 4.0.0 FINAL — описание продукта

Графикс — локальное Windows desktop-приложение для управления расписанием образовательных и творческих организаций. Основной сценарий: организация → филиалы → педагоги/группы/участники/кабинеты → ограничения → учебный период → шаблоны занятий → генерация → проверка → ручная корректировка → календарные экземпляры → замены → печать/экспорт/публикация.

## Ключевая архитектура
- Electron desktop shell с `contextIsolation=true`, `nodeIntegration=false`.
- Локальное атомарное файловое хранилище с резервной копией и revision-контролем.
- Scheduling Engine для hard/soft constraints, генерации вариантов, диагностики и замен.
- Calendar Engine для разворачивания шаблонов в конкретные даты и исключения.
- Solver Adapter отделяет UI от алгоритма решения; текущий встроенный solver — локальная эвристика.
- Solver Worker переносит генерацию в отдельный поток и позволяет отменить длительный расчёт.
- AI Service является необязательным адаптером; без API программа работает штатно.

## Что можно делать ежедневно
Создавать и редактировать расписание, фиксировать занятия, генерировать варианты, просматривать конфликты, менять расписание вручную, делать замены, работать с учебным календарём, сохранять резервные копии, импортировать/экспортировать данные, печатать A4/PDF и выгружать PNG/JPG/CSV/XLSX/HTML.

## Grafix 4.1 release state — 2026-09-24
Grafix 4.1 extends the desktop scheduler with Constraint Studio, Schedule Advisor, Activity/Resource modeling, shared cross-branch resources, expanded generator profiles, substitution foundations, local-first Domain API and collaboration foundations. Current automated core/runtime regression and 10–500 activity performance tests pass. Windows packaged UI, installer, update, uninstall and final artifact acceptance remain pending a real Windows 11 execution.
