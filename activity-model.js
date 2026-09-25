(function(){
'use strict';

const ACTIVITY_TYPES = Object.freeze([
  'lesson', 'individual_lesson', 'group_lesson', 'rehearsal', 'performance',
  'masterclass', 'meeting', 'technical_setup', 'external_event'
]);
const RESOURCE_TYPES = Object.freeze([
  'teacher', 'artist', 'participant', 'group', 'room', 'stage', 'hall',
  'equipment', 'technical_resource', 'branch', 'building'
]);

function clone(v) { return JSON.parse(JSON.stringify(v)); }
function nextId(db) {
  const all = [];
  for (const key of ['activities', 'resources', 'lessons', 'teachers', 'rooms', 'people']) {
    for (const x of db?.[key] || []) all.push(Number(x?.id) || 0);
  }
  return Math.max(0, ...all) + 1;
}

function normalizeResource(resource = {}, id) {
  const type = RESOURCE_TYPES.includes(resource.type) ? resource.type : 'room';
  const branchIds = Array.isArray(resource.branchIds)
    ? [...new Set(resource.branchIds.map(Number).filter(Number.isFinite))]
    : (resource.branchId != null ? [Number(resource.branchId)] : []);
  return {
    id: Number(resource.id) || id || 0,
    type,
    name: String(resource.name || 'Ресурс'),
    branchId: branchIds[0] ?? Number(resource.branchId) ?? null,
    branchIds,
    shared: Boolean(resource.shared || branchIds.length > 1),
    capacity: resource.capacity == null || resource.capacity === '' ? null : Number(resource.capacity),
    subtype: String(resource.subtype || resource.resourceType || ''),
    availability: Array.isArray(resource.availability) ? clone(resource.availability) : [],
    preferredSlots: Array.isArray(resource.preferredSlots) ? clone(resource.preferredSlots) : [],
    forbiddenSlots: Array.isArray(resource.forbiddenSlots) ? clone(resource.forbiddenSlots) : [],
    travelMinutes: Math.max(0, Number(resource.travelMinutes) || 0),
    metadata: resource.metadata && typeof resource.metadata === 'object' ? clone(resource.metadata) : {},
  };
}

function lessonToActivity(lesson, id) {
  const type = ACTIVITY_TYPES.includes(lesson.activityType) ? lesson.activityType : 'lesson';
  const activeMinutes = Math.max(1, Number(lesson.activeMinutes ?? lesson.duration ?? 60) || 60);
  return {
    id: Number(lesson.activityId || id || lesson.id || 0),
    legacyLessonId: Number(lesson.id) || null,
    type,
    title: String(lesson.title || lesson.subject || 'Занятие'),
    branchId: lesson.branchId == null ? null : Number(lesson.branchId),
    branchIds: Array.isArray(lesson.branchIds) ? lesson.branchIds.map(Number).filter(Number.isFinite) : (lesson.branchId == null ? [] : [Number(lesson.branchId)]),
    public: lesson.public !== false,
    recurrence: lesson.recurrence || null,
    exceptions: Array.isArray(lesson.exceptions) ? clone(lesson.exceptions) : [],
    locked: Boolean(lesson.locked),
    schedule: {
      day: lesson.day || '',
      time: lesson.time || '',
      date: lesson.date || '',
      setupMinutes: Math.max(0, Number(lesson.setupMinutes) || 0),
      activeMinutes,
      teardownMinutes: Math.max(0, Number(lesson.teardownMinutes) || 0),
      callMinutes: Math.max(0, Number(lesson.callMinutes) || 0),
      travelMinutes: Math.max(0, Number(lesson.travelMinutes) || 0),
    },
    resourceRefs: {
      teacherIds: lesson.teacherId != null ? [Number(lesson.teacherId)] : [],
      artistIds: Array.isArray(lesson.artistIds) ? lesson.artistIds.map(Number).filter(Number.isFinite) : [],
      participantIds: Array.isArray(lesson.participantIds) ? lesson.participantIds.map(Number).filter(Number.isFinite) : [],
      groupIds: lesson.groupId != null ? [Number(lesson.groupId)] : [],
      roomIds: lesson.roomId != null ? [Number(lesson.roomId)] : [],
      stageIds: Array.isArray(lesson.stageIds) ? lesson.stageIds.map(Number).filter(Number.isFinite) : [],
      hallIds: Array.isArray(lesson.hallIds) ? lesson.hallIds.map(Number).filter(Number.isFinite) : [],
      equipmentIds: Array.isArray(lesson.equipmentIds) ? lesson.equipmentIds.map(Number).filter(Number.isFinite) : [],
      technicalResourceIds: Array.isArray(lesson.technicalResourceIds) ? lesson.technicalResourceIds.map(Number).filter(Number.isFinite) : [],
      branchIds: Array.isArray(lesson.branchIds) ? lesson.branchIds.map(Number).filter(Number.isFinite) : (lesson.branchId == null ? [] : [Number(lesson.branchId)]),
    },
    constraints: Array.isArray(lesson.constraintIds) ? clone(lesson.constraintIds) : [],
    notes: String(lesson.notes || ''),
    metadata: lesson.metadata && typeof lesson.metadata === 'object' ? clone(lesson.metadata) : {},
  };
}

function activityToLegacyLesson(activity) {
  const s = activity.schedule || {};
  const refs = activity.resourceRefs || {};
  return {
    id: Number(activity.legacyLessonId || activity.id),
    activityId: Number(activity.id),
    activityType: activity.type,
    title: activity.title,
    branchId: activity.branchId,
    branchIds: Array.isArray(activity.branchIds) ? clone(activity.branchIds) : [],
    day: s.day || '',
    time: s.time || '',
    date: s.date || '',
    duration: Number(s.activeMinutes) || 60,
    activeMinutes: Number(s.activeMinutes) || 60,
    setupMinutes: Number(s.setupMinutes) || 0,
    teardownMinutes: Number(s.teardownMinutes) || 0,
    callMinutes: Number(s.callMinutes) || 0,
    travelMinutes: Number(s.travelMinutes) || 0,
    teacherId: refs.teacherIds?.[0] ?? null,
    groupId: refs.groupIds?.[0] ?? null,
    roomId: refs.roomIds?.[0] ?? null,
    artistIds: clone(refs.artistIds || []),
    participantIds: clone(refs.participantIds || []),
    stageIds: clone(refs.stageIds || []),
    hallIds: clone(refs.hallIds || []),
    equipmentIds: clone(refs.equipmentIds || []),
    technicalResourceIds: clone(refs.technicalResourceIds || []),
    branchIds: clone(refs.branchIds || []),
    locked: Boolean(activity.locked),
    public: activity.public !== false,
    recurrence: activity.recurrence || null,
    exceptions: clone(activity.exceptions || []),
    constraintIds: clone(activity.constraints || []),
    notes: activity.notes || '',
    metadata: clone(activity.metadata || {}),
  };
}

function ensureModel(db = {}) {
  const out = db;
  if (!Array.isArray(out.activities)) out.activities = [];
  if (!Array.isArray(out.resources)) out.resources = [];
  if (!Array.isArray(out.constraints)) out.constraints = [];
  if (!Array.isArray(out.activityTypes)) out.activityTypes = clone(ACTIVITY_TYPES);
  const activityByLesson = new Map(out.activities.filter(Boolean).map(a => [Number(a.legacyLessonId), a]));
  let id = nextId(out);
  for (const lesson of out.lessons || []) {
    if (!lesson || !Number(lesson.id)) continue;
    let activity = out.activities.find(a => Number(a.legacyLessonId || a.id) === Number(lesson.id));
    if (!activity) {
      activity = lessonToActivity(lesson, id++);
      out.activities.push(activity);
    } else {
      activityByLesson.set(Number(lesson.id), activity);
    }
    lesson.activityId = Number(activity.id);
    lesson.activityType = activity.type;
  }
  const resourceIdSet = new Set(out.resources.map(r => Number(r.id)));
  for (const t of out.teachers || []) {
    if (!Number(t.id) || resourceIdSet.has(Number(t.id))) continue;
    // Do not coerce legacy entity IDs into a shared resource ID namespace by default.
    // Resource references use explicit metadata links instead.
    if (!t.resourceType) t.resourceType = 'teacher';
  }
  return out;
}

function addActivity(db, input = {}) {
  ensureModel(db);
  const id = Number(input.id) || nextId(db);
  const activity = lessonToActivity({
    ...input,
    id,
    activityId: id,
    duration: input.duration ?? input.activeMinutes ?? 60,
    activityType: input.type || input.activityType || 'lesson',
  }, id);
  activity.legacyLessonId = Number(input.legacyLessonId) || id;
  db.activities.push(activity);
  if (!db.lessons) db.lessons = [];
  if (!db.lessons.some(l => Number(l.id) === Number(activity.legacyLessonId))) {
    db.lessons.push(activityToLegacyLesson(activity));
  }
  return activity;
}

function updateActivity(db, id, patch = {}) {
  ensureModel(db);
  const activity = db.activities.find(a => Number(a.id) === Number(id));
  if (!activity) return null;
  const merged = lessonToActivity({
    ...activityToLegacyLesson(activity),
    ...patch,
    activityId: activity.id,
    id: activity.legacyLessonId || activity.id,
    activityType: patch.type || patch.activityType || activity.type,
    duration: patch.duration ?? patch.activeMinutes ?? activity.schedule?.activeMinutes,
    teacherId: patch.teacherId ?? activity.resourceRefs?.teacherIds?.[0],
    groupId: patch.groupId ?? activity.resourceRefs?.groupIds?.[0],
    roomId: patch.roomId ?? activity.resourceRefs?.roomIds?.[0],
  }, activity.id);
  const idx = db.activities.indexOf(activity);
  db.activities[idx] = merged;
  const lessonIdx = (db.lessons || []).findIndex(l => Number(l.id) === Number(merged.legacyLessonId));
  if (lessonIdx >= 0) db.lessons[lessonIdx] = activityToLegacyLesson(merged);
  else db.lessons.push(activityToLegacyLesson(merged));
  return merged;
}

function removeActivity(db, id) {
  ensureModel(db);
  const idx = db.activities.findIndex(a => Number(a.id) === Number(id));
  if (idx < 0) return false;
  const activity = db.activities[idx];
  db.activities.splice(idx, 1);
  const lessonIdx = (db.lessons || []).findIndex(l => Number(l.id) === Number(activity.legacyLessonId));
  if (lessonIdx >= 0) db.lessons.splice(lessonIdx, 1);
  return true;
}

function addResource(db, input = {}) {
  ensureModel(db);
  const resource = normalizeResource(input, nextId(db));
  db.resources.push(resource);
  return resource;
}

function resourceUsableInBranch(resource, branchId) {
  if (!resource) return false;
  if (resource.shared) return !resource.branchIds?.length || resource.branchIds.map(Number).includes(Number(branchId));
  return Number(resource.branchId) === Number(branchId);
}

function linkSharedResource(db, resourceId, branchId) {
  const resource = (db.resources || []).find(r => Number(r.id) === Number(resourceId));
  if (!resource) return null;
  resource.branchIds = [...new Set([...(resource.branchIds || []), Number(branchId)])];
  resource.shared = resource.branchIds.length > 1;
  resource.branchId = resource.branchIds[0] ?? resource.branchId ?? null;
  return resource;
}

function effectiveDuration(activity) {
  const s = activity?.schedule || {};
  const setup = Math.max(0, Number(s.setupMinutes) || 0);
  const active = Math.max(1, Number(s.activeMinutes) || 60);
  const teardown = Math.max(0, Number(s.teardownMinutes) || 0);
  return setup + active + teardown;
}
function scheduleStart(activity) {
  const s = activity?.schedule || {};
  const [h,m] = String(s.time || '00:00').split(':').map(Number);
  return (h || 0) * 60 + (m || 0) - Math.max(0, Number(s.callMinutes) || 0) - Math.max(0, Number(s.travelMinutes) || 0);
}

function profilePresets() {
  return {
    balanced: { label:'Balanced', priorities:{hard:100,teacher:25,group:25,room:20,gaps:20,movement:10,load:10} },
    teacher: { label:'Teacher Priority', priorities:{hard:100,teacher:60,group:20,room:15,gaps:30,movement:10,load:10} },
    group: { label:'Group Priority', priorities:{hard:100,teacher:20,group:60,room:15,gaps:30,movement:10,load:10} },
    room: { label:'Room Priority', priorities:{hard:100,teacher:20,group:20,room:70,gaps:20,movement:10,load:10} },
    minimalGaps: { label:'Minimal Gaps', priorities:{hard:100,teacher:20,group:20,room:15,gaps:80,movement:10,load:10} },
    minimalMovement: { label:'Minimal Movement', priorities:{hard:100,teacher:20,group:20,room:20,gaps:20,movement:80,load:10} },
    compactDay: { label:'Compact Day', priorities:{hard:100,teacher:25,group:25,room:15,gaps:50,movement:10,load:50} },
    fairLoad: { label:'Fair Load', priorities:{hard:100,teacher:25,group:25,room:15,gaps:20,movement:10,load:80} },
    branchUtilization: { label:'Branch Utilization', priorities:{hard:100,teacher:25,group:25,room:70,gaps:20,movement:30,load:20} },
    custom: { label:'Custom', priorities:{hard:100,teacher:25,group:25,room:20,gaps:20,movement:10,load:10} },
  };
}

const ActivityModel = {
  ACTIVITY_TYPES, RESOURCE_TYPES, profilePresets, normalizeResource,
  lessonToActivity, activityToLegacyLesson, ensureModel, addActivity,
  updateActivity, removeActivity, addResource, resourceUsableInBranch,
  linkSharedResource, effectiveDuration, scheduleStart,
};
if (typeof module !== 'undefined' && module.exports) module.exports = ActivityModel;
if (typeof window !== 'undefined') window.ActivityModel = ActivityModel;
})();
