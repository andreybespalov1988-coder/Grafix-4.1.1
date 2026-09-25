GRAFIX 4.1 FINAL WINDOWS ACCEPTANCE

This package is the final Windows acceptance harness for the current Grafix 4.1 source.

Run:
  acceptance-final\GRAFIX-4.1-FINAL-WINDOWS-ACCEPTANCE.cmd

The harness performs real checks of:
- Windows / Node / npm / network
- dependency installation
- solver and full regression
- Electron solver worker
- Electron UI acceptance
- Windows NSIS + Portable packaging
- clean installation
- packaged UI launch/navigation/persistence
- backup/restore
- import/export through packaged renderer
- desktop and Start Menu shortcuts
- portable launch
- update 4.1.0 -> 4.1.1 using the same appId
- uninstall
- reinstall
- final SHA-256 artifact hashes

PASS is emitted only after all critical checks complete successfully.
The harness does not use the old P0.1 V5/V6/V7/V8 runners.
