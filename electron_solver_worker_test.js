'use strict';

const assert = require('assert');
const crypto = require('crypto');
const { app, BrowserWindow } = require('electron');
const { feasibleDb, infeasibleDb, lockedDb, largeDb } = require('./solver_foundation_fixtures');
require('./main.js');

function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function waitForWindow() {
  for (let i = 0; i < 100; i += 1) {
    const win = BrowserWindow.getAllWindows()[0];
    if (win && !win.isDestroyed()) {
      if (win.webContents.isLoading()) await new Promise((resolve) => win.webContents.once('did-finish-load', resolve));
      return win;
    }
    await wait(50);
  }
  throw new Error('Solver Electron test: main window did not become available.');
}

async function call(win, expression) {
  return win.webContents.executeJavaScript(expression, true);
}

async function apiCall(win, method, payload) {
  return call(win, `window.dteDesktop.${method}(${JSON.stringify(payload)})`);
}

(async () => {
  await app.whenReady();
  const win = await waitForWindow();
  const apiCheck = await call(win, `({\n    validate: typeof window.dteDesktop?.solverValidate === 'function',\n    solve: typeof window.dteDesktop?.solverSolve === 'function',\n    alternatives: typeof window.dteDesktop?.solverAlternatives === 'function',\n    diagnose: typeof window.dteDesktop?.solverDiagnose === 'function',\n    cancel: typeof window.dteDesktop?.solverCancel === 'function'\n  })`);
  assert.deepStrictEqual(apiCheck, { validate: true, solve: true, alternatives: true, diagnose: true, cancel: true });

  const feasible = feasibleDb();
  const feasibleResult = await apiCall(win, 'solverSolve', { db: feasible, options: { timeLimitSeconds: 5, seed: 7, numSearchWorkers: 1, requestId: crypto.randomUUID() } });
  assert.ok(Array.isArray(feasibleResult));
  assert.ok(['OPTIMAL', 'FEASIBLE', 'TIME_LIMIT'].includes(feasibleResult[0].status));
  assert.strictEqual(feasibleResult[0].hardViolations, 0);
  assert.strictEqual(feasibleResult[0].solverBackend, 'OR-Tools CP-SAT WASM (or-tools-wasm 0.9.1)');

  const infeasible = infeasibleDb();
  const infeasibleResult = await apiCall(win, 'solverSolve', { db: infeasible, options: { timeLimitSeconds: 5, seed: 7, numSearchWorkers: 1, requestId: crypto.randomUUID() } });
  assert.strictEqual(infeasibleResult[0].status, 'INFEASIBLE');

  const locked = lockedDb();
  const lockedResult = await apiCall(win, 'solverSolve', { db: locked, options: { timeLimitSeconds: 5, seed: 3, numSearchWorkers: 1, requestId: crypto.randomUUID() } });
  const lockedLesson = lockedResult[0].lessons.find((lesson) => lesson.id === 1);
  assert.deepStrictEqual({ day: lockedLesson.day, time: lockedLesson.time, roomId: lockedLesson.roomId }, { day: 'Понедельник', time: '09:00', roomId: 201 });

  const alternatives = await apiCall(win, 'solverAlternatives', { db: feasible, options: { timeLimitSeconds: 5, seed: 1, numSearchWorkers: 1, solutionCount: 3, requestId: crypto.randomUUID() } });
  assert.ok(alternatives.length >= 2, 'Expected at least two alternatives.');
  const fingerprints = new Set(alternatives.map((result) => (result.lessons || []).map((x) => `${x.id}|${x.day}|${x.time}|${x.roomId || x.room || ''}`).sort().join('||')));
  assert.ok(fingerprints.size >= 2, 'Expected distinct alternatives.');

  const cancelRequestId = crypto.randomUUID();
  const longSolve = apiCall(win, 'solverSolve', { db: largeDb(120), options: { timeLimitSeconds: 30, seed: 11, numSearchWorkers: 1, requestId: cancelRequestId } });
  await wait(20);
  await call(win, `window.dteDesktop.solverCancel(${JSON.stringify(cancelRequestId)}); true`);
  const cancelled = await longSolve;
  assert.ok(cancelled[0].timedOut || cancelled[0].status === 'TIME_LIMIT' || cancelled[0].status === 'UNKNOWN');

  console.log('Electron Solver worker: PASS');
  await app.quit();
})().catch(async (error) => {
  console.error(error.stack || error.message || error);
  try { await app.quit(); } catch (_) {}
  process.exitCode = 1;
});
