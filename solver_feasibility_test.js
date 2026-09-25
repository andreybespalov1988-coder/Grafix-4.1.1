'use strict';
const { assert, solve, expectSolverBackend } = require('./solver_foundation_common');
const { feasibleDb } = require('./solver_foundation_fixtures');
(async()=>{
  await expectSolverBackend();
  const result=(await solve(feasibleDb(),{timeLimitSeconds:5,seed:7,numSearchWorkers:1}))[0];
  assert(['OPTIMAL','FEASIBLE'].includes(result.status),`Unexpected status ${result.status}`);
  assert.strictEqual(result.hardViolations,0);
  assert.ok(result.lessons.every(x=>x.day&&x.time));
  console.log('Solver feasibility: PASS');
})().catch(e=>{if(e.code==='SOLVER_TEST_BLOCKED'){console.log(e.message);process.exitCode=2;}else{console.error(e);process.exitCode=1;}});
