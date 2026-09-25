(function(){
'use strict';

const DEFAULT_DAYS=['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];
const PRIORITY_WEIGHT={critical:100,high:50,medium:20,low:8};
const DAY_INDEX=new Map(DEFAULT_DAYS.map((d,i)=>[d,i]));
const ConstraintStudio = (typeof require === 'function') ? require('./constraint-studio') : (typeof window !== 'undefined' ? window.ConstraintStudio : null);
const ActivityModel = (typeof require === 'function') ? require('./activity-model') : (typeof window !== 'undefined' ? window.ActivityModel : null);

function clone(v){return JSON.parse(JSON.stringify(v));}
function mins(v){const [h,m]=String(v||'00:00').split(':').map(Number);return (h||0)*60+(m||0)}
function time(n){n=Math.max(0,Math.round(n));return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')}
function occupiedDuration(x){return Math.max(1,Number(x.activeMinutes ?? x.duration ?? 60)||60)+Math.max(0,Number(x.setupMinutes||0))+Math.max(0,Number(x.teardownMinutes||0))}
function end(x){return mins(x.time)+occupiedDuration(x)}
function overlap(a,b){return a.day===b.day&&a.day&&mins(a.time)<end(b)&&mins(b.time)<end(a)}
function entity(db,type,id,name,branchId){return (db[type]||[]).find(x=>{const sameId=(id&&Number(x.id)===Number(id))||(!id&&String(x.name||'')===String(name||''));if(!sameId)return false;if(Number(x.branchId)===Number(branchId))return true;return Boolean(x.shared&&Array.isArray(x.branchIds)&&x.branchIds.map(Number).includes(Number(branchId)));})||null}
function resourceId(db,x,type,idField,nameField){return Number(x[idField]||0)||entity(db,type,0,x[nameField],x.branchId)?.id||null}
function sameResource(a,b,field,idField){const ai=a[idField]||a[field],bi=b[idField]||b[field];return ai&&bi&&String(ai)===String(bi)}
function intervalBlocked(x, list){return (list||[]).some(u=>u.day===x.day&&(!u.start|| (mins(x.time)<mins(u.end||'23:59')&&end(x)>mins(u.start))))}
function getRules(db){return {workStart:'09:00',workEnd:'21:00',slotMinutes:15,maxTeacherDailyMinutes:360,maxGroupDailyMinutes:240,maxConsecutiveMinutes:180,minGapMinutes:0,maxGapMinutes:9999,allowedDays:DEFAULT_DAYS.slice(),blockedSlots:[],objectiveProfile:'balanced',organizationWide:false,softConstraints:{avoidLate:{enabled:true,after:'20:00',priority:'medium'},compact:{enabled:true,priority:'medium'},avoidGaps:{enabled:true,priority:'medium'},preferDays:{enabled:true,priority:'low'},singleRoom:{enabled:true,priority:'low'}},...clone(db.scheduleRules||{})}}
function getBranch(db,id){return (db.branches||[]).find(b=>Number(b.id)===Number(id))||db.branches?.[0]||null}
function resourceRefs(x){const out=[];if(x?.teacherId!=null)out.push(`teacher:${x.teacherId}`);if(x?.groupId!=null)out.push(`group:${x.groupId}`);if(x?.roomId!=null)out.push(`room:${x.roomId}`);for(const [key,field] of [['artist','artistIds'],['participant','participantIds'],['stage','stageIds'],['hall','hallIds'],['equipment','equipmentIds'],['technical','technicalResourceIds'],['resource','resourceIds']]) for(const id of (Array.isArray(x?.[field])?x[field]:[])) out.push(`${key}:${id}`);return out}
function hardReasons(db,x,placed,rules){
  const reasons=[]; const t=entity(db,'teachers',x.teacherId,x.teacher,x.branchId); const g=entity(db,'people',x.groupId,x.group,x.branchId); const r=entity(db,'rooms',x.roomId,x.room,x.branchId);
  if(!x.teacher) reasons.push({code:'missing_teacher',message:'Не назначен педагог'});
  if(!x.group) reasons.push({code:'missing_group',message:'Не назначена группа'});
  if(!x.room) reasons.push({code:'missing_room',message:'Не назначен кабинет'});
  if(!x.day||!x.time) reasons.push({code:'unplaced',message:'Не указаны день или время'});
  if(x.day&&!rules.allowedDays.includes(x.day)) reasons.push({code:'day_forbidden',message:`День «${x.day}» запрещён правилами`});
  const call = Math.max(0,Number(x.callMinutes||0));
  const occupancyStart = mins(x.time||'00:00') - call;
  if(x.time&&(occupancyStart<mins(rules.workStart)||end(x)>mins(rules.workEnd))) reasons.push({code:'outside_worktime',message:'Занятие выходит за рабочее время с учётом подготовки/call time'});
  if(t&&intervalBlocked(x,t.unavailable)) reasons.push({code:'teacher_unavailable',message:'Педагог недоступен в этот период'});
  if(g&&intervalBlocked(x,g.unavailable)) reasons.push({code:'group_unavailable',message:'Группа недоступна в этот период'});
  if(r&&intervalBlocked(x,r.unavailable)) reasons.push({code:'room_unavailable',message:'Кабинет недоступен в этот период'});
  if(r&&r.capacity!=null&&x.participantsCount!=null&&Number(x.participantsCount)>Number(r.capacity)) reasons.push({code:'capacity',message:`Вместимость кабинета ${r.capacity} меньше числа участников ${x.participantsCount}`});
  if(r&&x.roomType&&r.type&&String(x.roomType)!==String(r.type)) reasons.push({code:'room_type',message:`Кабинет требует тип «${x.roomType}», выбран «${r.type}»`});
  if(x.branchId!=null&&r&&r.branchId!==x.branchId && !(r.shared && Array.isArray(r.branchIds) && r.branchIds.map(Number).includes(Number(x.branchId)))) reasons.push({code:'branch_mismatch',message:'Кабинет принадлежит другому филиалу'});
  for(const y of placed){if(y.id===x.id||!overlap(x,y))continue;
    if(sameResource(x,y,'teacher','teacherId')) reasons.push({code:'teacher_overlap',message:`Педагог занят: «${y.title||'занятие'}»`});
    if(sameResource(x,y,'group','groupId')) reasons.push({code:'group_overlap',message:`Группа занята: «${y.title||'занятие'}»`});
    if(sameResource(x,y,'room','roomId')) reasons.push({code:'room_overlap',message:`Кабинет занят: «${y.title||'занятие'}»`});
    if(x.branchId!==y.branchId&&sameResource(x,y,'teacher','teacherId')) reasons.push({code:'cross_branch_teacher',message:'Педагог занят в другом филиале'});
    const sharedRefs=resourceRefs(x).filter(ref=>resourceRefs(y).includes(ref));
    for(const ref of sharedRefs) if(!['teacher:','group:','room:'].some(prefix=>ref.startsWith(prefix))) reasons.push({code:'shared_resource_overlap',message:`Общий ресурс занят одновременно: ${ref}`});
  }
  if(x.teacherId!=null&&x.day&&x.time){
    const teacherTravel=Math.max(Number(t?.travelMinutes||0),Number(x.travelMinutes||0));
    if(teacherTravel>0){
      for(const y of placed.filter(y=>y.id!==x.id&&y.teacherId===x.teacherId&&y.day===x.day&&y.time)){
        if(Number(y.branchId)!==Number(x.branchId)){
          const gapBefore=Math.abs(mins(x.time)-end(y)); const gapAfter=Math.abs(mins(y.time)-end(x));
          if(Math.min(gapBefore,gapAfter)<teacherTravel && (overlap(x,y) || Math.min(gapBefore,gapAfter)>=0)) reasons.push({code:'travel_time',message:`Между филиалами требуется не менее ${teacherTravel} мин. на переезд`});
        }
      }
    }
  }
  const dayLessons=placed.filter(y=>y.id!==x.id&&y.day===x.day);
  const tLoad=dayLessons.filter(y=>sameResource(x,y,'teacher','teacherId')).reduce((s,y)=>s+Number(y.duration||0),0)+Number(x.duration||0);
  const gLoad=dayLessons.filter(y=>sameResource(x,y,'group','groupId')).reduce((s,y)=>s+Number(y.duration||0),0)+Number(x.duration||0);
  if(tLoad>Number(rules.maxTeacherDailyMinutes||0)) reasons.push({code:'teacher_daily_limit',message:`Дневная нагрузка педагога ${tLoad} мин превышает лимит ${rules.maxTeacherDailyMinutes} мин`});
  if(gLoad>Number(rules.maxGroupDailyMinutes||0)) reasons.push({code:'group_daily_limit',message:`Дневная нагрузка группы ${gLoad} мин превышает лимит ${rules.maxGroupDailyMinutes} мин`});
  const seq=(resource)=>dayLessons.filter(y=>sameResource(x,y,resource,resource+'Id')).sort((a,b)=>mins(a.time)-mins(b.time));
  for(const [resource,label] of [['teacher','педагога'],['group','группы']]){
    const arr=seq(resource).concat([x]).sort((a,b)=>mins(a.time)-mins(b.time)); let run=0;
    for(let i=0;i<arr.length;i++){run+=Number(arr[i].duration||0);if(i<arr.length-1&&mins(arr[i+1].time)>end(arr[i]))run=0;if(run>Number(rules.maxConsecutiveMinutes||99999)) {reasons.push({code:'max_consecutive',message:`Превышено максимальное время занятий подряд для ${label}`});break;}}
  }
  for(const b of rules.blockedSlots||[]) if(b.day===x.day && mins(x.time)<mins(b.end||'23:59') && end(x)>mins(b.start||'00:00')) reasons.push({code:'blocked_slot',message:`Время ${b.start}–${b.end} запрещено правилами`});
  if (ConstraintStudio) {
    const custom = ConstraintStudio.evaluateActivity(db, x, { lessons: placed, resource: r });
    for (const item of custom.reasons || []) if (item.constraint.hardness === 'HARD') reasons.push({ code:`constraint:${item.constraint.kind}`, message:item.reason || item.constraint.name, constraintId:item.constraint.id, source:'Constraint Studio' });
  }
  return reasons;
}
function softPenalty(db,x,placed,rules,profile){let penalty=0;const sc=rules.softConstraints||{};const t=entity(db,'teachers',x.teacherId,x.teacher,x.branchId);const day=placed.filter(y=>y.day===x.day);
  const weight=(key,def)=>{const c=sc[key]||{};return c.enabled===false?0:(PRIORITY_WEIGHT[c.priority||def]||20)};
  if((sc.avoidLate?.enabled!==false)&&mins(x.time)>=mins(sc.avoidLate?.after||'20:00')) penalty+=weight('avoidLate','medium');
  if(sc.compact?.enabled!==false){const sameT=day.filter(y=>sameResource(x,y,'teacher','teacherId'));const sameG=day.filter(y=>sameResource(x,y,'group','groupId'));const adjacent=(arr)=>arr.some(y=>Math.abs(mins(x.time)-end(y))<=rules.slotMinutes||Math.abs(mins(y.time)-end(x))<=rules.slotMinutes); if(sameT.length&&!adjacent(sameT))penalty+=weight('compact','medium');if(sameG.length&&!adjacent(sameG))penalty+=Math.round(weight('compact','medium')*.6)}
  if(sc.avoidGaps?.enabled!==false){for(const resource of ['teacher','group']){const arr=day.filter(y=>sameResource(x,y,resource,resource+'Id'));for(const y of arr){const gap=Math.max(0,mins(x.time)-end(y),mins(y.time)-end(x));if(gap>0)penalty+=Math.min(weight('avoidGaps','medium'),Math.ceil(gap/15));}}}
  if(sc.preferDays?.enabled!==false&&t?.preferredDays?.length&&!t.preferredDays.includes(x.day)) penalty+=weight('preferDays','low');
  if(sc.singleRoom?.enabled!==false){const sameG=placed.filter(y=>sameResource(x,y,'group','groupId'));if(sameG.length&&sameG.every(y=>y.room!==x.room))penalty+=weight('singleRoom','low')}
  const sameT=day.filter(y=>sameResource(x,y,'teacher','teacherId'));
  const sameG=day.filter(y=>sameResource(x,y,'group','groupId'));
  if(profile==='teacher') penalty-=sameT.length*3;
  if(profile==='group') penalty-=sameG.length*3;
  if(profile==='room') { if(x.roomId && x.roomId!==undefined && x.roomId!==null && x.roomId!==x.originalRoomId) penalty += 4; }
  if(profile==='minimalGaps') penalty-=Math.min(15,sameT.length*4+sameG.length*3);
  if(profile==='minimalMovement') { if(x.originalRoomId && String(x.originalRoomId)!==String(x.roomId)) penalty+=10; }
  if(profile==='compactDay') penalty-=Math.min(20,(sameT.length+sameG.length)*3);
  if(profile==='fairLoad') { const teacherMinutes=sameT.reduce((n,y)=>n+Number(y.duration||0),0); penalty+=Math.floor(teacherMinutes/60); }
  if(profile==='branchUtilization') { const rooms=(db.rooms||[]).filter(r=>Number(r.branchId)===Number(x.branchId)); const used=new Map(rooms.map(r=>[r.id,0])); for(const y of placed){ if(used.has(y.roomId)) used.set(y.roomId,used.get(y.roomId)+1); } const current=used.get(x.roomId)||0; penalty += current===0 ? 2 : 0; }
  if (ConstraintStudio) {
    const custom = ConstraintStudio.evaluateActivity(db, x, { lessons: placed, resource: entity(db,'rooms',x.roomId,x.room,x.branchId) });
    penalty += Number(custom.softPenalty || 0);
  }
  if (ActivityModel && x.setupMinutes != null) penalty += Math.max(0, Number(x.setupMinutes||0))/15;
  return penalty;
}
function evaluate(db,lessons,rules){const placed=lessons.filter(x=>x.day&&x.time);let hard=0,soft=0,issues=[];for(const x of placed){const rs=hardReasons(db,x,placed.filter(y=>y.id!==x.id),rules);hard+=rs.length;if(rs.length)issues.push({lessonId:x.id,lesson:x.title||'Без названия',severity:'critical',reasons:rs}) ;soft+=softPenalty(db,x,placed.filter(y=>y.id!==x.id),rules)}
  const windows={};for(const x of placed){for(const res of ['teacher','group']){const key=`${res}:${x[res+'Id']||x[res]}`; (windows[key]||(windows[key]=[])).push(x)}}
  let gaps=0;for(const arr of Object.values(windows)){arr.sort((a,b)=>DAY_INDEX.get(a.day)-DAY_INDEX.get(b.day)||mins(a.time)-mins(b.time));for(let i=1;i<arr.length;i++)if(arr[i].day===arr[i-1].day)gaps+=Math.max(0,mins(arr[i].time)-end(arr[i-1]));}
  const unplaced=lessons.filter(x=>!x.day||!x.time).length;return {hardConflicts:hard,softPenalty:soft,gapsMinutes:gaps,unplaced,placed:lessons.length-unplaced,completion:lessons.length?Math.round((lessons.length-unplaced)/lessons.length*100):100,quality:Math.max(0,Math.round(100-(hard*20)-(unplaced*12)-(soft*.35)-(gaps/30)) ),issues};}
function candidateSlots(db,x,placed,rules){const days=(rules.allowedDays||DEFAULT_DAYS).slice();const out=[];for(const day of days){for(let m=mins(rules.workStart);m<=mins(rules.workEnd)-occupiedDuration(x);m+=Number(rules.slotMinutes||15)){const c={...x,originalRoomId:x.originalRoomId ?? x.roomId,day,time:time(m)};if(!hardReasons(db,c,placed,rules).length)out.push(c);}}return out;}
function generateVariant(db,profile='balanced',seed=0){
  const rules=getRules(db);
  const base=clone(rules.organizationWide ? (db.lessons||[]) : (db.lessons||[]).filter(x=>x.branchId===undefined||x.branchId===db.activeBranchId));
  const locked=base.filter(x=>x.locked);
  const movable=base.filter(x=>!x.locked).sort((a,b)=>Number(b.duration||60)-Number(a.duration||60));
  const placed=[...locked]; const chosen=[];
  for(const original of movable){
    if(original.day&&original.time){
      const rs=hardReasons(db,original,placed,rules);
      if(!rs.length){placed.push(original);continue;}
    }
    const candidates=candidateSlots(db,{...original,day:'',time:''},placed,rules);
    let best=null;
    for(const c of candidates){
      const p=softPenalty(db,c,placed,rules,profile);
      const tie=((Number(c.id||0)+seed*17+DAY_INDEX.get(c.day)*7+mins(c.time))%97)/1000;
      const score=100-p+tie;
      if(!best||score>best.score)best={c,score};
    }
    if(best){placed.push(best.c);chosen.push(best.c)}else chosen.push({...original,day:'',time:''});
  }
  // Final repair pass: a later placement can invalidate an earlier greedy choice
  // (notably cross-branch travel/shared-resource constraints). Re-evaluate the full
  // schedule and move only unlocked activities when a valid slot exists.
  for(let pass=0; pass<3; pass++) {
    let changed=false;
    for(let i=0;i<placed.length;i++) {
      const current=placed[i];
      if(current.locked) continue;
      const others=placed.filter((_,idx)=>idx!==i);
      const rs=hardReasons(db,current,others,rules);
      if(!rs.length) continue;
      const candidates=candidateSlots(db,{...current,day:'',time:''},others,rules);
      if(!candidates.length) continue;
      let best=null;
      for(const c of candidates) {
        const p=softPenalty(db,c,others,rules,profile);
        if(!best || p<best.penalty) best={c,penalty:p};
      }
      if(best) { placed[i]={...current,...best.c}; changed=true; }
    }
    if(!changed) break;
  }
  const evalr=evaluate(db,placed,rules); const issues=[];
  for(const x of chosen.filter(x=>!x.day||!x.time)){
    const reasonMap=new Map();
    for(const day of (rules.allowedDays||DEFAULT_DAYS)){
      for(let m=mins(rules.workStart);m<=mins(rules.workEnd)-occupiedDuration(x);m+=Number(rules.slotMinutes||15)){
        const probe={...x,day,time:time(m)};
        for(const r of hardReasons(db,probe,placed,rules)) if(!reasonMap.has(r.code)) reasonMap.set(r.code,r);
      }
    }
    const reasons=[...reasonMap.values()].slice(0,8);
    issues.push({lesson:x,reasons:reasons.length?reasons:[{code:'no_slot',message:'Не найдено допустимое окно при текущих жёстких ограничениях'}],solutions:suggestSolutions(db,x,placed,rules)});
  }
  return {lessons:placed,metrics:{...evalr,score:evalr.quality,profile},profile,issues,locked:locked.length};
}
function suggestSolutions(db,x,placed,rules){const out=[];const original={...x,day:'',time:''};const teacher=entity(db,'teachers',x.teacherId,x.teacher,x.branchId);if(teacher)out.push({type:'teacher',label:'Выбрать другого педагога',candidates:(db.teachers||[]).filter(t=>t.branchId===x.branchId&&t.id!==teacher.id).slice(0,5).map(t=>t.name)});out.push({type:'room',label:'Проверить другой кабинет',candidates:(db.rooms||[]).filter(r=>r.branchId===x.branchId).map(r=>r.name).slice(0,8)});out.push({type:'time',label:'Расширить рабочее окно',current:`${rules.workStart}–${rules.workEnd}`});out.push({type:'availability',label:'Освободить один из запрещённых интервалов'});return out;}
function generateVariants(db,seed=0,profiles){const all=['balanced','teacher','group','room','minimalGaps','minimalMovement','compactDay','fairLoad','branchUtilization','custom'];const selected=Array.isArray(profiles)&&profiles.length?profiles:all;return selected.map((p,i)=>generateVariant(db,p,Number(seed||0)+i+1));}
function conflicts(db,branchId){const ls=(db.lessons||[]).filter(x=>x.branchId===branchId&&x.day&&x.time),out=[];for(let i=0;i<ls.length;i++){const a=ls[i];const rs=hardReasons(db,a,ls.filter(y=>y.id!==a.id),getRules(db)).filter(r=>['teacher_unavailable','group_unavailable','room_unavailable','capacity','room_type','outside_worktime','blocked_slot','teacher_daily_limit','group_daily_limit','max_consecutive','day_forbidden'].includes(r.code));for(const r of rs)out.push({id:`${a.id}:${r.code}`,severity:'critical',a,b:null,resource:r.code,message:r.message});for(let j=i+1;j<ls.length;j++){const b=ls[j];if(!overlap(a,b))continue;for(const [field,label] of [['teacher','Педагог'],['group','Группа'],['room','Кабинет']])if(sameResource(a,b,field,field+'Id'))out.push({id:`${a.id}:${b.id}:${field}`,severity:'critical',a,b,resource:field,message:`${label} назначен одновременно`});}}
  return out;
}
function explain(db,lessonId,branchId){const x=(db.lessons||[]).find(l=>l.id===lessonId&&l.branchId===branchId);if(!x)return null;const rules=getRules(db);const placed=(db.lessons||[]).filter(l=>l.branchId===branchId&&l.id!==lessonId&&l.day&&l.time);const rs=hardReasons(db,x,placed,rules);const variants=candidateSlots(db,{...x,day:'',time:''},placed,rules);return {lesson:x,hardReasons:rs,availableSlots:variants.length,solutions:suggestSolutions(db,x,placed,rules),summary:variants.length?`Доступно ${variants.length} допустимых слотов.`:'Допустимых слотов нет при текущих жёстких ограничениях.'};}
function findSubstitutes(db,lessonId,branchId){const x=(db.lessons||[]).find(l=>l.id===lessonId&&l.branchId===branchId);if(!x)return [];const rules=getRules(db);return (db.teachers||[]).filter(t=>t.branchId===branchId&&t.id!==x.teacherId).map(t=>{const candidate={...x,teacher:t.name,teacherId:t.id};const hard=hardReasons(db,candidate,(db.lessons||[]).filter(l=>l.branchId===branchId&&l.id!==x.id),rules);const sameSpec=!x.subjectId||!t.subjects||t.subjects.includes(x.subjectId)||String(t.spec||'').toLowerCase().includes(String(x.subject||'').toLowerCase());return {teacher:t,eligible:sameSpec&&!hard.length,hardReasons:hard}}).sort((a,b)=>Number(b.eligible)-Number(a.eligible));}
function periodOccurrences(period,startDate,endDate){const out=[];const start=new Date(startDate),end=new Date(endDate);for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)){const day=DEFAULT_DAYS[(d.getDay()+6)%7];if(!period?.days?.length||period.days.includes(day)){if(!(period.exceptions||[]).includes(d.toISOString().slice(0,10)))out.push(d.toISOString().slice(0,10));}}return out;}
function buildPeriodModel(db){db.schedulePeriod=db.schedulePeriod||{name:'Учебный год',start:'2026-09-01',end:'2027-06-30',weeksMode:'weekly',holidays:[],specialDates:[],exceptions:[]};return db.schedulePeriod;}

// Minimal XLSX reader/writer: uncompressed ZIP parts, with DEFLATE read via browser DecompressionStream.
const XML_ESCAPE=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
function crc32(bytes){let table=crc32.table;if(!table){table=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xEDB88320^(c>>>1):c>>>1;table[n]=c>>>0}crc32.table=table}let c=0xffffffff;for(const b of bytes)c=table[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function u16(a,o){return a[o]|a[o+1]<<8} function u32(a,o){return (a[o]|a[o+1]<<8|a[o+2]<<16|a[o+3]<<24)>>>0}
function zipParts(bytes){const out={};let e=-1;for(let i=bytes.length-22;i>=0;i--){if(u32(bytes,i)===0x06054b50){e=i;break}}if(e<0)throw Error('Не найден ZIP-каталог XLSX');const count=u16(bytes,e+10),cdSize=u32(bytes,e+12),cdOff=u32(bytes,e+16);let p=cdOff;for(let n=0;n<count;n++){if(u32(bytes,p)!==0x02014b50)break;const method=u16(bytes,p+10),cs=u32(bytes,p+20),us=u32(bytes,p+24),nl=u16(bytes,p+28),el=u16(bytes,p+30),cl=u16(bytes,p+32),off=u32(bytes,p+42);const name=new TextDecoder().decode(bytes.slice(p+46,p+46+nl));const lh=off,ln=u16(bytes,lh+26),le=u16(bytes,lh+28),start=lh+30+ln+le;const raw=bytes.slice(start,start+cs);out[name]={method,raw,uncompressedSize:us};p+=46+nl+el+cl}return out;}
async function unzipPart(part){if(part.method===0)return part.raw;if(part.method===8&&typeof DecompressionStream==='function'){const ds=new DecompressionStream('deflate-raw');return new Uint8Array(await new Response(new Blob([part.raw]).stream().pipeThrough(ds)).arrayBuffer())}throw Error('Этот XLSX использует неподдерживаемое сжатие.');}
function xmlText(node){return (node?.textContent||'').trim()}
async function readXLSX(file){const bytes=new Uint8Array(await file.arrayBuffer());const parts=zipParts(bytes);const sharedPart=parts['xl/sharedStrings.xml'];const shared=sharedPart?xmlTextArray(await unzipPart(sharedPart)):[];const wb=new DOMParser().parseFromString(new TextDecoder().decode(await unzipPart(parts['xl/workbook.xml'])),'application/xml');const rels=new DOMParser().parseFromString(new TextDecoder().decode(await unzipPart(parts['xl/_rels/workbook.xml.rels'])),'application/xml');const sheets=[...wb.getElementsByTagNameNS('*','sheet')];const out=[];for(const sh of sheets){const rid=sh.getAttribute('r:id')||sh.getAttribute('id');const rel=[...rels.getElementsByTagNameNS('*','Relationship')].find(r=>r.getAttribute('Id')===rid);let target=rel?.getAttribute('Target')||'';target=target.replace(/^\//,'').replace(/^xl\//,'xl/');if(!target.startsWith('xl/'))target='xl/'+target.replace(/^\.\//,'');const part=parts[target]||parts['xl/'+target];if(!part)continue;const doc=new DOMParser().parseFromString(new TextDecoder().decode(await unzipPart(part)),'application/xml');const rows=[...doc.getElementsByTagNameNS('*','row')].map(row=>{const cells={};[...row.getElementsByTagNameNS('*','c')].forEach(c=>{const ref=c.getAttribute('r')||'';const col=(ref.match(/[A-Z]+/)||[''])[0];const t=c.getAttribute('t');const v=c.getElementsByTagNameNS('*','v')[0];const inline=c.getElementsByTagNameNS('*','t')[0];let value=inline?xmlText(inline):xmlText(v);if(t==='s')value=shared[Number(value)]??value;cells[col]=value});return cells});const max=Math.max(0,...rows.map(r=>Object.keys(r).reduce((m,k)=>Math.max(m,colNumber(k)),0)));out.push({name:sh.getAttribute('name')||'Лист',rows:rows.map(r=>Array.from({length:max+1},(_,i)=>r[colName(i)]??''))});}return out;}
function colName(n){let s='';do{s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26)-1}while(n>=0);return s}function colNumber(s){let n=0;for(const c of s)n=n*26+c.charCodeAt(0)-64;return n-1}
function xmlTextArray(bytes){const doc=new DOMParser().parseFromString(new TextDecoder().decode(bytes),'application/xml');return [...doc.getElementsByTagNameNS('*','si')].map(si=>xmlText(si));}
function makeZip(parts){const enc=new TextEncoder(),files=[],central=[];let offset=0;for(const [name,text] of parts){const nb=enc.encode(name),data=enc.encode(text),head=new Uint8Array(30+nb.length);const dv=new DataView(head.buffer);dv.setUint32(0,0x04034b50,true);dv.setUint16(4,20,true);dv.setUint16(8,0,true);dv.setUint32(14,crc32(data),true);dv.setUint32(18,data.length,true);dv.setUint32(22,data.length,true);dv.setUint16(26,nb.length,true);head.set(nb,30);files.push(head,data);const ch=new Uint8Array(46+nb.length);const cv=new DataView(ch.buffer);cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint32(16,crc32(data),true);cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);cv.setUint16(28,nb.length,true);cv.setUint32(42,offset,true);ch.set(nb,46);central.push(ch);offset+=head.length+data.length;}const csize=central.reduce((s,x)=>s+x.length,0),coff=offset;const end=new Uint8Array(22),dv=new DataView(end.buffer);dv.setUint32(0,0x06054b50,true);dv.setUint16(8,central.length,true);dv.setUint16(10,central.length,true);dv.setUint32(12,csize,true);dv.setUint32(16,coff,true);return concat([...files,...central,end]);}
function concat(arr){const n=arr.reduce((s,a)=>s+a.length,0),o=new Uint8Array(n);let p=0;for(const a of arr){o.set(a,p);p+=a.length}return o;}
function makeXlsx(rows,sheetName='Расписание'){const heads=rows.length?Object.keys(rows[0]):['День','Время','Продолжительность','Занятие','Группа','Педагог','Кабинет'];const data=[heads,...rows.map(r=>heads.map(h=>r[h]??''))];const cols=data.map((row,i)=>`<row r="${i+1}">${row.map((v,j)=>`<c r="${colName(j)}${i+1}" t="inlineStr"><is><t>${XML_ESCAPE(v)}</t></is></c>`).join('')}</row>`).join('');const sheet=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${cols}</sheetData></worksheet>`;const safe=String(sheetName).replace(/[\[\]\*\?\\\/:]/g,' ').slice(0,31)||'Расписание';const wb=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${XML_ESCAPE(safe)}" sheetId="1" r:id="rId1"/></sheets></workbook>`;const rel=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;const root=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;const types=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`;return makeZip([['_rels/.rels',root],['[Content_Types].xml',types],['xl/workbook.xml',wb],['xl/_rels/workbook.xml.rels',rel],['xl/worksheets/sheet1.xml',sheet]]);}

const SchedulingEngine={clone,mins,time,occupiedDuration,end,overlap,getRules,hardReasons,softPenalty,evaluate,candidateSlots,generateVariant,generateVariants,conflicts,explain,findSubstitutes,periodOccurrences,buildPeriodModel,readXLSX,makeXlsx,PRIORITY_WEIGHT};
if(typeof module!=='undefined'&&module.exports)module.exports=SchedulingEngine;
if(typeof window!=='undefined')window.SchedulingEngine=SchedulingEngine;
})();
