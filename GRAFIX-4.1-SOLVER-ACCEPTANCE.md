# GRAFIX 4.1 — P0.1 SOLVER ACCEPTANCE

Дата: 2026-09-23

## Baseline

4.0 Windows acceptance candidate:
`74130fb7e9d1580e19b8de13c106948d23ccf127e9c39ee3f0550f9e063d2cf4`

4.0 historical frozen source:
`02f7430ff08de6bef0f86ad9a04ddf91e4a7ef7bcdf1ec5c427eede8a855df13`

Development branch:
`develop/4.1`

Baseline import commit:
`f47d6f79d8fe64f27061d086d90980edc536c854`

## Implemented

- `SolverAdapter` preserved as the application boundary.
- Existing heuristic solver preserved unchanged as the synchronous compatibility backend.
- New asynchronous CP-SAT backend isolated in `worker_threads`.
- CP-SAT model translation for current 4.0 `lessons`.
- Hard feasibility constraints for teacher/group/room, time, availability, capacity, room type, allowed days and blocked slots.
- Locked activity preservation.
- Explicit application statuses including `OPTIMAL`, `FEASIBLE`, `INFEASIBLE`, `UNKNOWN`, `MODEL_INVALID`, `TIME_LIMIT`.
- Structured solver result.
- fixed-seed deterministic certification mode (`numSearchWorkers=1`).
- repeated-solution generation using exact no-good cuts plus seed variation.
- cancellation/timeout path in the worker boundary.

## Tests executed in current Linux development environment

### Existing Grafix regression
`npm run test:all` — PASS.

All existing 4.0 test groups remained green, including Scheduling Engine, Calendar Engine, Solver Adapter, AI fallback and Security audit.

### New model/adapter checks
- `node solver_model_test.js` — PASS.
- `node solver_regression_test.js` — PASS.
- JavaScript syntax checks for all new solver files — PASS.

### New CP-SAT integration suite
`npm run test:solver-foundation` — BLOCKED.

Exact reason:
`Cannot find package 'or-tools-wasm'`

The current Linux environment cannot install the new dependency because external package registry access is unavailable. No CP-SAT result is being simulated.

## Current acceptance status

| Area | Status |
|---|---|
| 4.0 compatibility tests | PASS |
| Solver boundary preserved | PASS |
| CP-SAT model translation | PASS |
| CP-SAT package installed | BLOCKED |
| CP-SAT real solve | BLOCKED |
| Feasibility test | BLOCKED |
| Infeasibility test | BLOCKED |
| Timeout test | BLOCKED |
| Locked test | BLOCKED |
| Determinism test | BLOCKED |
| Objective test | BLOCKED |
| Multiple solutions | BLOCKED |
| Windows CP-SAT packaging | NOT TESTED |
| UI integration | NOT TESTED |

## Required next gate

On the real Windows 11 development environment:

1. `npm install --no-audit --no-fund` on `develop/4.1`;
2. verify `or-tools-wasm` is installed;
3. run `npm run test:solver-foundation`;
4. run `npm run test:all`;
5. run Windows Electron runtime tests with the CP-SAT worker;
6. benchmark heuristic vs CP-SAT on 10/30/50/100/200 cases.

P0.2 must not start until the CP-SAT integration suite is green or a specific blocking defect is documented and resolved.


## Current implementation gate

- `SolverAdapter` + heuristic backend: PASS
- CP-SAT worker boundary: PASS (code-level)
- Secure main/preload IPC boundary: PASS (code-level)
- `npm run test:all`: PASS in current development environment
- CP-SAT runtime: BLOCKED until `or-tools-wasm@0.9.1` is installed and executed on the real Windows 11 development machine
- Electron solver worker runtime: NOT TESTED
- Windows packaging with CP-SAT dependency: NOT TESTED

No P0.1 PASS is claimed from static/code-level validation.
