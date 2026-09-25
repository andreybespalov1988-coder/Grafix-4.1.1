'use strict';

const path = require('path');
const { randomUUID } = require('crypto');
const { Worker } = require('worker_threads');
const { buildCandidateSpec } = require('./solver-cp-sat-model');

class CpSatSolverAdapter {
  constructor(options = {}) {
    this.name = 'OR-Tools CP-SAT WASM';
    this.workerScript = options.workerScript || path.join(__dirname, 'solver-cp-sat-worker.js');
    this.active = new Map();
  }

  validate(db, options = {}) {
    const spec = buildCandidateSpec(db, options);
    return {
      valid: spec.diagnostics.length === 0,
      diagnostics: spec.diagnostics,
      modelStats: {
        lessons: spec.lessons.length,
        candidates: spec.candidates.length,
        resourceBuckets: spec.resourceBuckets.length,
      },
    };
  }

  solve(db, options = {}) {
    return this._run(db, { ...options, solutionCount: 1 });
  }

  generateAlternatives(db, options = {}) {
    const profiles = Array.isArray(options.profiles) && options.profiles.length ? options.profiles : null;
    const solutionCount = profiles ? Math.max(1, Math.min(20, profiles.length)) : Math.max(1, Math.min(20, Number(options.solutionCount || 3)));
    return this._run(db, { ...options, solutionCount, profiles });
  }

  async diagnose(db, options = {}) {
    const Advisor = require('./schedule-advisor');
    const advisor = Advisor.analyze(db, { organizationWide: Boolean(options.organizationWide) });
    const validation = this.validate(db, options);
    return {
      supported: true,
      status: advisor.status,
      diagnostics: validation.diagnostics,
      advisor,
      message: advisor.summary,
    };
  }

  cancel(requestId) {
    const entry = this.active.get(requestId);
    if (entry) entry.worker.postMessage({ type: 'cancel' });
  }

  _run(db, options) {
    const requestId = options.requestId || randomUUID();
    const worker = new Worker(this.workerScript);
    const { signal, ...solverOptions } = options || {};
    let onAbort = null;
    this.active.set(requestId, { worker });

    return new Promise((resolve, reject) => {
      const cleanup = () => {
        this.active.delete(requestId);
        if (signal && onAbort) signal.removeEventListener('abort', onAbort);
        worker.removeAllListeners();
        if (!worker.threadId) return;
        worker.terminate().catch(() => {});
      };
      worker.once('message', (message) => {
        cleanup();
        if (!message.ok) {
          const error = new Error(message.error?.message || 'Solver error');
          error.code = message.error?.code || 'SOLVER_ERROR';
          error.stack = message.error?.stack || error.stack;
          reject(error);
          return;
        }
        resolve(message.results);
      });
      worker.once('error', (error) => {
        cleanup();
        reject(error);
      });
      worker.once('exit', (code) => {
        if (code !== 0 && this.active.has(requestId)) {
          this.active.delete(requestId);
          reject(new Error(`Solver worker exited with code ${code}`));
        }
      });
      onAbort = () => worker.postMessage({ type: 'cancel' });
      if (signal) {
        if (signal.aborted) onAbort();
        else signal.addEventListener('abort', onAbort, { once: true });
      }
      worker.postMessage({ id: requestId, type: 'solve', payload: { db, options: { ...solverOptions, requestId } } });
    });
  }
}

module.exports = { CpSatSolverAdapter };
