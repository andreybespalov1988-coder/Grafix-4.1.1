# Grafix 4.1 — specification set

**Status:** Architecture / product specification only. No Grafix 4.1 implementation is authorized by this document set.

**Date:** 2026-09-23

**Baseline product:** Grafix 4.0.0

**Principle:** preserve the local-first Windows product direction while making the scheduling core solver-grade, diagnosable, extensible to creative activities, and ready for optional web/API clients.


# 1. Decision summary

**Selected architecture: Hybrid CP-SAT + heuristic, exposed through a solver sidecar/worker behind the existing `SolverAdapter` seam.**

The goal is not to discard Grafix's existing scheduling engine. The goal is to make it a model/validation layer and retain its fast heuristic capabilities while introducing an authoritative exact-capable optimization backend.

## 2. Architecture candidates

| Option | Strengths | Weaknesses | 4.1 decision |
|---|---|---|---|
| CP-SAT | Natural fit for Boolean/integer timetable decisions, explicit feasibility statuses, bounded time, multiple solutions, strong combinatorial search | Model construction effort; must keep model integer and auditable | **SELECT** as authoritative backend |
| ILP/MIP | Mature linear optimization ecosystem; good for linear objective structures | Timetabling logic can become cumbersome; CP-style combinatorics less direct | Keep as future specialty backend |
| Hybrid CP-SAT + heuristic | Exact-capable core plus fast warm starts/repairs and existing Grafix behavior; good migration path | More moving parts and result reconciliation | **SELECT** |
| Solver portfolio | Allows per-problem solver choice | Highest implementation and testing complexity | Future 4.2+ option |

## 3. Why CP-SAT is the primary exact-capable backend

CP-SAT explicitly reports `OPTIMAL`, `FEASIBLE`, `INFEASIBLE`, `MODEL_INVALID`, and `UNKNOWN`, with time limits and solution callbacks. This maps directly to the 4.1 outcome contract. [Official OR-Tools CP-SAT documentation](https://developers.google.com/optimization/cp/cp_solver). The architecture should therefore use CP-SAT for authoritative feasibility and bounded optimization, while never assuming that `FEASIBLE` means globally optimal.

## 4. Runtime isolation

Do not embed the solver directly inside the Electron renderer. The proposed topology is:

`Renderer → preload IPC → main process → SolverAdapter → local solver worker/sidecar → result JSON`

The solver process must have:

- explicit CPU/time budget;
- cancellation by process boundary;
- bounded memory policy;
- versioned protocol;
- no direct DOM access;
- no access to arbitrary filesystem paths;
- deterministic seed option for reproducible tests;
- structured diagnostic output.

A native Windows sidecar is preferred over Electron-renderer native bindings because it preserves the existing security boundary and supports hard process termination.

## 5. Solver protocol

### Request

```json
{
  "schemaVersion": "4.1",
  "operation": "generate|improve|repair|optimize",
  "instanceId": "...",
  "activities": [],
  "resources": [],
  "constraints": [],
  "calendar": {},
  "initialSchedule": [],
  "lockedActivityIds": [],
  "objectiveProfile": {},
  "timeLimitSeconds": 30,
  "solutionLimit": 3,
  "randomSeed": 42
}
```

### Result

```json
{
  "status": "FEASIBLE",
  "elapsedMs": 1842,
  "objective": {"hard": 0, "softPenalty": 37},
  "schedule": [],
  "diagnostics": {},
  "improvement": {},
  "solver": {"name": "cp-sat", "version": "..."}
}
```

## 6. Constraint encoding principles

- Every hard rule must become an auditable model constraint.
- Every soft rule must have an explicit weight and objective contribution.
- Pinned activities become fixed variables/assignments.
- Branch/shared-resource conflicts are modeled at organization scope.
- Setup/teardown/travel consume time/resource capacity.
- Recurrence and calendar exceptions are expanded to dated activity instances before solving when date precision is required.

## 7. Existing heuristic role

The current heuristic engine remains valuable for:

- very fast draft generation;
- warm starts for CP-SAT;
- local repair neighborhoods;
- emergency fallback when an exact model cannot be produced;
- regression comparison against 4.0 behavior.

It must be labeled as heuristic in diagnostics. It must never silently present a heuristic outcome as an optimal proof.

## 8. Generate / Improve / Repair / Optimize

### Generate
Build from scratch, optionally using the heuristic solution as a warm start.

### Improve
Start from current schedule; preserve locks; allow bounded changes; return improvement delta.

### Repair
Freeze unaffected activities and solve a localized neighborhood plus dependency cone.

### Optimize
Search against a named objective vector with time/solution limits.

## 9. Multiple solutions

A/B/C should use repeated diversified solves or solution callbacks. Each solution needs a measurable objective vector and a distance metric from the other solutions so the UI can reject three near-identical variants.

## 10. Time limits and unknown states

The UI must distinguish:

- proven infeasible;
- feasible but not proven optimal;
- optimal within the model/time budget;
- search stopped without a solution;
- model invalid.

Never map all failure states to “generation failed”.

## 11. Incremental solving

First implementation can operate at the application level: build a new model from the current state, freeze unchanged/pinned activities, and solve only the allowed neighborhood. Native incremental model reuse can be evaluated after correctness is proven.

## 12. Backend portability

Primary target: Windows x64 offline. A solver abstraction must not tie domain logic to one vendor. HiGHS is an alternative open-source MIP/QP/LP backend with Windows/Linux/macOS standalone support and MIT licensing; it is therefore a credible future backend for linear subproblems. [HiGHS](https://highs.dev/). SCIP is another future option for constraint-integer/mixed-integer workflows; it is not required for the first 4.1 implementation.

## 13. Solver acceptance criteria

1. 100% of known-feasible fixture cases return `FEASIBLE` or `OPTIMAL` within a bounded test budget.
2. Known-infeasible cases return `INFEASIBLE` on the reference fixtures.
3. Timeout cases preserve the best feasible solution found and return an explicit non-optimal state.
4. Locked activities never move unless a repair request explicitly releases them.
5. Objective values are recomputable from the returned schedule.
6. Three generated variants are measurably different on diversity fixtures.
7. Heuristic fallback is explicitly labeled.
8. Solver process cancellation is reliable and leaves no orphan child process.

## P0.1 implementation update — 2026-09-23

The first implementation sprint uses `or-tools-wasm` 0.9.1 as the CP-SAT runtime. The package vendors upstream Google OR-Tools into WebAssembly and exposes CP-SAT to Node/TypeScript; it is licensed Apache-2.0. It is a third-party distribution layer, so it remains a dependency-governance and packaging certification item for later release work.

The production boundary is:

```text
SolverAdapter
  ├── legacy synchronous HeuristicSolverAdapter
  └── asynchronous CpSatSolverAdapter
         └── worker_threads
               └── or-tools-wasm/cp-sat
```

No CP-SAT package is imported by the renderer. The worker dynamically loads the solver package only inside the isolated worker process.

The CP-SAT model currently uses the 4.0 lesson object and discrete candidate placements. Hard constraints are converted into candidate elimination and at-most-one resource/time constraints. Locked lessons are reduced to their exact placement. Initial objective terms cover late lessons and teacher preferred days. More expressive interaction terms remain deferred until Constraint Studio and the rich Activity/Resource model.

Integration execution is currently BLOCKED in the Linux development container because the new npm dependency is not installed. Existing 4.0 regression tests remain PASS.
