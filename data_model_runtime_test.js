'use strict';
const fs=require('fs'),vm=require('vm');
const html=fs.readFileSync('index.html','utf8');
const script=html.slice(html.indexOf('<script>')+8,html.lastIndexOf('</script>'));
function extract(name){const start=script.indexOf('function '+name+'(');let brace=script.indexOf('{',start),depth=0;for(let i=brace;i<script.length;i++){if(script[i]==='{')depth++;else if(script[i]==='}'&&!--depth)return script.slice(start,i+1)}throw new Error(name)}
const ctx={DAYS:['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'],STORAGE_VERSION:'3.0.0'};
ctx.clone=x=>JSON.parse(JSON.stringify(x));ctx.seed={organization:{name:'Графикс',shortName:'Графикс',tagline:'',address:'',phone:'',email:'',website:'',logoDataUrl:'',accent:'#7b1113'},branches:[{id:1,name:'Основной филиал',address:''}],teachers:[],rooms:[],people:[],lessons:[],printSettings:{columns:[],rowHeights:{},cardsLayout:false,fitA4:true},scheduleRules:{workStart:'09:00',workEnd:'21:00',slotMinutes:15,maxTeacherDailyMinutes:360,maxGroupDailyMinutes:240,maxTeacherGaps:3,preferCompact:true},events:[],history:[]};
vm.runInNewContext(extract('normalize'),ctx);
const raw={organization:{name:'Тест'},branches:[{id:1,name:'Филиал'}],teachers:[{id:10,name:'Педагог',branchId:1,spec:'Вокал'}],rooms:[{id:20,name:'Зал',branchId:1,type:'Зал',capacity:10}],people:[{id:30,name:'Группа А',branchId:1,group:'Вокал'}],lessons:[{id:40,branchId:1,title:'Вокал',group:'Группа А',teacher:'Педагог',room:'Зал',day:'Понедельник',time:'10:00',duration:60}],printSettings:{}};
const d=ctx.normalize(raw);const l=d.lessons[0];if(l.teacherId!==10||l.roomId!==20||l.groupId!==30)throw new Error('structured references not migrated');if(!d.scheduleRules||!Array.isArray(d.history)||!Array.isArray(d.events))throw new Error('3.0 fields missing');console.log('Data-model migration checks passed.');
