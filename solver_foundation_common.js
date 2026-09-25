'use strict';
const assert = require('assert');
const { SolverAdapter } = require('./solver-adapter');

function assignmentFingerprint(lessons) {
  return (lessons || [])
    .map((x) => `${x.id}|${x.day}|${x.time}|${x.roomId || x.room || ''}`)
    .sort()
    .join('||');
}

async function solve(db, options = {}) {
  const adapter = new SolverAdapter();
  try {
    return await adapter.solveAsync(db, options);
  } catch (error) {
    if (error.code === 'SOLVER_BACKEND_UNAVAILABLE') {
      const blocked = new Error('CP-SAT dependency unavailable; install branch dependencies before executing integration solver tests.');
      blocked.code = 'SOLVER_TEST_BLOCKED';
      blocked.cause = error;
      throw blocked;
    }
    throw error;
  }
}

async function expectSolverBackend() {
  try {
    await import('or-tools-wasm/cp-sat');
  } catch (error) {
    const blocked = new Error(`CP-SAT integration test blocked: ${error.message}`);
    blocked.code = 'SOLVER_TEST_BLOCKED';
    throw blocked;
  }
}

module.exports = { assert, assignmentFingerprint, solve, expectSolverBackend };
