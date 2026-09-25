'use strict';

const { performance } = require('perf_hooks');
const { SolverAdapter } = require('./solver-adapter');
const Engine = require('./scheduling-engine');
const { largeDb } = require('./solver_foundation_fixtures');

async function main() {
  try {
    await import('or-tools-wasm/cp-sat');
  } catch (error) {
    console.error(`BENCHMARK BLOCKED — ${error.message}`);
    process.exitCode = 2;
    return;
  }
  const adapter = new SolverAdapter();
  const sizes = [10, 30, 50, 100, 200];
  const rows = [];
  for (const size of sizes) {
    const db = largeDb(size);
    const t0 = performance.now();
    const heuristic = Engine.generateVariant({ ...db, activeBranchId: 1 }, 'balanced', 1);
    const heuristicMs = performance.now() - t0;
    const c0 = performance.now();
    const cp = (await adapter.solveAsync(db, { timeLimitSeconds: 30, seed: 1, numSearchWorkers: 1 }))[0];
    const cpMs = performance.now() - c0;
    rows.push({
      lessons: size,
      heuristicMs: Math.round(heuristicMs),
      heuristicStatus: heuristic.metrics.hardConflicts === 0 ? 'FEASIBLE' : 'VIOLATION',
      heuristicHardViolations: heuristic.metrics.hardConflicts,
      heuristicSoftPenalty: heuristic.metrics.softPenalty,
      cpSatMs: Math.round(cpMs),
      cpSatStatus: cp.status,
      cpSatHardViolations: cp.hardViolations,
      cpSatSoftPenalty: cp.softPenalty,
      cpSatObjective: cp.objective,
      cpSatTimedOut: cp.timedOut,
      cpSatMemoryRssMb: cp.memoryRssMb,
    });
  }
  console.table(rows);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
