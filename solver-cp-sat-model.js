'use strict';

const Engine = require('./scheduling-engine');

const DAYS = ['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];
const PRIORITY_WEIGHT = { critical: 100, high: 50, medium: 20, low: 8 };

function mins(value) {
  const [h, m] = String(value || '00:00').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function time(total) {
  total = Math.max(0, Math.round(total));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function endMinutes(x) {
  return mins(x.time) + Number(x.duration || 60);
}

function entity(db, type, id, name, branchId) {
  return (db[type] || []).find((item) => {
    const same = (id && Number(item.id) === Number(id)) || (!id && String(item.name || '') === String(name || ''));
    if (!same) return false;
    if (Number(item.branchId) === Number(branchId)) return true;
    return Boolean(item.shared && Array.isArray(item.branchIds) && item.branchIds.map(Number).includes(Number(branchId)));
  }) || null;
}

function roomCandidates(db, lesson) {
  const rooms = (db.rooms || []).filter((room) => Number(room.branchId) === Number(lesson.branchId) || (room.shared && Array.isArray(room.branchIds) && room.branchIds.map(Number).includes(Number(lesson.branchId))));
  if (lesson.roomId || lesson.room) {
    const fixed = entity(db, 'rooms', lesson.roomId, lesson.room, lesson.branchId);
    return fixed ? [fixed] : [];
  }
  return rooms;
}

function priorityWeight(rules, key, fallback) {
  const cfg = rules.softConstraints?.[key] || {};
  if (cfg.enabled === false) return 0;
  return PRIORITY_WEIGHT[cfg.priority || fallback] || 20;
}

function basePenalty(db, lesson, candidate, rules, profile = 'balanced') {
  let penalty = 0;
  const teacher = entity(db, 'teachers', candidate.teacherId, candidate.teacher, candidate.branchId);
  const soft = rules.softConstraints || {};
  const sameDay = (db.lessons || []).filter(x => x.day === candidate.day);
  const sameTeacher = sameDay.filter(x => String(x.teacherId ?? x.teacher) === String(candidate.teacherId ?? candidate.teacher));
  const sameGroup = sameDay.filter(x => String(x.groupId ?? x.group) === String(candidate.groupId ?? candidate.group));
  if (soft.avoidLate?.enabled !== false && mins(candidate.time) >= mins(soft.avoidLate?.after || '20:00')) {
    penalty += priorityWeight(rules, 'avoidLate', 'medium');
  }
  if (soft.preferDays?.enabled !== false && teacher?.preferredDays?.length && !teacher.preferredDays.includes(candidate.day)) {
    penalty += priorityWeight(rules, 'preferDays', 'low');
  }
  // Preserve existing variant intent without pretending interaction terms are already modeled.
  if (candidate.day !== lesson.day || candidate.time !== lesson.time || String(candidate.roomId || '') !== String(lesson.roomId || '')) {
    if (lesson.day && lesson.time && lesson.locked !== true && Number(rules.movePenalty || 0) > 0) {
      penalty += Number(rules.movePenalty);
    }
  }
  if (profile === 'teacher') penalty -= sameTeacher.length * 3;
  if (profile === 'group') penalty -= sameGroup.length * 3;
  if (profile === 'minimalGaps') penalty -= Math.min(15, (sameTeacher.length + sameGroup.length) * 4);
  if (profile === 'compactDay') penalty -= Math.min(20, (sameTeacher.length + sameGroup.length) * 3);
  if (profile === 'fairLoad') penalty += Math.floor(sameTeacher.reduce((sum, x) => sum + Number(x.duration || 0), 0) / 60);
  if (profile === 'minimalMovement' && lesson.roomId && candidate.roomId && String(lesson.roomId) !== String(candidate.roomId)) penalty += 10;
  if (profile === 'room' && lesson.roomId && String(lesson.roomId) !== String(candidate.roomId)) penalty += 4;
  if (profile === 'branchUtilization' && candidate.roomId == null) penalty += 5;
  const custom = rules.customObjective || {};
  if (profile === 'custom') {
    penalty += Number(custom.latePenalty || 0) * (mins(candidate.time) >= mins(custom.after || '20:00') ? 1 : 0);
    penalty += Number(custom.roomChangePenalty || 0) * (lesson.roomId && String(lesson.roomId) !== String(candidate.roomId) ? 1 : 0);
  }
  return penalty;
}

function slotBuckets(day, start, duration, slotMinutes) {
  const out = [];
  for (let t = start; t < start + duration; t += slotMinutes) {
    out.push(`${day}|${t}`);
  }
  return out;
}

function placementKey(lessonId, candidate) {
  return `${String(lessonId)}::${candidate.day}::${candidate.time}::${candidate.roomId || candidate.room || ''}`;
}

function normalizeLessonSet(db) {
  const branchId = db.activeBranchId;
  return (db.lessons || [])
    .filter((lesson) => lesson.branchId === undefined || lesson.branchId === branchId)
    .map((lesson) => ({ ...lesson }));
}

function buildCandidateSpec(db, options = {}) {
  const rules = Engine.getRules(db);
  const lessons = normalizeLessonSet(db);
  const locked = lessons.filter((lesson) => lesson.locked);
  const candidates = [];
  const byLesson = new Map();
  const resourceBuckets = new Map();
  const diagnostics = [];

  const addBucket = (key, candidateIndex) => {
    if (!resourceBuckets.has(key)) resourceBuckets.set(key, []);
    resourceBuckets.get(key).push(candidateIndex);
  };

  lessons.forEach((lesson, lessonIndex) => {
    const exactLocked = Boolean(lesson.locked);
    const days = exactLocked ? [lesson.day] : (rules.allowedDays || DAYS).slice();
    const rooms = roomCandidates(db, lesson);
    const duration = Number(lesson.duration || 60);
    const slotMinutes = Math.max(1, Number(rules.slotMinutes || 15));
    const dayStart = exactLocked ? mins(lesson.time) : mins(rules.workStart);
    const dayEnd = exactLocked ? mins(lesson.time) : mins(rules.workEnd) - duration;
    const times = [];

    if (exactLocked) {
      if (lesson.day && lesson.time) times.push(mins(lesson.time));
    } else {
      for (let start = dayStart; start <= dayEnd; start += slotMinutes) times.push(start);
    }

    const lessonCandidates = [];
    for (const day of days) {
      if (!day) continue;
      for (const start of times) {
        for (const room of rooms) {
          const candidate = {
            ...lesson,
            day,
            time: time(start),
            roomId: room?.id,
            room: room?.name,
          };
          const reasons = Engine.hardReasons(db, candidate, locked.filter((x) => x.id !== lesson.id), rules);
          if (reasons.length) continue;

          const index = candidates.length;
          const item = {
            key: placementKey(lesson.id, candidate),
            lessonId: lesson.id,
            lessonIndex,
            id: candidate.id,
            day,
            time: candidate.time,
            startMinute: start,
            duration,
            roomId: room?.id ?? null,
            room: room?.name ?? '',
            teacherId: candidate.teacherId ?? null,
            groupId: candidate.groupId ?? null,
            teacher: candidate.teacher || '',
            group: candidate.group || '',
            candidate,
            penalty: basePenalty(db, lesson, candidate, rules, options.objectiveProfile || 'balanced'),
            locked: exactLocked,
          };
          candidates.push(item);
          lessonCandidates.push(index);

          const buckets = slotBuckets(day, start, duration, slotMinutes);
          if (item.teacherId != null) buckets.forEach((b) => addBucket(`teacher:${item.teacherId}|${b}`, index));
          if (item.groupId != null) buckets.forEach((b) => addBucket(`group:${item.groupId}|${b}`, index));
          if (item.roomId != null) buckets.forEach((b) => addBucket(`room:${item.roomId}|${b}`, index));
        }
      }
    }

    byLesson.set(lesson.id, lessonCandidates);
    if (!lessonCandidates.length) {
      diagnostics.push({
        lessonId: lesson.id,
        lesson: lesson.title || 'Без названия',
        locked: exactLocked,
        code: exactLocked ? 'locked_no_feasible_slot' : 'no_feasible_slot',
        message: exactLocked
          ? 'Зафиксированное занятие не имеет допустимого CP-SAT-кандидата при текущих жёстких ограничениях.'
          : 'Для занятия не найдено ни одного кандидата при текущих жёстких ограничениях.',
      });
    }
  });

  return {
    rules,
    lessons,
    locked,
    candidates,
    byLesson: [...byLesson.entries()].map(([lessonId, indexes]) => ({ lessonId, indexes })),
    resourceBuckets: [...resourceBuckets.entries()].map(([key, indexes]) => ({ key, indexes })),
    diagnostics,
    options: {
      objectiveProfile: options.objectiveProfile || 'balanced',
    },
  };
}

function selectedCandidates(spec, lessons) {
  const map = new Map((lessons || []).map((lesson) => [String(lesson.id), lesson]));
  return spec.candidates.filter((candidate) => {
    const chosen = map.get(String(candidate.lessonId));
    return chosen && placementKey(candidate.lessonId, chosen) === candidate.key;
  });
}

module.exports = {
  DAYS,
  mins,
  time,
  endMinutes,
  basePenalty,
  buildCandidateSpec,
  placementKey,
  selectedCandidates,
};
