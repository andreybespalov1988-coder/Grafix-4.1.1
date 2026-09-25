'use strict';
const { spawnSync } = require('child_process');
const tests = [
  'solver_cp_sat_worker_api_static_test.js',
  'solver_async_contract_test.js',
  'solver_cp_sat_api_smoke_test.js',
  'solver_feasibility_test.js',
  'solver_infeasible_test.js',
  'solver_timeout_test.js',
  'solver_cancellation_test.js',
  'solver_locked_test.js',
  'solver_determinism_test.js',
  'solver_objective_test.js',
  'solver_multiple_solution_test.js',
  'solver_regression_test.js',
];
let blocked=0, failed=0;
for(const file of tests){
  const r=spawnSync(process.execPath,[file],{encoding:'utf8'});
  process.stdout.write(`\n--- ${file} ---\n${r.stdout||''}${r.stderr||''}`);
  if(r.status===2) blocked+=1;
  else if(r.status!==0) failed+=1;
}
if(failed){console.error(`Solver foundation: FAIL (${failed} test files failed)`);process.exitCode=1;}
else if(blocked){console.log(`Solver foundation: BLOCKED (${blocked} CP-SAT integration test files blocked by dependency/runtime availability)`);process.exitCode=2;}
else console.log('Solver foundation: PASS');
