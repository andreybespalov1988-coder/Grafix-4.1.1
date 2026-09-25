'use strict';

const ActivityModel = require('./activity-model');
const ConstraintStudio = require('./constraint-studio');
const Advisor = require('./schedule-advisor');
const Engine = require('./scheduling-engine');
const Substitution = require('./substitution-engine');

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function assertDb(db) {
  if (!db || typeof db !== 'object') throw new Error('Database is required.');
  ActivityModel.ensureModel(db);
  ConstraintStudio.ensure(db);
  if (!Array.isArray(db.substitutions)) db.substitutions = [];
  if (!Array.isArray(db.history)) db.history = [];
  return db;
}
function listScoped(db, key, branchId = null) {
  const items = Array.isArray(db[key]) ? db[key] : [];
  if (branchId == null) return clone(items);
  return clone(items.filter(x => Boolean(Number(x.branchId) === Number(branchId) || (x.shared && Array.isArray(x.branchIds) && x.branchIds.map(Number).includes(Number(branchId))) || (Array.isArray(x.branchIds) && x.branchIds.map(Number).includes(Number(branchId))))));
}
function collectionKey(type) {
  const map = { teacher:'teachers', group:'people', room:'rooms', branch:'branches', activity:'activities', resource:'resources', lesson:'lessons', constraint:'constraints' };
  if (!map[type]) throw new Error(`Unsupported entity type: ${type}`);
  return map[type];
}

function createDomainApi({ storageAdapter = null, solverAdapter = null } = {}) {
  function data(db) { return assertDb(db); }
  return {
    version: '4.1-domain-1',
    capabilities() {
      return {
        localStorage: Boolean(storageAdapter),
        optionalServerAdapter: true,
        solver: Boolean(solverAdapter),
        activityModel: true,
        constraints: true,
        advisor: true,
        substitutions: true,
      };
    },
    snapshot(db) { return clone(data(db)); },
    list(db, type, branchId = null) { return listScoped(data(db), collectionKey(type), branchId); },
    get(db, type, id) {
      const item = data(db)[collectionKey(type)].find(x => Number(x.id) === Number(id));
      return item ? clone(item) : null;
    },
    create(db, type, payload = {}) {
      const d = data(db);
      switch (type) {
        case 'activity': return clone(ActivityModel.addActivity(d, payload));
        case 'resource': return clone(ActivityModel.addResource(d, payload));
        case 'constraint': return clone(ConstraintStudio.create(d, payload));
        case 'lesson': d.lessons.push(clone(payload)); return clone(payload);
        default: {
          const key = collectionKey(type);
          const max = Math.max(0, ...d[key].map(x => Number(x.id) || 0));
          const item = {...clone(payload), id: Number(payload.id) || max + 1};
          d[key].push(item); return clone(item);
        }
      }
    },
    update(db, type, id, patch = {}) {
      const d = data(db);
      if (type === 'activity') return clone(ActivityModel.updateActivity(d, id, patch));
      if (type === 'constraint') return clone(ConstraintStudio.update(d, id, patch));
      const key = collectionKey(type); const index = d[key].findIndex(x => Number(x.id) === Number(id));
      if (index < 0) return null; d[key][index] = {...d[key][index], ...clone(patch), id:d[key][index].id}; return clone(d[key][index]);
    },
    remove(db, type, id) {
      const d = data(db);
      if (type === 'activity') return ActivityModel.removeActivity(d, id);
      if (type === 'constraint') return ConstraintStudio.remove(d, id);
      const key = collectionKey(type); const before = d[key].length; d[key] = d[key].filter(x => Number(x.id) !== Number(id)); return d[key].length !== before;
    },
    disableConstraint(db, id) { return clone(ConstraintStudio.disable(data(db), id)); },
    enableConstraint(db, id) { return clone(ConstraintStudio.enable(data(db), id)); },
    validate(db, options = {}) {
      const d = data(db); return Engine.evaluate(d, options.lessons || d.lessons || [], Engine.getRules(d));
    },
    generate(db, options = {}) {
      const d = data(db); return Engine.generateVariants(d, options.seed || 0, options.profiles || null);
    },
    async generateAsync(db, options = {}) {
      if (!solverAdapter || typeof solverAdapter.solveAsync !== 'function') return this.generate(db, options);
      return solverAdapter.solveAsync(data(db), options);
    },
    diagnose(db, options = {}) { return Advisor.analyze(data(db), options); },
    findSubstitutes(db, lessonId, options = {}) { return Substitution.findCandidates(data(db), lessonId, options); },
    createSubstitution(db, lessonId, teacherId, options = {}) {
      const d = data(db); const plan = Substitution.createPlan(d, lessonId, teacherId, options); Substitution.ensureSubstitutions(d).push(plan); return clone(plan);
    },
    approveSubstitution(db, planId, options = {}) { return clone(Substitution.approvePlan(data(db), planId, options)); },
    exportSnapshot(db) { return JSON.stringify(data(db), null, 2); },
    importSnapshot(db, json) {
      const parsed = typeof json === 'string' ? JSON.parse(json) : json;
      if (!parsed || !Array.isArray(parsed.branches) || !Array.isArray(parsed.lessons)) throw new Error('Invalid Grafix snapshot.');
      Object.keys(db).forEach(k => delete db[k]);
      Object.assign(db, clone(parsed));
      assertDb(db); return clone(db);
    }
  };
}

module.exports = { createDomainApi, collectionKey };
