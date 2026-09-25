'use strict';
const { assert, solve, expectSolverBackend } = require('./solver_foundation_common');
const { largeDb } = require('./solver_foundation_fixtures');
(async()=>{
  await expectSolverBackend();
  const result=(await solve(largeDb(120),{timeLimitSeconds:0.001,seed:9,numSearchWorkers:1}))[0];
  assert(['TIME_LIMIT','FEASIBLE','UNKNOWN','OPTIMAL'].includes(result.status));
  assert.ok(result.elapsedMs>=0);
  assert.ok(result.timedOut === true || result.status === 'TIME_LIMIT' || result.status === 'UNKNOWN', `Expected timeout signal, got ${result.status}`);
  console.log(`Solver timeout: PASS (${result.status})`);
})().catch(e=>{if(e.code==='SOLVER_TEST_BLOCKED'){console.log(e.message);process.exitCode=2;}else{console.error(e);process.exitCode=1;}});
