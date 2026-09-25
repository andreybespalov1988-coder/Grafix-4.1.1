'use strict';

const { parentPort } = require('worker_threads');
const Engine = require('./scheduling-engine');
const { buildCandidateSpec, placementKey } = require('./solver-cp-sat-model');

let activeSolver = null;
let activeCpSat = null;
let cancelRequested = false;

const SOLVER_BACKEND = 'OR-Tools CP-SAT WASM (or-tools-wasm 0.9.1)';

function toNumber(value) {
  if (typeof value === 'bigint') return Number(value);
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function addLinearSum(vars) {
  if (!vars.length) return null;
  let expr = vars[0];
  for (let i = 1; i < vars.length; i += 1) expr = expr.plus(vars[i]);
  return expr;
}

async function requestCancel() {
  cancelRequested = true;
  const cpSat = activeCpSat?.CpSat;
  if (cpSat && typeof cpSat.cancelSolve === 'function') {
    try {
      await cpSat.cancelSolve();
    } catch (_) {
      // The solve result still determines the final application status.
    }
  }
}

async function loadCpSat() {
  try {
    return await import('or-tools-wasm/cp-sat');
  } catch (error) {
    const wrapped = new Error(`CP-SAT backend unavailable: ${error.message}`);
    wrapped.code = 'SOLVER_BACKEND_UNAVAILABLE';
    throw wrapped;
  }
}

function buildModel(cp, spec, blockedSelections = []) {
  const model = new cp.CpModel();
  const vars = spec.candidates.map((candidate, i) => model.newBoolVar(`candidate_${candidate.lessonId}_${i}`));
  const byLesson = new Map(spec.byLesson.map((entry) => [String(entry.lessonId), entry.indexes]));

  for (const lesson of spec.lessons) {
    const indexes = byLesson.get(String(lesson.id)) || [];
    if (!indexes.length) continue;
    model.addExactlyOne(indexes.map((i) => vars[i]));
  }

  for (const bucket of spec.resourceBuckets) {
    if (bucket.indexes.length > 1) model.addAtMostOne(bucket.indexes.map((i) => vars[i]));
  }

  // Exact no-good cuts make repeated solutions genuinely different.
  // or-tools-wasm 0.9.1 exposes addLinearConstraint(), not addLessOrEqual().
  for (const blocked of blockedSelections) {
    const selected = [];
    const blockedSet = new Set(blocked);
    for (let i = 0; i < spec.candidates.length; i += 1) {
      if (blockedSet.has(spec.candidates[i].key)) selected.push(vars[i]);
    }
    if (selected.length) {
      model.addLinearConstraint(addLinearSum(selected), 0, selected.length - 1);
    }
  }

  let objective = null;
  for (let i = 0; i < spec.candidates.length; i += 1) {
    const coefficient = -Number(spec.candidates[i].penalty || 0);
    if (!coefficient) continue;
    // or-tools-wasm 0.9.1 uses times()/plus(), not mul()/add().
    const term = vars[i].times(coefficient);
    objective = objective ? objective.plus(term) : term;
  }
  if (objective) model.maximize(objective);

  return { model, vars, hasObjective: Boolean(objective) };
}

function solverHasSolution(solver, vars) {
  if (!vars.length) return true;
  try {
    // value() accepts BoolVar/IntVar expressions and is safe for actual variables.
    solver.value(vars[0]);
    return true;
  } catch (_) {
    return false;
  }
}

function extractSolution(spec, solver, vars) {
  const byLesson = new Map();
  for (let i = 0; i < spec.candidates.length; i += 1) {
    const candidate = spec.candidates[i];
    const selected = toNumber(solver.value(vars[i])) !== 0;
    if (selected) byLesson.set(String(candidate.lessonId), candidate);
  }
  return spec.lessons.map((lesson) => {
    const candidate = byLesson.get(String(lesson.id));
    if (!candidate) return { ...lesson };
    return { ...lesson, day: candidate.day, time: candidate.time, roomId: candidate.roomId, room: candidate.room };
  });
}

async function solveOnce(payload) {
  const cancelledBeforeStart = cancelRequested;
  cancelRequested = false;
  const cp = await loadCpSat();
  activeCpSat = cp;
  const spec = buildCandidateSpec(payload.db, payload.options);

  if (cancelledBeforeStart || cancelRequested) {
    cancelRequested = true;
    activeCpSat = null;
    return {
      status: 'TIME_LIMIT',
      elapsedMs: 0,
      hardViolations: null,
      softPenalty: null,
      objective: null,
      bestKnown: null,
      solverBackend: SOLVER_BACKEND,
      seed: payload.options.seed,
      timedOut: true,
      lockedActivities: spec.locked.map((x) => x.id),
      lessons: spec.lessons,
      diagnostics: [{ code: 'cancelled', message: 'CP-SAT solve cancelled before search began.' }],
      modelStats: { lessons: spec.lessons.length, candidates: spec.candidates.length, resourceBuckets: spec.resourceBuckets.length },
    };
  }

  if (spec.diagnostics.length) {
    activeCpSat = null;
    return {
      status: 'INFEASIBLE',
      elapsedMs: 0,
      hardViolations: spec.diagnostics.length,
      softPenalty: null,
      objective: null,
      bestKnown: null,
      solverBackend: SOLVER_BACKEND,
      memoryRssMb: Math.round(process.memoryUsage().rss / 1024 / 1024 * 10) / 10,
      seed: payload.options.seed,
      timedOut: false,
      lockedActivities: spec.locked.map((x) => x.id),
      lessons: spec.lessons,
      diagnostics: spec.diagnostics,
      modelStats: { lessons: spec.lessons.length, candidates: spec.candidates.length, resourceBuckets: spec.resourceBuckets.length },
    };
  }

  const { model, vars, hasObjective } = buildModel(cp, spec, payload.options.blockedSelections || []);
  const solver = new cp.CpSolver();
  activeSolver = solver;
  const limit = Math.max(0.001, Number(payload.options.timeLimitSeconds || 10));
  const seed = Number(payload.options.seed || 1);
  solver.parameters.maxTimeInSeconds = limit;
  solver.parameters.numSearchWorkers = Math.max(1, Number(payload.options.numSearchWorkers || 1));
  solver.parameters.randomSeed = seed;

  let interrupted = false;
  const timer = setTimeout(() => {
    interrupted = true;
    void requestCancel();
  }, Math.max(1, Math.floor(limit * 1000)));

  const started = Date.now();
  let status;
  try {
    // The high-level 0.9.1 API accepts solver parameters as the second argument.
    // Cancellation is exposed through CpSat.cancelSolve(), not AbortSignal or stopSearch().
    status = await solver.solve(model);
  } finally {
    clearTimeout(timer);
    activeSolver = null;
    activeCpSat = null;
  }

  const elapsedMs = Date.now() - started;
  const statusName = typeof solver.statusName === 'function'
    ? String(solver.statusName(status)).toUpperCase()
    : 'UNKNOWN';
  const hasSolution = solverHasSolution(solver, vars);

  let appStatus = statusName;
  if ((interrupted || cancelRequested) && statusName !== 'OPTIMAL') {
    appStatus = 'TIME_LIMIT';
  }

  const solutionStatuses = new Set(['OPTIMAL', 'FEASIBLE', 'TIME_LIMIT']);
  const canReturnSolution = solutionStatuses.has(appStatus) && hasSolution;
  const lessons = canReturnSolution ? extractSolution(spec, solver, vars) : spec.lessons;
  const evaluation = canReturnSolution
    ? Engine.evaluate(payload.db, lessons, spec.rules)
    : { hardConflicts: null, softPenalty: null };

  let objective = null;
  if (hasObjective && canReturnSolution && typeof solver.objectiveValue === 'function') {
    objective = -toNumber(solver.objectiveValue());
  }

  return {
    status: appStatus,
    elapsedMs,
    hardViolations: canReturnSolution ? Number(evaluation.hardConflicts || 0) : null,
    softPenalty: canReturnSolution ? Number(evaluation.softPenalty || 0) : null,
    objective,
    bestKnown: canReturnSolution ? lessons : null,
    solverBackend: SOLVER_BACKEND,
    memoryRssMb: Math.round(process.memoryUsage().rss / 1024 / 1024 * 10) / 10,
    seed,
    timedOut: ((interrupted || cancelRequested) && statusName !== 'OPTIMAL') || appStatus === 'TIME_LIMIT',
    lockedActivities: spec.locked.map((x) => x.id),
    lessons,
    diagnostics: canReturnSolution ? [] : [{ code: 'no_solution', message: `CP-SAT returned ${appStatus} without a readable solution assignment.` }],
    modelStats: { lessons: spec.lessons.length, candidates: spec.candidates.length, resourceBuckets: spec.resourceBuckets.length },
  };
}

async function solveMany(payload) {
  const profiles = Array.isArray(payload.options.profiles) && payload.options.profiles.length
    ? payload.options.profiles
    : null;
  const count = Math.max(1, Math.min(20, Number(payload.options.solutionCount || (profiles ? profiles.length : 1))));
  const variants = [];
  const blocked = [];
  for (let i = 0; i < count; i += 1) {
    const profile = profiles ? profiles[i] : (payload.options.objectiveProfile || 'balanced');
    const seed = Number(payload.options.seed || 1) + i;
    const result = await solveOnce({
      db: payload.db,
      options: { ...payload.options, seed, objectiveProfile: profile, blockedSelections: profiles ? [] : blocked },
    });
    result.profile = profile;
    variants.push(result);
    if (cancelRequested) break;
    if (!(result.bestKnown && result.status !== 'INFEASIBLE')) break;
    if (!profiles) blocked.push(result.bestKnown.map((lesson) => placementKey(lesson.id, {
      day: lesson.day,
      time: lesson.time,
      roomId: lesson.roomId,
      room: lesson.room,
    })));
  }
  cancelRequested = false;
  return variants;
}

if (parentPort) {
  parentPort.on('message', async (message) => {
    if (message.type === 'cancel') {
      await requestCancel();
      return;
    }
    if (message.type !== 'solve') return;
    try {
      const results = await solveMany(message.payload);
      parentPort.postMessage({ id: message.id, ok: true, results });
    } catch (error) {
      parentPort.postMessage({ id: message.id, ok: false, error: { code: error.code || 'SOLVER_ERROR', message: error.message, stack: error.stack } });
    }
  });
}
