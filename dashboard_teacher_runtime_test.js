'use strict';
const fs=require('fs');
const vm=require('vm');
const source=fs.readFileSync('index.html','utf8');
const script=source.match(/<script>([\s\S]*?)<\/script>/)?.[1];
if(!script)throw new Error('renderer script missing');
function extract(name,next){const a=script.indexOf(`function ${name}(`);if(a<0)throw new Error(name+' missing');const b=script.indexOf(`function ${next}(`,a+1);if(b<0)throw new Error(next+' boundary missing');return script.slice(a,b)}
const pieces=[
 extract('renderDashboardDateTime','changeDashboardMonth'),
 extract('changeDashboardMonth','goDashboardToday'),
 extract('teacherUnavailableConflict','renderBranches'),
 extract('conflicts','showView'),
 extract('renderQuality','lessonTemporalStatus')
].join('\n');
const els={dashboardCalendar:{innerHTML:''},dashboardClock:{textContent:''},dashboardClockDate:{textContent:''},quality:{innerHTML:''},qualityTag:{textContent:'',className:''}};
const document={getElementById:id=>els[id]||null,querySelectorAll:()=>[]};
const db={lessons:[{id:1,branchId:1,day:'Понедельник',time:'10:00',duration:60,title:'Урок',teacher:'Иванов',group:'A',room:'1'}],teachers:[{id:2,branchId:1,name:'Иванов',spec:'Вокал',unavailable:[{day:'Понедельник',start:'09:30',end:'11:30'},{day:'Среда',start:'',end:''}]}]};
const activeBranchId=1;const DAYS=['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];
function scoped(k){return db[k].filter(x=>x.branchId===activeBranchId)}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function mins(t){const p=String(t||'00:00').split(':').map(Number);return (p[0]||0)*60+(p[1]||0)}
const dashboardCalendarCursor=new Date(); const context={document,db,activeBranchId,DAYS,scoped,esc,mins,console,Date,String,Number,Math,dashboardCalendarCursor,setInterval:()=>0};
vm.runInNewContext(pieces,context,{filename:'index.html:dashboard-teacher-runtime'});
context.renderDashboardDateTime();
if(!els.dashboardCalendar.innerHTML.includes('dashboard-month-grid'))throw new Error('month calendar not rendered');
if(!els.dashboardCalendar.innerHTML.includes('dashboard-month-title'))throw new Error('month title missing');
if(!context.teacherUnavailableConflict(db.lessons[0],db.teachers[0]))throw new Error('teacher time restriction not detected');
const free={...db.lessons[0],time:'12:00'};
if(context.teacherUnavailableConflict(free,db.teachers[0]))throw new Error('free time incorrectly blocked');
console.log('Dashboard month and teacher availability runtime checks passed.');
