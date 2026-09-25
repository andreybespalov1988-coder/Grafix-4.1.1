'use strict';
const { assert, solve, expectSolverBackend } = require('./solver_foundation_common');
const { infeasibleDb } = require('./solver_foundation_fixtures');
(async()=>{
  await expectSolverBackend();
  const result=(await solve(infeasibleDb(),{timeLimitSeconds:5,seed:7,numSearchWorkers:1}))[0];
  assert.strictEqual(result.status,'INFEASIBLE');
  console.log('Solver infeasible: PASS');
})().catch(e=>{if(e.code==='SOLVER_TEST_BLOCKED'){console.log(e.message);process.exitCode=2;}else{console.error(e);process.exitCode=1;}});
