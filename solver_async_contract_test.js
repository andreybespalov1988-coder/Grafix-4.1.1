'use strict';
const assert = require('assert');
const { SolverAdapter } = require('./solver-adapter');

(async () => {
  const fakeCpSat = {
    solve: async () => [{ status: 'OPTIMAL', lessons: [], hardViolations: 0 }],
  };
  const adapter = new SolverAdapter(undefined, fakeCpSat);
  const result = await adapter.solveAsync({}, {});
  assert.ok(Array.isArray(result), 'solveAsync must return the solver result array for the CP-SAT backend.');
  assert.strictEqual(result[0].status, 'OPTIMAL');
  console.log('Solver async contract: PASS');
})().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
