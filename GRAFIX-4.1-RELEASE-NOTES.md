# Grafix 4.1 — Release Notes

## 4.1.1 — Production completion

### Completed product work
- Implemented real OpenRouter Free LLM transport.
- Added automatic AI service initialization at application startup.
- Added main-process-only API key handling.
- Added secure AI IPC through preload.
- Added integrated Grafix AI assistant UI.
- Added clear AI status, loading, missing-key and network/provider error states.
- Added 401, 429, 4xx, 5xx, timeout and network error handling.
- AI failure never terminates the main Grafix application.
- Added real OpenRouter invalid-key integration test.
- Added real Electron AI UI test path.
- Added full 17-view Electron UI sweep.
- Fixed planner/conflict-center null-handling bug for singleton conflicts.
- Excluded QA-only acceptance scripts from packaged application.
- Removed stale production artifacts and updated release documentation.
- Preserved Electron 38.8.6 and electron-builder 26.15.3.

### Windows production evidence
- Clean npm ci PASS.
- Full regression PASS.
- Performance PASS through 500 activities.
- CP-SAT Electron worker PASS.
- Installer PASS.
- Portable PASS.
- Update 4.1.0 → 4.1.1 PASS.
- Uninstall retains user data.
- Reinstall restores access to persisted data.
- Packaged security audit PASS.

### OpenRouter limitation
The machine used for acceptance has no OPENROUTER_API_KEY configured. Therefore a real authenticated model response from openrouter/free is deliberately recorded as NOT TESTED. All no-key and provider-error paths are tested; no fake response is used.
