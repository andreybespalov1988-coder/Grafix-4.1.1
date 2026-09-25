'use strict';
const { assert, solve, expectSolverBackend } = require('./solver_foundation_common');
const { largeDb } = require('./solver_foundation_fixtures');
(async()=>{
  await expectSolverBackend();
  const controller = new AbortController();
  const pending = solve(largeDb(120), { timeLimitSeconds: 30, seed: 11, numSearchWorkers: 1, signal: controller.signal });
  setTimeout(() => controller.abort(), 10);
  const result = (await pending)[0];
  assert.strictEqual(result.status, 'TIME_LIMIT');
  assert.strictEqual(result.timedOut, true);
  console.log('Solver cancellation: PASS');
})().catch(e=>{if(e.code==='SOLVER_TEST_BLOCKED'){console.log(e.message);process.exitCode=2;}else{console.error(e);process.exitCode=1;}});
