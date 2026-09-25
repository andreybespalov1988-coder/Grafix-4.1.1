(function(){
'use strict';
const DAY_NAMES=['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье'];
function isoDate(d){return d.toISOString().slice(0,10)}
function parseDate(v){const m=String(v||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return null;const d=new Date(Date.UTC(+m[1],+m[2]-1,+m[3]));return Number.isNaN(d.getTime())?null:d}
function mondayIndex(date){return (date.getUTCDay()+6)%7}
function weekNumber(start, date){const a=parseDate(start)||date;const diff=Math.floor((date-a)/86400000);return Math.floor(diff/7)+1}
function inRange(date,start,end){return (!start||date>=start)&&(!end||date<=end)}
function occurrenceDates(period, template){
 const p=period||{};const start=parseDate(p.start),end=parseDate(p.end);if(!start||!end||end<start)return [];
 const days=Array.isArray(template?.days)&&template.days.length?template.days:[template?.day||'Понедельник'];
 const daySet=new Set(days);const ex=p.exceptions&&typeof p.exceptions==='object'?p.exceptions:{};const out=[];
 for(let t=new Date(start);t<=end;t.setUTCDate(t.getUTCDate()+1)){
  const day=DAY_NAMES[mondayIndex(t)]; if(!daySet.has(day))continue;
  const iso=isoDate(t);const item=ex[iso]; if(item?.type==='cancel')continue;
  const w=weekNumber(p.start,t);const mode=p.weeksMode||'weekly';
  if(mode==='odd-even' && template?.weekParity && template.weekParity!==((w%2)?'odd':'even'))continue;
  if(mode==='cycle'){const cycle=Math.max(1,Number(p.cycleLength)||2);const pos=(w-1)%cycle+1;if(Array.isArray(template?.cycleWeeks)&&template.cycleWeeks.length&&!template.cycleWeeks.includes(pos))continue;}
  out.push({date:iso,day,week:w,exception:item||null});
 }
 return out;
}
function expandTemplates(period, lessons){
 const instances=[];
 for(const lesson of lessons||[]){
  if(!lesson.day)continue;
  const dates=occurrenceDates(period,{day:lesson.day,days:lesson.days,weekParity:lesson.weekParity,cycleWeeks:lesson.cycleWeeks});
  for(const o of dates){
   const ex=o.exception||{};
   if(ex.type==='cancel')continue;
   const moved=ex.type==='move' && ex.newDate ? ex.newDate : o.date;
   const effective=ex.type==='move' ? {...lesson,time:ex.time||lesson.time,day:ex.day||lesson.day} : {...lesson};
   if(ex.type==='replace')Object.assign(effective,{teacher:ex.teacher||effective.teacher,teacherId:ex.teacherId||effective.teacherId,substitution:{...effective.substitution,instanceDate:moved}});
   instances.push({...effective,instanceId:`${lesson.id}@${moved}`,templateId:lesson.id,date:moved,day:effective.day||o.day,time:effective.time||'',duration:Number(effective.duration)||60,instance:true,cancelled:false,movedFrom:ex.type==='move'&&ex.newDate&&ex.newDate!==o.date?o.date:null});
  }
 }
 const unique=new Map();for(const x of instances)unique.set(`${x.templateId}@${x.date}`,x);return [...unique.values()].filter(x=>!(period?.exceptions?.[x.date]?.type==='cancel'));
}
function addException(period,date,patch){const p={...(period||{}),exceptions:{...((period||{}).exceptions||{})}};p.exceptions[date]={...p.exceptions[date],...patch};return p}
function removeException(period,date){const p={...(period||{}),exceptions:{...((period||{}).exceptions||{})}};delete p.exceptions[date];return p}
function classifyDate(period,date){const d=parseDate(date);if(!d)return 'invalid';const iso=isoDate(d),e=period?.exceptions?.[iso];if(e?.type==='holiday')return 'holiday';if(e?.type==='workday')return 'workday';if(e?.type==='cancel')return 'cancelled';return 'normal'}
const CalendarEngine={DAY_NAMES,parseDate,isoDate,weekNumber,occurrenceDates,expandTemplates,addException,removeException,classifyDate};
if(typeof module!=='undefined'&&module.exports)module.exports=CalendarEngine;
if(typeof window!=='undefined')window.CalendarEngine=CalendarEngine;
})();
