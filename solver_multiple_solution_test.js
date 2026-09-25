'use strict';
const { assert, solve, assignmentFingerprint, expectSolverBackend } = require('./solver_foundation_common');
const { feasibleDb } = require('./solver_foundation_fixtures');
(async()=>{
  await expectSolverBackend();
  const adapterResult=await (new (require('./solver-adapter').SolverAdapter)()).generateAlternatives(feasibleDb(),{timeLimitSeconds:5,seed:1,numSearchWorkers:1,solutionCount:3});
  assert.ok(adapterResult.length>=2,'Expected at least two alternatives for a flexible fixture.');
  const fingerprints=new Set(adapterResult.map(r=>assignmentFingerprint(r.lessons)));
  assert.ok(fingerprints.size>=2,'Expected distinct assignment fingerprints.');
  console.log(`Solver multiple solutions: PASS (${fingerprints.size} distinct)`);
})().catch(e=>{if(e.code==='SOLVER_TEST_BLOCKED'){console.log(e.message);process.exitCode=2;}else{console.error(e);process.exitCode=1;}});
