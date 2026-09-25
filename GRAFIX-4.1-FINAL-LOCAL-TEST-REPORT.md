# Grafix 4.1 — Final Local Test Report

Date: 2026-09-24
Git commit: 5e911fc
Status: PARTIAL — Windows final acceptance not yet executed for the post-P0.1 product state.

## PASS — current development environment

- `node scripts_check.js`
- `npm run test:all`
- `node activity_model_test.js`
- `node constraint_studio_test.js`
- `node constraint_studio_relationships_test.js`
- `node constraint_studio_kinds_test.js`
- `node schedule_advisor_test.js`
- `node substitution_engine_test.js`
- `node substitution_lifecycle_test.js`
- `node domain_api_test.js`
- `node collaboration_foundation_test.js`
- `node cross_branch_resource_test.js`
- `node constraint_persistence_test.js`
- `node scheduling_engine_test.js`
- `node calendar_engine_test.js`
- `node persistence_storage_test.js`
- `node persistence_restart_test.js`
- `node solver_model_test.js`
- `node solver_async_contract_test.js`
- `node --expose-gc final_performance_benchmark.js`
- `release_static_test.js`

The full `npm run test:all` completed with exit code 0 in the current development environment.

## Performance evidence

The final benchmark exercised 10, 30, 50, 100, 200 and 500 activities. All generated cases completed at 100% placement with zero hard violations in the measured result sets.

Representative final measurement:

- 10 activities: ~31 ms generation.
- 50 activities: ~121 ms generation.
- 100 activities: ~328 ms generation.
- 200 activities: ~1.15 s generation.
- 500 activities: ~6.13 s generation.

Schedule Advisor analysis for 500 activities was ~6.49 s.

## NOT TESTED / BLOCKED locally

`npm run test:electron-ui` cannot execute because the current Linux working environment has no installed Electron package. `npm install --ignore-scripts --no-audit --no-fund` timed out before dependencies became available. This is an environment limitation, not evidence that Electron UI acceptance passes or fails.

Windows final packaging, installation, packaged UI, backup/restore file cycle, update, uninstall and reinstall require execution on Windows 11. They are covered by the final acceptance script but have not been represented as PASS here.

## Previously accepted P0.1 evidence

A real user-executed Windows 11 acceptance log for P0.1 was supplied in the conversation and ended with:

`P0.1 WINDOWS ACCEPTANCE: PASS`

and Windows packaging, Electron solver worker and full regression all returned exit code 0.

This historical evidence remains valid for P0.1 and is not used as evidence for the new post-P0.1 final Windows acceptance.
