# Grafix 4.1 — Release Status

Date: 2026-09-25
Version: 4.1.1
Product: Grafix
Electron: 38.8.6
electron-builder: 26.15.3
Solver: or-tools-wasm 0.9.1

## Status
PRODUCTION CANDIDATE — Windows completion PASS with one external credential-dependent test pending.

## Completed
- Full runtime regression: PASS.
- Full Electron UI sweep: PASS for all 17 views.
- Real Windows UI acceptance: PASS.
- Backup/restore: PASS.
- Import/export: PASS for CSV, XLSX, HTML, PNG, JPG and PDF.
- Undo/redo: PASS.
- Constraint Studio: PASS.
- Schedule Advisor: PASS.
- Activity/Resource Model and cross-branch resources: PASS.
- Solver worker: PASS.
- Performance benchmark: PASS through 500 activities with 0 hard violations in measured cases.
- Clean npm ci regression: PASS.
- Clean Windows production build: PASS.
- Unpacked artifact smoke: PASS.
- Portable artifact smoke: PASS.
- 4.1.0 → 4.1.1 update: PASS.
- Uninstall: PASS with user data retained.
- Reinstall: PASS with data persistence retained.
- Packaged security audit: PASS; source maps absent; QA acceptance files excluded; no OpenRouter secret embedded.

## OpenRouter
Implemented architecture:
UI → preload/IPC → main process → AIService → OpenRouter.
- Endpoint: https://openrouter.ai/api/v1/chat/completions
- Model: openrouter/free
- API key: OPENROUTER_API_KEY, read only in main process.
- Startup initialization: PASS.
- No-key handling: PASS.
- 401/429/4xx/5xx/timeout/network handling: PASS by runtime contract tests.
- Real invalid-key OpenRouter request: PASS.
- Real valid-key model response: NOT TESTED because no OPENROUTER_API_KEY is configured on this Windows machine. No key was invented or printed.
