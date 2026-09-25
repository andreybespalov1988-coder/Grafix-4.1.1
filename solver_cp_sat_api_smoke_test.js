'use strict';

const assert = require('assert');

(async () => {
  let cp;
  try {
    cp = await import('or-tools-wasm/cp-sat');
  } catch (error) {
    console.log(`CP-SAT integration test blocked: ${error.message}`);
    process.exitCode = 2;
    return;
  }
  assert.strictEqual(typeof cp.CpModel, 'function');
  assert.strictEqual(typeof cp.CpSolver, 'function');
  assert.strictEqual(typeof cp.CpSat, 'object');
  assert.strictEqual(typeof cp.CpSat.cancelSolve, 'function');

  const model = new cp.CpModel();
  const x = model.newIntVar(0, 10, 'x');
  const y = model.newIntVar(0, 10, 'y');

  assert.strictEqual(typeof x.times, 'function');
  assert.strictEqual(typeof x.plus, 'function');
  assert.strictEqual(typeof model.addLinearConstraint, 'function');
  assert.strictEqual(typeof model.addExactlyOne, 'function');
  assert.strictEqual(typeof model.addAtMostOne, 'function');
  assert.strictEqual(typeof model.maximize, 'function');

  model.addLinearConstraint(x.times(2).plus(y), 0, 10);
  model.maximize(x.times(10).plus(y.times(5)));

  const solver = new cp.CpSolver();
  solver.parameters.numSearchWorkers = 1;
  solver.parameters.maxTimeInSeconds = 5;

  const status = await solver.solve(model);
  const statusName = String(solver.statusName(status)).toUpperCase();
  assert.ok(['OPTIMAL', 'FEASIBLE'].includes(statusName), `Unexpected smoke status: ${statusName}`);

  const xv = Number(solver.value(x));
  const yv = Number(solver.value(y));
  const objective = Number(solver.objectiveValue());

  assert.ok(Number.isFinite(xv));
  assert.ok(Number.isFinite(yv));
  assert.ok(Number.isFinite(objective));
  assert.ok((2 * xv + yv) <= 10);
  assert.strictEqual(objective, 10 * xv + 5 * yv);

  const boolVar = model.newBoolVar('b');
  assert.strictEqual(typeof boolVar.not, 'function');
  const boolModel = new cp.CpModel();
  const b = boolModel.newBoolVar('b');
  boolModel.addExactlyOne([b]);
  const boolSolver = new cp.CpSolver();
  boolSolver.parameters.numSearchWorkers = 1;
  const boolStatus = await boolSolver.solve(boolModel);
  const boolStatusName = String(boolSolver.statusName(boolStatus)).toUpperCase();
  assert.ok(['OPTIMAL', 'FEASIBLE'].includes(boolStatusName));
  assert.strictEqual(Number(boolSolver.value(b)), 1);

  console.log(`CP-SAT API smoke: PASS (${statusName})`);
  console.log(JSON.stringify({ x: xv, y: yv, objective, bool: Number(boolSolver.value(b)) }));
})().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
