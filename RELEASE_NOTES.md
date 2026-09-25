# Графикс 4.0.0 FINAL — Release Notes

Графикс 4.0.0 — финальный локальный desktop-релиз цикла разработки. Основное улучшение относительно 3.1.0 — переход от чисто недельного представления к модели учебного периода и конкретных экземпляров занятий, плюс вынесение генерации в worker.

Важно: текущий solver остаётся эвристическим; полноценный CP-SAT/exact solver в этой сборке не заявляется. Windows installer не включён в артефакты этой среды, потому что Electron/electron-builder не удалось установить из npm до таймаута сети.

## Grafix 4.1.0 — pre-release acceptance state
This build contains the 4.1 scheduling foundations and acceptance harness. Automated core/runtime regression and performance validation pass in the current development environment. Final Windows 11 packaged UI, installation, update, uninstall and artifact acceptance have not yet been executed for this post-P0.1 state and must not be represented as PASS.
