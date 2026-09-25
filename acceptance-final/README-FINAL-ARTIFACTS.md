# GRAFIX 4.1 P0.1 — Final Artifact Set

The source contains the corrected Solver Foundation implementation and two verification tests.

The `acceptance-final` folder contains a Windows runner that performs the real dependency installation, CP-SAT smoke test, solver foundation suite, full regression, benchmark, Electron solver worker test and `dist:win` packaging from the source root.

The product architecture remains worker-isolated: Renderer -> Preload -> IPC -> Main -> SolverAdapter -> worker_threads -> or-tools-wasm.

P0.2 Constraint Studio is intentionally excluded.
