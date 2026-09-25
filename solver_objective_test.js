'use strict';
const { assert, solve, expectSolverBackend } = require('./solver_foundation_common');
const { objectiveDb } = require('./solver_foundation_fixtures');
(async()=>{
  await expectSolverBackend();
  const db=objectiveDb();
  const result=(await solve(db,{timeLimitSeconds:5,seed:5,numSearchWorkers:1}))[0];
  assert(['OPTIMAL','FEASIBLE'].includes(result.status));
  const lesson=result.lessons.find(x=>x.id===1);
  const teacher=db.teachers.find(t=>t.id===1);
  assert.ok(teacher.preferredDays.includes(lesson.day),'Preferred day should be selected by objective in the single-lesson case.');
  assert.strictEqual(result.solverBackend.startsWith('OR-Tools CP-SAT'),true);
  assert.ok(result.objective!==null);
  console.log('Solver objective: PASS');
})().catch(e=>{if(e.code==='SOLVER_TEST_BLOCKED'){console.log(e.message);process.exitCode=2;}else{console.error(e);process.exitCode=1;}});
