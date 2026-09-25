(function(){
'use strict';

const CONSTRAINT_TARGETS = Object.freeze(['teacher','group','room','activity','resource','relationship','branch']);
const CONSTRAINT_KINDS = Object.freeze([
  'availability','working_hours','forbidden_period','preferred_period','max_lessons_day',
  'max_consecutive','gaps','day_restriction','capacity','type','preferred_room','alternative_room',
  'duration','allowed_days','allowed_times','preferred_days','preferred_times','recurrence','branch',
  'locked','before','after','same_day','different_day','consecutive','same_room','different_room',
  'same_teacher','different_teacher','setup_time','active_time','teardown_time','call_time','travel_time'
]);
const WEIGHTS = { critical: 100, high: 50, medium: 20, low: 8 };
function clone(v) { return JSON.parse(JSON.stringify(v)); }
function nextConstraintId(db) { return Math.max(0, ...(db.constraints || []).map(x => Number(x.id) || 0)) + 1; }
function normalizeConstraint(input = {}, id) {
  const target = CONSTRAINT_TARGETS.includes(input.target) ? input.target : 'activity';
  const kind = CONSTRAINT_KINDS.includes(input.kind) ? input.kind : 'forbidden_period';
  const hardness = String(input.hardness || input.mode || 'HARD').toUpperCase() === 'SOFT' ? 'SOFT' : 'HARD';
  const priority = WEIGHTS[input.priority] ? input.priority : 'medium';
  return {
    id: Number(input.id) || id || 0,
    name: String(input.name || `${target}:${kind}`),
    target,
    targetId: input.targetId == null || input.targetId === '' ? null : Number(input.targetId),
    targetIds: Array.isArray(input.targetIds) ? input.targetIds.map(Number).filter(Number.isFinite) : [],
    kind,
    hardness,
    enabled: input.enabled !== false,
    weight: Math.max(0, Number(input.weight) || WEIGHTS[priority]),
    priority,
    value: input.value && typeof input.value === 'object' ? clone(input.value) : input.value ?? null,
    source: String(input.source || 'Constraint Studio'),
    branchId: input.branchId == null || input.branchId === '' ? null : Number(input.branchId),
    notes: String(input.notes || ''),
    createdAt: input.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
function ensure(db) {
  if (!Array.isArray(db.constraints)) db.constraints = [];
  db.constraints = db.constraints.map((x, i) => normalizeConstraint(x, i + 1));
  return db.constraints;
}
function create(db, input) {
  ensure(db);
  const x = normalizeConstraint(input, nextConstraintId(db));
  db.constraints.push(x);
  return x;
}
function update(db, id, patch) {
  ensure(db);
  const i = db.constraints.findIndex(x => Number(x.id) === Number(id));
  if (i < 0) return null;
  db.constraints[i] = normalizeConstraint({...db.constraints[i], ...patch, id: db.constraints[i].id}, db.constraints[i].id);
  return db.constraints[i];
}
function disable(db, id) { return update(db, id, { enabled: false }); }
function enable(db, id) { return update(db, id, { enabled: true }); }
function remove(db, id) {
  ensure(db);
  const i = db.constraints.findIndex(x => Number(x.id) === Number(id));
  if (i < 0) return false;
  db.constraints.splice(i, 1);
  return true;
}
function list(db, filter = {}) {
  ensure(db);
  return db.constraints.filter(c =>
    (filter.target ? c.target === filter.target : true) &&
    (filter.targetId == null ? true : Number(c.targetId) === Number(filter.targetId)) &&
    (filter.hardness ? c.hardness === filter.hardness : true) &&
    (filter.enabled == null ? true : c.enabled === Boolean(filter.enabled))
  );
}
function activeFor(db, target, targetId, branchId) {
  return list(db).filter(c => c.enabled && c.target === target &&
    (c.targetId == null || Number(c.targetId) === Number(targetId)) &&
    (c.branchId == null || Number(c.branchId) === Number(branchId)));
}
function overlaps(day, time, duration, slot = {}) {
  const slotDay = slot.day || day;
  if (slotDay !== day) return false;
  const toMin = v => { const [h,m] = String(v||'00:00').split(':').map(Number); return h*60+m; };
  const a = toMin(time), b = a + Number(duration || 60);
  return a < toMin(slot.end || '23:59') && b > toMin(slot.start || '00:00');
}
function evaluateConstraint(db, constraint, activity, context = {}) {
  if (!constraint.enabled) return { violated:false, penalty:0, reason:'' };
  const s = activity || {};
  const day = s.day || s.schedule?.day || '';
  const time = s.time || s.schedule?.time || '';
  const duration = Number(s.duration || s.activeMinutes || s.schedule?.activeMinutes || 60);
  const v = constraint.value || {};
  const hard = constraint.hardness === 'HARD';
  let violated = false, reason = '';
  const maxDayMinutes = Number(v.maxMinutes ?? v.minutes ?? 0);
  switch (constraint.kind) {
    case 'availability': {
      const available = Array.isArray(v.slots) ? v.slots : [];
      if (available.length) violated = !available.some(x => overlaps(day,time,duration,x));
      reason = 'Занятие вне доступных интервалов'; break;
    }
    case 'working_hours': {
      const [sh,sm] = String(v.start||'09:00').split(':').map(Number);
      const [eh,em] = String(v.end||'21:00').split(':').map(Number);
      const t = Number(String(time).slice(0,2))*60+Number(String(time).slice(3,5));
      violated = !time || t < sh*60+sm || t + duration > eh*60+em;
      reason = 'Занятие вне рабочих часов'; break;
    }
    case 'forbidden_period': {
      const slots = Array.isArray(v.slots) ? v.slots : [v];
      violated = slots.some(x => overlaps(day,time,duration,{...x, day:x.day || day}));
      reason = 'Период запрещён'; break;
    }
    case 'preferred_period': {
      if (Array.isArray(v.slots) && v.slots.length) violated = !v.slots.some(x => overlaps(day,time,duration,{...x, day:x.day || day}));
      reason = 'Занятие не соответствует предпочтительному времени'; break;
    }
    case 'day_restriction':
    case 'allowed_days': {
      const days = Array.isArray(v.days) ? v.days : [];
      violated = Boolean(days.length && !days.includes(day));
      reason = 'День не входит в разрешённые'; break;
    }
    case 'preferred_days': {
      const days = Array.isArray(v.days) ? v.days : [];
      violated = Boolean(days.length && !days.includes(day));
      reason = 'День не является предпочтительным'; break;
    }
    case 'preferred_times':
    case 'allowed_times': {
      const slots = Array.isArray(v.slots) ? v.slots : [];
      if (slots.length) violated = !slots.some(x => overlaps(day,time,duration,{...x, day:x.day || day}));
      reason = constraint.kind === 'preferred_times' ? 'Время не является предпочтительным' : 'Время не входит в разрешённые интервалы'; break;
    }
    case 'recurrence': {
      const expected = v.recurrence ?? v.pattern ?? v.value;
      const actual = s.recurrence ?? s.schedule?.recurrence ?? null;
      violated = expected != null && JSON.stringify(actual) !== JSON.stringify(expected);
      reason = 'Повторяемость активности не соответствует правилу'; break;
    }
    case 'max_lessons_day': {
      const sameDay = (context.lessons || []).filter(x => (x.day || x.schedule?.day) === day);
      violated = sameDay.length > Number(v.count ?? v.max ?? 999999);
      reason = `Превышено число занятий за день: ${sameDay.length}`; break;
    }
    case 'max_consecutive': {
      const minutes = Number((v.minutes ?? v.maxMinutes ?? maxDayMinutes) || 0);
      if (minutes > 0) {
        const arr = (context.lessons || []).filter(x => (x.day || x.schedule?.day) === day).concat([s]).sort((a,b)=>String(a.time||a.schedule?.time).localeCompare(String(b.time||b.schedule?.time)));
        let run = 0;
        const toMin = x => { const [h,m] = String(x||'00:00').split(':').map(Number); return h*60+m; };
        for (let i=0;i<arr.length;i++) { run += Number(arr[i].duration || arr[i].activeMinutes || arr[i].schedule?.activeMinutes || 60); if (i<arr.length-1 && toMin(arr[i+1].time||arr[i+1].schedule?.time) > toMin(arr[i].time||arr[i].schedule?.time) + Number(arr[i].duration||arr[i].activeMinutes||arr[i].schedule?.activeMinutes||60)) run = 0; if (run>minutes) break; }
        violated = run > minutes;
      }
      reason = `Превышена непрерывная нагрузка: ${maxDayMinutes} мин.`; break;
    }
    case 'gaps': {
      const max = Number(v.max ?? v.maxMinutes ?? 999999);
      if (Array.isArray(context.lessons)) {
        const arr=context.lessons.filter(x => (x.day||x.schedule?.day)===day).sort((a,b)=>String(a.time||a.schedule?.time).localeCompare(String(b.time||b.schedule?.time)));
        for(let i=1;i<arr.length;i++) { const prev=arr[i-1], cur=arr[i]; const pm=Number(String(prev.time||prev.schedule?.time||'00:00').slice(0,2))*60+Number(String(prev.time||prev.schedule?.time||'00:00').slice(3,5))+Number(prev.duration||prev.activeMinutes||prev.schedule?.activeMinutes||60); const cm=Number(String(cur.time||cur.schedule?.time||'00:00').slice(0,2))*60+Number(String(cur.time||cur.schedule?.time||'00:00').slice(3,5)); if(cm-pm>max) {violated=true;break;} }
      }
      reason='Окно между занятиями превышает лимит'; break;
    }
    case 'capacity': {
      violated = Number(s.participantsCount || v.participants || 0) > Number(v.capacity || context.resource?.capacity || Infinity);
      reason='Недостаточная вместимость'; break;
    }
    case 'type': {
      violated = Boolean(v.type && String(context.resource?.type || '')!==String(v.type));
      reason='Тип ресурса не совпадает'; break;
    }
    case 'preferred_room': {
      violated = Boolean(v.roomId && Number(s.roomId)!==Number(v.roomId)); reason='Предпочтительный кабинет не выбран'; break;
    }
    case 'alternative_room': {
      const allowed = Array.isArray(v.roomIds) ? v.roomIds : []; violated = Boolean(allowed.length && !allowed.map(Number).includes(Number(s.roomId))); reason='Кабинет не входит в список альтернатив'; break;
    }
    case 'duration': {
      if (v.min != null) violated ||= duration < Number(v.min);
      if (v.max != null) violated ||= duration > Number(v.max);
      reason='Длительность не соответствует ограничению'; break;
    }
    case 'setup_time': {
      const value=Number(s.setupMinutes ?? s.schedule?.setupMinutes ?? 0); if (v.min != null) violated ||= value < Number(v.min); if (v.max != null) violated ||= value > Number(v.max); reason='Время подготовки не соответствует ограничению'; break;
    }
    case 'active_time': {
      const value=Number(s.activeMinutes ?? s.schedule?.activeMinutes ?? duration); if (v.min != null) violated ||= value < Number(v.min); if (v.max != null) violated ||= value > Number(v.max); reason='Активное время не соответствует ограничению'; break;
    }
    case 'teardown_time': {
      const value=Number(s.teardownMinutes ?? s.schedule?.teardownMinutes ?? 0); if (v.min != null) violated ||= value < Number(v.min); if (v.max != null) violated ||= value > Number(v.max); reason='Время разборки не соответствует ограничению'; break;
    }
    case 'call_time': {
      const value=Number(s.callMinutes ?? s.schedule?.callMinutes ?? 0); if (v.min != null) violated ||= value < Number(v.min); if (v.max != null) violated ||= value > Number(v.max); reason='Call time не соответствует ограничению'; break;
    }
    case 'travel_time': {
      const value=Number(s.travelMinutes ?? s.schedule?.travelMinutes ?? 0); if (v.min != null) violated ||= value < Number(v.min); if (v.max != null) violated ||= value > Number(v.max); reason='Время переезда не соответствует ограничению'; break;
    }
    case 'locked': {
      violated = v.value === true ? s.locked !== true : false; reason='Занятие должно быть закреплено'; break;
    }
    case 'branch': {
      const allowed = Array.isArray(v.branchIds) ? v.branchIds : [v.branchId].filter(Boolean); violated = Boolean(allowed.length && !allowed.map(Number).includes(Number(s.branchId))); reason='Филиал не разрешён'; break;
    }
    default:
      break;
  }
  const penalty = violated ? (hard ? Number.POSITIVE_INFINITY : Math.max(0, Number(constraint.weight)||20)) : 0;
  return { violated, penalty, reason: violated ? reason : '' };
}
function resolveActivity(db, id) {
  const n = Number(id);
  if (!Number.isFinite(n)) return null;
  return (db.activities || []).find(x => Number(x.id) === n) ||
    (db.lessons || []).find(x => Number(x.id) === n || Number(x.activityId) === n) || null;
}

function relationResult(db, constraint, activity) {
  const otherId = constraint.value?.otherId ?? constraint.value?.relatedId ?? constraint.targetIds?.find(id => Number(id) !== Number(activity.id));
  const other = resolveActivity(db, otherId);
  if (!other) return { violated: true, penalty: constraint.hardness === 'HARD' ? Infinity : Number(constraint.weight || 20), reason: 'Связанное занятие не найдено' };
  const a = activity.schedule ? {...activity, day: activity.schedule.day, time: activity.schedule.time, duration: activity.schedule.activeMinutes} : activity;
  const b = other.schedule ? {...other, day: other.schedule.day, time: other.schedule.time, duration: other.schedule.activeMinutes} : other;
  const aStart = minsValue(a.time), bStart = minsValue(b.time);
  const aEnd = aStart + Number(a.duration || 60), bEnd = bStart + Number(b.duration || 60);
  let violated = false;
  switch (constraint.kind) {
    case 'before': violated = a.day === b.day ? aStart >= bStart : dayIndex(a.day) >= dayIndex(b.day); break;
    case 'after': violated = a.day === b.day ? aStart <= bStart : dayIndex(a.day) <= dayIndex(b.day); break;
    case 'same_day': violated = a.day !== b.day; break;
    case 'different_day': violated = a.day === b.day; break;
    case 'consecutive': violated = !(a.day === b.day && (aEnd === bStart || bEnd === aStart)); break;
    case 'same_room': violated = String(a.roomId ?? a.room ?? '') !== String(b.roomId ?? b.room ?? ''); break;
    case 'different_room': violated = String(a.roomId ?? a.room ?? '') === String(b.roomId ?? b.room ?? ''); break;
    case 'same_teacher': violated = String(a.teacherId ?? a.teacher ?? '') !== String(b.teacherId ?? b.teacher ?? ''); break;
    case 'different_teacher': violated = String(a.teacherId ?? a.teacher ?? '') === String(b.teacherId ?? b.teacher ?? ''); break;
    default: return { violated:false, penalty:0, reason:'' };
  }
  return { violated, penalty: violated ? (constraint.hardness === 'HARD' ? Infinity : Number(constraint.weight || 20)) : 0, reason: violated ? `Нарушена связь «${constraint.kind}» с занятием #${other.id}` : '' };
}
function minsValue(value) { const [h,m] = String(value||'00:00').split(':').map(Number); return (h||0)*60+(m||0); }
function dayIndex(value) { return ['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье'].indexOf(value); }

function evaluateActivity(db, activity, context = {}) {
  const a = activity?.schedule ? {...activity, day: activity.schedule.day, time: activity.schedule.time, duration: activity.schedule.activeMinutes, roomId: activity.resourceRefs?.roomIds?.[0] ?? activity.roomId, teacherId: activity.resourceRefs?.teacherIds?.[0] ?? activity.teacherId, groupId: activity.resourceRefs?.groupIds?.[0] ?? activity.groupId, branchId: activity.branchId} : activity;
  const cs = list(db, { enabled:true }).filter(c => c.branchId == null || Number(c.branchId) === Number(a.branchId));
  const reasons=[]; let hard=0, soft=0;
  for (const c of cs) {
    let applies = false;
    if (c.target === 'activity') applies = c.targetId == null || [a.id, a.activityId, a.legacyLessonId].filter(x => x != null).map(Number).includes(Number(c.targetId));
    else if (c.target === 'teacher') applies = c.targetId == null ? a.teacherId != null : Number(c.targetId) === Number(a.teacherId);
    else if (c.target === 'group') applies = c.targetId == null ? a.groupId != null : Number(c.targetId) === Number(a.groupId);
    else if (c.target === 'room') applies = c.targetId == null ? a.roomId != null : Number(c.targetId) === Number(a.roomId);
    else if (c.target === 'branch') applies = c.targetId == null || Number(c.targetId) === Number(a.branchId);
    else if (c.target === 'resource') applies = !c.targetId || [a.teacherId,a.groupId,a.roomId,a.id,a.activityId].filter(x=>x!=null).map(Number).includes(Number(c.targetId));
    else if (c.target === 'relationship') applies = true;
    if (!applies) continue;
    const res = c.target === 'relationship' ? relationResult(db, c, a) : evaluateConstraint(db,c,a,{...context,resource:context.resource});
    if (res.violated) {
      if (c.hardness==='HARD') hard++; else soft += Number.isFinite(res.penalty) ? res.penalty : Number(c.weight || 20);
      reasons.push({constraint:c, ...res});
    }
  }
  return { hardViolations:hard, softPenalty:soft, reasons };
}

const ConstraintStudio={CONSTRAINT_TARGETS,CONSTRAINT_KINDS,WEIGHTS,normalizeConstraint,ensure,create,update,disable,enable,remove,list,activeFor,evaluateConstraint,evaluateActivity};
if (typeof module !== 'undefined' && module.exports) module.exports=ConstraintStudio;
if (typeof window !== 'undefined') window.ConstraintStudio=ConstraintStudio;
})();
