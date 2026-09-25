(function(){
'use strict';
const Engine = (typeof require === 'function') ? require('./scheduling-engine') : (typeof window !== 'undefined' ? window.SchedulingEngine : null);
const ConstraintStudio = (typeof require === 'function') ? require('./constraint-studio') : (typeof window !== 'undefined' ? window.ConstraintStudio : null);

function clone(v) { return JSON.parse(JSON.stringify(v)); }
function resourceKey(x, type) { return `${type}:${x?.[type+'Id'] ?? x?.[type] ?? ''}`; }
function activeLessons(db, organizationWide = false) {
  if (organizationWide) return (db.lessons || []).filter(x => x && x.day && x.time);
  const bid = Number(db.activeBranchId);
  return (db.lessons || []).filter(x => x && (x.branchId == null || Number(x.branchId) === bid) && x.day && x.time);
}
function conflictGraph(db, lessons) {
  const edges=[];
  for (let i=0;i<lessons.length;i++) {
    for (let j=i+1;j<lessons.length;j++) {
      const a=lessons[i], b=lessons[j];
      if (!Engine.overlap(a,b)) continue;
      const shared=[];
      for (const [type,label] of [['teacher','Педагог'],['group','Группа'],['room','Кабинет']]) if ((a[type+'Id'] ?? a[type]) != null && String(a[type+'Id'] ?? a[type]) === String(b[type+'Id'] ?? b[type])) shared.push({type,label});
      if (a.branchId !== b.branchId && String(a.teacherId ?? a.teacher) === String(b.teacherId ?? b.teacher)) shared.push({type:'cross_branch_teacher',label:'Педагог между филиалами'});
      if (shared.length) edges.push({a,b,shared});
    }
  }
  return edges;
}
function degreeBottlenecks(lessons) {
  const map = new Map();
  const add=(key,label,id)=>{ if(!map.has(key)) map.set(key,{key,label,id,count:0,lessons:[]}); const r=map.get(key); r.count++; r.lessons.push(...id ? [id] : []); };
  for(const x of lessons){
    add(resourceKey(x,'teacher'),'Педагог',x.id);
    add(resourceKey(x,'group'),'Группа',x.id);
    add(resourceKey(x,'room'),'Кабинет',x.id);
  }
  return [...map.values()].sort((a,b)=>b.count-a.count).slice(0,12);
}
function cloneWithConstraint(db, id, enabled) {
  const out=clone(db);
  if (!Array.isArray(out.constraints)) return out;
  const c=out.constraints.find(x=>Number(x.id)===Number(id));
  if (c) c.enabled=enabled;
  return out;
}
function candidateCount(db, lesson) {
  const rules=Engine.getRules(db);
  const placed=(db.lessons||[]).filter(x=>x.id!==lesson.id && x.branchId===lesson.branchId && x.day && x.time);
  return Engine.candidateSlots(db,{...lesson,day:'',time:''},placed,rules).length;
}
function uniqueCodes(reasons) { return [...new Set((reasons||[]).map(r=>r.code))]; }
function minimalConflictSubset(db, lessons) {
  const problematic=lessons.filter(x => {
    const rs=Engine.hardReasons(db,x,lessons.filter(y=>y.id!==x.id),Engine.getRules(db));
    return rs.length;
  }).sort((a,b)=>candidateCount(db,a)-candidateCount(db,b));
  return problematic.slice(0, Math.min(8, problematic.length)).map(x=>({lessonId:x.id,title:x.title,codes:uniqueCodes(Engine.hardReasons(db,x,lessons.filter(y=>y.id!==x.id),Engine.getRules(db)))}));
}
function relaxationAnalysis(db, lessons) {
  const out=[];
  for (const c of ConstraintStudio.list(db,{enabled:true,hardness:'HARD'})) {
    const relaxed=cloneWithConstraint(db,c.id,false);
    const before=lessons.reduce((s,x)=>s+candidateCount(db,x),0);
    const afterLessons=lessons.map(x=>x);
    const after=afterLessons.reduce((s,x)=>s+candidateCount(relaxed,x),0);
    const impact=after-before;
    if (impact>0) out.push({constraintId:c.id,name:c.name,kind:c.kind,impact,weight:c.weight,action:`Ослабить «${c.name}» или перевести в SOFT`});
  }
  return out.sort((a,b)=>b.impact-a.impact).slice(0,8);
}
function roomAlternatives(db, lesson) {
  const rooms=(db.rooms||[]).filter(r => r.branchId===lesson.branchId && (!lesson.roomId || Number(r.id)!==Number(lesson.roomId)));
  const placed=(db.lessons||[]).filter(x=>x.id!==lesson.id && x.branchId===lesson.branchId && x.day===lesson.day && x.time);
  return rooms.map(room=>{
    const candidate={...lesson,roomId:room.id,room:room.name};
    return {room,available:!Engine.hardReasons(db,candidate,placed,Engine.getRules(db)).some(r=>r.code==='room_overlap'||r.code==='room_unavailable'||r.code==='capacity'||r.code==='room_type')};
  }).filter(x=>x.available).slice(0,8);
}
function analyze(db, options={}) {
  const organizationWide = Boolean(options.organizationWide);
  const lessons=activeLessons(db,organizationWide);
  const rules=Engine.getRules(db);
  const evalResult=Engine.evaluate({...db,activeBranchId:db.activeBranchId},lessons,rules);
  const edges=conflictGraph(db,lessons);
  const problematic=lessons.map(x=>({x,rs:Engine.hardReasons(db,x,lessons.filter(y=>y.id!==x.id),rules),slots:candidateCount(db,x)})).filter(z=>z.rs.length || z.slots===0);
  const critical=problematic.filter(z=>z.slots===0 || z.rs.length).sort((a,b)=>a.slots-b.slots);
  const bottlenecks=degreeBottlenecks(lessons).map(b=>({...b,sharedAcrossBranches:lessons.filter(x=>resourceKey(x,b.label==='Педагог'?'teacher':b.label==='Группа'?'group':'room')===b.key).some(x=>x.branchId!==db.activeBranchId)}));
  const recommendations=[];
  for(const item of critical.slice(0,8)) {
    const altRooms=roomAlternatives(db,item.x);
    const codes=uniqueCodes(item.rs);
    if (altRooms.length) recommendations.push({priority:'high',lessonId:item.x.id,title:item.x.title,type:'room',text:`Разрешить ${altRooms.length} альтернативных кабинетов`,impact:altRooms.length,alternatives:altRooms.map(x=>x.room.name)});
    if (codes.includes('teacher_unavailable')) recommendations.push({priority:'high',lessonId:item.x.id,title:item.x.title,type:'availability',text:'Открыть один недоступный интервал педагога или выбрать другого педагога'});
    if (codes.includes('group_unavailable')) recommendations.push({priority:'high',lessonId:item.x.id,title:item.x.title,type:'group',text:'Открыть интервал группы или перенести занятие на другой день'});
    if (codes.includes('outside_worktime') || codes.includes('day_forbidden')) recommendations.push({priority:'medium',lessonId:item.x.id,title:item.x.title,type:'time',text:'Расширить рабочее окно или разрешённые дни'});
  }
  const relaxations = db.constraints?.length ? relaxationAnalysis(db,lessons) : [];
  for(const r of relaxations.slice(0,5)) recommendations.push({priority:'medium',type:'constraint',constraintId:r.constraintId,text:r.action,impact:r.impact});
  if (!recommendations.length && !critical.length) recommendations.push({priority:'low',type:'status',text:'Система не обнаружила структурной причины невозможности расписания при текущей модели.'});
  return {
    status: evalResult.hardConflicts || problematic.length ? 'CONFLICT' : 'HEALTHY',
    summary: evalResult.hardConflicts || problematic.length
      ? `Обнаружено ${problematic.length} проблемных занятий; ${edges.length} ресурсных конфликтов.`
      : `Жёстких конфликтов не обнаружено. Размещено ${evalResult.placed} из ${lessons.length}.`,
    metrics: { ...evalResult, totalLessons: lessons.length, conflictEdges: edges.length },
    conflictingResources: bottlenecks,
    minimalConflictSubset: minimalConflictSubset(db,lessons),
    conflicts: edges.map(e=>({a:e.a.id,b:e.b.id,shared:e.shared})),
    relaxations,
    recommendations,
    problemLessons: problematic.slice(0,20).map(x=>({lessonId:x.x.id,title:x.x.title,availableSlots:x.slots,reasons:x.rs})),
    organizationWide,
  };
}

const api = { analyze, conflictGraph, minimalConflictSubset, relaxationAnalysis };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.ScheduleAdvisor = api;
})();
