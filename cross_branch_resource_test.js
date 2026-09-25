'use strict';
const assert=require('assert');
const E=require('./scheduling-engine');
const db={activeBranchId:1,branches:[{id:1},{id:2}],teachers:[{id:10,branchId:1,name:'T',travelMinutes:30}],people:[{id:20,branchId:1,name:'G1'},{id:21,branchId:2,name:'G2'}],rooms:[{id:30,branchId:1,name:'R1'},{id:31,branchId:2,name:'R2'}],resources:[{id:40,type:'equipment',name:'Mixer',shared:true,branchIds:[1,2]}],lessons:[
{id:1,branchId:1,title:'B1',teacher:'T',teacherId:10,group:'G1',groupId:20,room:'R1',roomId:30,duration:60,day:'Понедельник',time:'10:00',equipmentIds:[40]},
{id:2,branchId:2,title:'B2',teacher:'T',teacherId:10,group:'G2',groupId:21,room:'R2',roomId:31,duration:60,day:'Понедельник',time:'10:00',equipmentIds:[40]}
],scheduleRules:{workStart:'09:00',workEnd:'21:00',slotMinutes:30,allowedDays:['Понедельник'],maxTeacherDailyMinutes:480,maxGroupDailyMinutes:480,maxConsecutiveMinutes:300,organizationWide:true,blockedSlots:[],softConstraints:{}}};
const r=E.hardReasons(db,db.lessons[1],db.lessons, E.getRules(db));
assert(r.some(x=>x.code==='cross_branch_teacher')||r.some(x=>x.code==='teacher_overlap'));
assert(r.some(x=>x.code==='shared_resource_overlap'));
console.log('Cross-branch/shared-resource conflicts: PASS');
