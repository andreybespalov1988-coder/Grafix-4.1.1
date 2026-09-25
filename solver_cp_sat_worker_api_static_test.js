'use strict';
const assert = require('assert');
const fs = require('fs');
const raw = fs.readFileSync(require.resolve('./solver-cp-sat-worker.js'), 'utf8');
const source = raw
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|\s)\/\/.*$/gm, '$1');

const forbidden = [
  { token: '.mul(', message: 'Use IntVar/LinearExpr.times().' },
  { token: '.add(', message: 'Use LinearExpr.plus().' },
  { token: 'addLessOrEqual(', message: 'Use CpModel.addLinearConstraint().' },
  { token: 'stopSearch(', message: 'Use CpSat.cancelSolve().' },
  { token: 'solver.solve(model, { signal:', message: 'Use solver.parameters + CpSat.cancelSolve().' },
  { token: 'solver.booleanValue(', message: 'Use solver.value() for BoolVar/IntVar expressions.' },
];
for (const item of forbidden) {
  assert.ok(!source.includes(item.token), `${item.message} Found forbidden token: ${item.token}`);
}
assert.ok(source.includes('.times('), 'Expected .times() in CP-SAT worker.');
assert.ok(source.includes('.plus('), 'Expected .plus() in CP-SAT worker.');
assert.ok(source.includes('addLinearConstraint('), 'Expected addLinearConstraint() in CP-SAT worker.');
assert.ok(source.includes('cancelSolve()'), 'Expected CpSat.cancelSolve() in CP-SAT worker.');
console.log('Solver CP-SAT worker API static audit: PASS');
