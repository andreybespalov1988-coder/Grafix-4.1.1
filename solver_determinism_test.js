'use strict';
const { assert, solve, assignmentFingerprint, expectSolverBackend } = require('./solver_foundation_common');
const { feasibleDb } = require('./solver_foundation_fixtures');
(async()=>{
  await expectSolverBackend();
  const options={timeLimitSeconds:5,seed:42,numSearchWorkers:1};
  const a=(await solve(feasibleDb(),options))[0];
  const b=(await solve(feasibleDb(),options))[0];
  assert.deepStrictEqual(a.status,b.status);
  assert.strictEqual(assignmentFingerprint(a.lessons),assignmentFingerprint(b.lessons));
  console.log('Solver determinism: PASS');
})().catch(e=>{if(e.code==='SOLVER_TEST_BLOCKED'){console.log(e.message);process.exitCode=2;}else{console.error(e);process.exitCode=1;}});
