'use strict';

function baseDb() {
  return {
    activeBranchId: 1,
    branches: [{ id: 1, name: 'Филиал 1' }],
    teachers: [
      { id: 1, branchId: 1, name: 'Педагог 1', preferredDays: ['Вторник'] },
      { id: 2, branchId: 1, name: 'Педагог 2', preferredDays: ['Среда'] },
    ],
    people: [
      { id: 101, branchId: 1, name: 'Группа 1' },
      { id: 102, branchId: 1, name: 'Группа 2' },
    ],
    rooms: [
      { id: 201, branchId: 1, name: 'Зал 1', capacity: 20, type: 'class' },
      { id: 202, branchId: 1, name: 'Зал 2', capacity: 20, type: 'class' },
    ],
    lessons: [],
    scheduleRules: {
      workStart: '09:00',
      workEnd: '18:00',
      slotMinutes: 60,
      maxTeacherDailyMinutes: 360,
      maxGroupDailyMinutes: 360,
      maxConsecutiveMinutes: 360,
      allowedDays: ['Понедельник', 'Вторник', 'Среда'],
      blockedSlots: [],
      softConstraints: {
        avoidLate: { enabled: false },
        compact: { enabled: false },
        avoidGaps: { enabled: false },
        preferDays: { enabled: true, priority: 'high' },
        singleRoom: { enabled: false },
      },
    },
  };
}

function lesson(id, teacherId, groupId, title) {
  return {
    id,
    branchId: 1,
    teacherId,
    teacher: teacherId === 1 ? 'Педагог 1' : 'Педагог 2',
    groupId,
    group: groupId === 101 ? 'Группа 1' : 'Группа 2',
    roomId: null,
    room: '',
    duration: 60,
    participantsCount: 10,
    roomType: 'class',
    title,
    day: '',
    time: '',
    locked: false,
  };
}

function feasibleDb() {
  const db = baseDb();
  db.lessons = [lesson(1, 1, 101, 'Занятие 1'), lesson(2, 2, 102, 'Занятие 2')];
  return db;
}

function lockedDb() {
  const db = feasibleDb();
  db.lessons[0] = {
    ...db.lessons[0],
    roomId: 201,
    room: 'Зал 1',
    day: 'Понедельник',
    time: '09:00',
    locked: true,
  };
  return db;
}

function infeasibleDb() {
  const db = baseDb();
  db.rooms = [{ id: 201, branchId: 1, name: 'Зал 1', capacity: 20, type: 'class' }];
  db.teachers = [{ id: 1, branchId: 1, name: 'Педагог 1' }];
  db.people = [{ id: 101, branchId: 1, name: 'Группа 1' }];
  db.lessons = [
    { ...lesson(1, 1, 101, 'Невозможное 1'), roomId: 201, room: 'Зал 1', day: 'Понедельник', time: '09:00', locked: true },
    { ...lesson(2, 1, 101, 'Невозможное 2'), roomId: 201, room: 'Зал 1', day: 'Понедельник', time: '09:00', locked: true },
  ];
  return db;
}

function objectiveDb() {
  const db = feasibleDb();
  db.scheduleRules.allowedDays = ['Понедельник', 'Вторник'];
  return db;
}

function largeDb(count = 80) {
  const db = baseDb();
  db.rooms = [
    { id: 201, branchId: 1, name: 'Зал 1', capacity: 20, type: 'class' },
    { id: 202, branchId: 1, name: 'Зал 2', capacity: 20, type: 'class' },
    { id: 203, branchId: 1, name: 'Зал 3', capacity: 20, type: 'class' },
    { id: 204, branchId: 1, name: 'Зал 4', capacity: 20, type: 'class' },
  ];
  db.teachers = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, branchId: 1, name: `Педагог ${i + 1}` }));
  db.people = Array.from({ length: 12 }, (_, i) => ({ id: 101 + i, branchId: 1, name: `Группа ${i + 1}` }));
  db.lessons = Array.from({ length: count }, (_, i) => lesson(
    i + 1,
    (i % 12) + 1,
    101 + (i % 12),
    `Занятие ${i + 1}`,
  ));
  return db;
}

module.exports = { baseDb, feasibleDb, lockedDb, infeasibleDb, objectiveDb, largeDb };
