'use strict';
const { assert, solve, expectSolverBackend } = require('./solver_foundation_common');
const { lockedDb } = require('./solver_foundation_fixtures');
(async()=>{
  await expectSolverBackend();
  const db=lockedDb();
  const result=(await solve(db,{timeLimitSeconds:5,seed:3,numSearchWorkers:1}))[0];
  assert(['OPTIMAL','FEASIBLE'].includes(result.status));
  const locked=result.lessons.find(x=>x.id===1);
  assert.strictEqual(locked.day,'Понедельник');
  assert.strictEqual(locked.time,'09:00');
  assert.strictEqual(locked.roomId,201);
  console.log('Solver locked activity: PASS');
})().catch(e=>{if(e.code==='SOLVER_TEST_BLOCKED'){console.log(e.message);process.exitCode=2;}else{console.error(e);process.exitCode=1;}});
