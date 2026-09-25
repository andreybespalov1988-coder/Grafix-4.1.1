(function(){
'use strict';
const Engine = (typeof require === 'function') ? require('./scheduling-engine') : (typeof window !== 'undefined' ? window.SchedulingEngine : null);

function clone(v){return JSON.parse(JSON.stringify(v));}
function lesson(db,id){return (db.lessons||[]).find(x=>Number(x.id)===Number(id))||null;}
function duration(x){return Number(x.duration||x.activeMinutes||60)||60;}
function overlaps(a,b){return Engine.overlap(a,b);}
function teacherQualification(lesson, teacher){
  const required = lesson.subject || lesson.subjectName || '';
  if (!required) return {ok:true,score:1,reason:''};
  const subjects = Array.isArray(teacher.subjects) ? teacher.subjects.map(String) : [];
  const spec=String(teacher.spec||'').toLowerCase();
  const ok=subjects.map(String).includes(String(lesson.subjectId)) || subjects.some(s=>String(s).toLowerCase()===String(required).toLowerCase()) || spec.includes(String(required).toLowerCase());
  return {ok,score:ok?1:0,reason:ok?'':'Не подтверждена специализация'};
}
function availabilityScore(teacher, x){
  const blocked=(teacher.unavailable||[]).some(b=>Engine.overlap(x,{day:b.day,time:b.start,duration:(Number(Engine.mins(b.end))-Number(Engine.mins(b.start)))||duration(x)}));
  return blocked ? {ok:false,score:0,reason:'Недоступен в этот период'} : {ok:true,score:1,reason:''};
}
function conflictScore(db, x, teacherId){
  const peers=(db.lessons||[]).filter(y=>y.id!==x.id&&y.branchId===x.branchId&&String(y.teacherId??y.teacher)===String(teacherId));
  const conflicts=peers.filter(y=>overlaps(x,y));
  return {ok:conflicts.length===0,score:Math.max(0,1-conflicts.length/3),reason:conflicts.length?`Конфликтов: ${conflicts.length}`:''};
}
function travelScore(db,x,teacher){
  const branchTravel=Math.max(0,Number(teacher.travelMinutes)||0);
  if (!branchTravel) return {ok:true,score:1,reason:''};
  const prev=(db.lessons||[]).filter(y=>y.id!==x.id&&y.teacherId===teacher.id&&y.day===x.day&&y.time).sort((a,b)=>Engine.mins(b.time)-Engine.mins(a.time))[0];
  if(!prev)return {ok:true,score:1,reason:''};
  const gap=Engine.mins(x.time)-Engine.end(prev);
  return {ok:gap>=branchTravel,score:gap>=branchTravel?1:0,reason:gap>=branchTravel?'':`Недостаточно времени на переезд: нужно ${branchTravel} мин.`};
}
function findCandidates(db, lessonId, options={}){
  const x=lesson(db,lessonId); if(!x)return [];
  const branchId=Number(x.branchId);
  return (db.teachers||[]).filter(t=>t.branchId===branchId&&Number(t.id)!==Number(x.teacherId)).map(t=>{
    const q=teacherQualification(x,t), a=availabilityScore(t,x), c=conflictScore(db,x,t.id), tr=travelScore(db,x,t);
    const eligible=q.ok&&a.ok&&c.ok&&tr.ok;
    const score=Math.round((q.score*40+a.score*25+c.score*25+tr.score*10)*100)/100;
    return {teacher:t,eligible,score,reasons:[q.reason,a.reason,c.reason,tr.reason].filter(Boolean),qualification:q,availability:a,conflicts:c,travel:tr};
  }).sort((a,b)=>Number(b.eligible)-Number(a.eligible)||b.score-a.score||String(a.teacher.name).localeCompare(String(b.teacher.name),'ru'));
}
function ensureSubstitutions(db){if(!Array.isArray(db.substitutions))db.substitutions=[];if(!Array.isArray(db.notifications))db.notifications=[];return db.substitutions;}
function notify(db, payload){if(!Array.isArray(db.notifications))db.notifications=[];const item={id:`notif-${Date.now()}-${Math.random().toString(16).slice(2)}`,type:payload.type||'substitution',lessonId:Number(payload.lessonId)||null,message:String(payload.message||''),createdAt:new Date().toISOString(),read:false};db.notifications.unshift(item);return item;}
function createPlan(db,lessonId,teacherId,options={}){
  const x=lesson(db,lessonId); if(!x)throw new Error('Занятие не найдено');
  const candidate=findCandidates(db,lessonId).find(c=>Number(c.teacher.id)===Number(teacherId));
  if(!candidate && !options.force)throw new Error('Кандидат на замену не найден');
  return {id:`sub-${Date.now()}-${lessonId}`,lessonId:Number(lessonId),fromTeacherId:Number(x.teacherId)||null,toTeacherId:Number(teacherId),type:options.type||'temporary',status:'pending',reason:String(options.reason||''),effectiveDate:options.effectiveDate||x.date||null,candidate:clone(candidate||null),createdAt:new Date().toISOString()};
}
function approvePlan(db,planId,options={}){
  const list=ensureSubstitutions(db), p=list.find(x=>x.id===planId);
  if(!p)throw new Error('Заявка на замену не найдена');
  const x=lesson(db,p.lessonId); if(!x)throw new Error('Занятие для замены не найдено');
  x.teacherId=p.toTeacherId;
  const t=(db.teachers||[]).find(y=>Number(y.id)===Number(p.toTeacherId));
  if(t)x.teacher=t.name;
  x.substitution={id:p.id,fromTeacherId:p.fromTeacherId,toTeacherId:p.toTeacherId,type:p.type,effectiveDate:p.effectiveDate,approvedAt:new Date().toISOString(),approvedBy:options.approvedBy||'local-user'};
  p.status='approved';p.approvedAt=x.substitution.approvedAt;p.approvedBy=x.substitution.approvedBy;
  notify(db,{lessonId:x.id,message:`Замена согласована: ${x.title||'Занятие'} · педагог ${p.toTeacherId}`,type:'substitution-approved'});
  if(Array.isArray(db.history))db.history.unshift({action:'Замена педагога',detail:`${x.title||'Занятие'}: ${p.fromTeacherId} → ${p.toTeacherId}`,at:new Date().toISOString()});
  return {plan:p,lesson:x};
}
function rejectPlan(db,planId,reason=''){const p=ensureSubstitutions(db).find(x=>x.id===planId);if(!p)return false;p.status='rejected';p.rejectionReason=reason;p.rejectedAt=new Date().toISOString();return true;}
function moveLesson(db,lessonId,patch,options={}){
  const x=lesson(db,lessonId); if(!x)throw new Error('Занятие не найдено');
  const before=clone(x);Object.assign(x,patch||{});
  const peers=(db.lessons||[]).filter(y=>y.id!==x.id&&y.branchId===x.branchId&&overlaps(x,y));
  if(peers.length&&!options.force){Object.assign(x,before);throw new Error('Перенос создаёт конфликт ресурсов');}
  return {before,after:clone(x),conflicts:peers};
}
function splitLesson(db,lessonId,parts){
  const x=lesson(db,lessonId);if(!x)throw new Error('Занятие не найдено');const count=Math.max(2,Number(parts)||2);const total=duration(x);const base=Math.floor(total/count);const extra=total-base*count;const newLessons=[];
  x.duration=base+(extra?1:0);for(let i=1;i<count;i++){const copy=clone(x);copy.id=Math.max(0,...(db.lessons||[]).map(y=>Number(y.id)||0),...newLessons.map(y=>y.id))+1;copy.duration=base+(i<extra?1:0);copy.title=`${x.title||'Занятие'} · часть ${i+1}`;copy.locked=false;db.lessons.push(copy);newLessons.push(copy);}return [x,...newLessons];
}
function mergeLessons(db,lessonIds){const xs=lessonIds.map(id=>lesson(db,id)).filter(Boolean);if(xs.length<2)throw new Error('Для объединения нужны минимум два занятия');const first=xs[0];first.duration=xs.reduce((s,x)=>s+duration(x),0);first.title=first.title||xs[0].title;for(const x of xs.slice(1)){const i=db.lessons.findIndex(y=>y.id===x.id);if(i>=0)db.lessons.splice(i,1);}return first;}
function history(db){return ensureSubstitutions(db).slice().sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));}
const SubstitutionAPI={findCandidates,ensureSubstitutions,notify,createPlan,approvePlan,rejectPlan,moveLesson,splitLesson,mergeLessons,history};
if(typeof module!=='undefined'&&module.exports)module.exports=SubstitutionAPI;
if(typeof window!=='undefined')window.SubstitutionEngine=SubstitutionAPI;
})();
