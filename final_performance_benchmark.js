'use strict';
const E=require('./scheduling-engine');
const C=require('./constraint-studio');
const crypto=require('crypto');
const DAY=['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];
function make(n){
 const db={activeBranchId:1,branches:[{id:1,name:'Main'},{id:2,name:'Branch 2'}],teachers:[],rooms:[],people:[],lessons:[],activities:[],resources:[],constraints:[],substitutions:[],notifications:[],scheduleRules:{workStart:'09:00',workEnd:'21:00',slotMinutes:30,maxTeacherDailyMinutes:480,maxGroupDailyMinutes:240,maxConsecutiveMinutes:180,allowedDays:DAY,blockedSlots:[],organizationWide:true,softConstraints:{avoidLate:{enabled:true,after:'20:00',priority:'medium'},compact:{enabled:true,priority:'medium'},avoidGaps:{enabled:true,priority:'medium'}}}};
 const teachers=Math.max(5,Math.ceil(n/10)), rooms=Math.max(5,Math.ceil(n/10));
 for(let i=1;i<=teachers;i++) db.teachers.push({id:i,branchId:i%2?1:2,name:'T'+i,travelMinutes:15});
 for(let i=1;i<=rooms;i++) db.rooms.push({id:i,branchId:i%2?1:2,name:'R'+i,capacity:30,type:'Universal'});
 for(let i=1;i<=n;i++){const branchId=i%2?1:2;const tid=((i-1)%teachers)+1,rid=((i-1)%rooms)+1;db.people.push({id:i,branchId,name:'G'+i,group:'G'+i});db.lessons.push({id:i,branchId,title:'L'+i,group:'G'+i,groupId:i,teacher:'T'+tid,teacherId:tid,room:'R'+rid,roomId:rid,duration:60,activeMinutes:60,setupMinutes:i%10===0?10:0,locked:false});}
 return db;
}
function now(){return process.hrtime.bigint();}
function ms(a,b){return Number(b-a)/1e6;}
function measure(name,fn){global.gc?.();const h0=process.memoryUsage().rss;const t=now();const value=fn();const elapsed=ms(t,now());const rssDelta=(process.memoryUsage().rss-h0)/1048576;return {name,ms:Math.round(elapsed*10)/10,rssDeltaMb:Math.round(rssDelta*10)/10,value};}
const rows=[];
for(const n of [10,30,50,100,200,500]){
 const db=make(n);
 const algorithm=measure('algorithm',()=>E.generateVariant(db,'balanced',1));
 const validation=measure('constraint_validation',()=>{for(const x of db.lessons.slice(0,Math.min(200,db.lessons.length)))C.evaluateActivity(db,x,{lessons:db.lessons});return true;});
 const advisor=measure('advisor',()=>E.generateVariant(db,'balanced',1) && require('./schedule-advisor').analyze(db,{organizationWide:true}));
 const exported=measure('xlsx_export',()=>E.makeXlsx(db.lessons.slice(0,Math.min(500,db.lessons.length)).map(x=>({id:x.id,day:x.day||'',time:x.time||'',duration:x.duration,title:x.title,group:x.group,teacher:x.teacher,room:x.room}))));
 rows.push({activities:n,algorithmMs:algorithm.ms,algorithmRssMb:algorithm.rssDeltaMb,completion:algorithm.value.metrics?.completion,hardViolations:algorithm.value.metrics?.hardConflicts,quality:algorithm.value.metrics?.quality,constraintValidationMs:validation.ms,advisorMs:advisor.ms,advisorProblems:advisor.value?.problemLessons?.length,xlsxExportMs:exported.ms,xlsxBytes:exported.value?.byteLength||0});
 console.log(JSON.stringify(rows[rows.length-1]));
}
console.log('FINAL PERFORMANCE BENCHMARK: PASS');
