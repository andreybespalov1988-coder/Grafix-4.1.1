# Grafix 4.1.1 — Final Acceptance Matrix

Date: 2026-09-25
Version: 4.1.1
Electron: 38.8.6
electron-builder: 26.15.3

| Area | Status | Evidence |
|---|---|---|
| Windows startup | PASS | Real packaged Electron runtime |
| Electron runtime | PASS | Electron 38.8.6 worker/UI acceptance |
| UI navigation | PASS | Full 17-view Electron sweep |
| Organization | PASS | Runtime/UI acceptance + persistence |
| Branches | PASS | Cross-branch runtime tests + UI acceptance |
| Teachers | PASS | Runtime/UI acceptance |
| Groups/people | PASS | Runtime/UI acceptance |
| Rooms | PASS | Runtime/UI acceptance |
| Schedule editing | PASS | Electron UI acceptance |
| Calendar | PASS | Calendar engine + UI sweep |
| Constraint Studio | PASS | CRUD/relationship/extended-kind tests |
| Schedule Advisor | PASS | Diagnosis/repair/stress tests |
| Activity/Resource model | PASS | Runtime/persistence/cross-branch tests |
| Substitutions 2.0 | PASS | Engine + lifecycle tests |
| Solver | PASS | Electron solver worker PASS |
| Automatic scheduling | PASS | Generator runtime tests + performance |
| Conflict center | PASS | Runtime tests + planner regression |
| Planner | PASS | Full UI sweep; singleton-conflict null bug fixed |
| Undo | PASS | Real Electron UI acceptance |
| Redo | PASS | Real Electron UI acceptance |
| XLSX import | PASS | Real Electron UI acceptance |
| XLSX export | PASS | Real Electron UI acceptance |
| CSV | PASS | Real Electron UI acceptance |
| HTML | PASS | Real Electron UI acceptance |
| PDF | PASS | Real Electron UI acceptance |
| PNG | PASS | Real Electron UI acceptance |
| JPG | PASS | Real Electron UI acceptance |
| Backup | PASS | Real Electron UI acceptance |
| Restore | PASS | Real Electron UI acceptance |
| Restart/persistence | PASS | Persistence/restart tests |
| Installer | PASS | Real NSIS install |
| Portable | PASS | Real Portable artifact smoke |
| Update 4.1.0 → 4.1.1 | PASS | Real installed update |
| Uninstall | PASS | Data retained after uninstall |
| Reinstall | PASS | Data readable after reinstall |
| Packaged security | PASS | app.asar audit, no maps/secrets/QA files |
| Production dependencies audit | PASS | npm audit --omit=dev: 0 vulnerabilities |
| Full npm audit | LIMITATION | 2 high findings are in mandated Electron 38.8.6 chain; Electron upgrade prohibited |
| AI startup | PASS | AI service initialized automatically |
| AI UI | PASS | Integrated AI assistant UI |
| AI no-key handling | PASS | No-key IPC/UI runtime test |
| AI invalid-key | PASS | Real OpenRouter HTTP 401 |
| AI 429/5xx/timeout/network | PASS | Real service error-path tests |
| AI authenticated openrouter/free response | NOT TESTED | OPENROUTER_API_KEY absent on acceptance machine; no fake key/response |
| Production build | PASS | Clean Windows production build |
| Regression | PASS | test:all + performance + solver + Electron UI |