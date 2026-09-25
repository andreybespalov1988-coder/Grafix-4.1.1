# Competitor Analysis — 2026-09-23

Сравнение выполнено по официальным материалам продуктов. Оно не является рейтингом.

| Категория | Графикс 4.0.0 | Untis | aSc TimeTables | FET | Prime Timetable | TimeTabler |
|---|---|---|---|---|---|---|
| Автоматическая генерация | PARTIAL: локальная эвристика | Да | Да | Да | Да | Да |
| Hard constraints | Да, в текущей модели | Да | Да | Очень широкий набор | Да | Да |
| Soft constraints/weights | Да | Да | Да | Да | Да | Да |
| Exact/CP solver | Нет | proprietary | proprietary | зрелый собственный алгоритм | proprietary | proprietary |
| Несколько вариантов | 3 | Да | Да | Да | Да | Да |
| Explanation/diagnosis | Да | Да | Да | Да | Да | Да |
| Manual drag/edit | Да | Да | Да | Да | Да | Да |
| Замены | PARTIAL | зрелый модуль | отдельный substitutions workflow | не основной фокус | зависит от сценария | отдельный StaffCover |
| Полный календарь года | PARTIAL | Да | Да | Да/через сложные режимы | Да | Да |
| XLSX | Да | Да | Да | через импорт/экспорт форматы | Да | MIS exports |
| PDF/HTML/изображения | Да | Да | Да | HTML | Да | Да |
| Локальная автономность | Да | Да/варианты | Да | Да | Да/варианты | Да |
| Multi-user collaboration | Нет | Да, WebUntis | Да, online | Нет как cloud collaboration | зависит от редакции | нет как core cloud |
| Mobile | Нет нативного приложения | Да | Да | Нет | web/desktop | нет как core app |
| AI | adapter only | не заявлено как core | не заявлено как core | не core | не core | не core |
| Backup/restore | Да | Да | Да | Да | Да | Да |

## Где Grafix уже силён
- local-first desktop без обязательного сервера;
- единая модель филиалов + расписание + печать + публикация;
- explainability и Conflict Center в одном интерфейсе;
- календарные экземпляры отделены от шаблонов;
- worker-генерация не блокирует UI;
- generic organization branding.

## Где конкуренты сильнее
- зрелость solver и количество ограничений;
- многолетняя проверка на больших школьных задачах;
- multi-user/web/mobile экосистема Untis/aSc;
- глубина календаря, курсов, substitutions и MIS integration;
- у FET особенно широкая библиотека специализированных ограничений.

## Будущие направления
- полноценный локальный CP-SAT/ILP backend;
- полная дата-ориентированная генерация с переносом экземпляров;
- полноценная квалификация педагогов и subject/program model;
- multi-user collaboration/API;
- мобильный клиент/PWA;
- production AI provider adapter.
