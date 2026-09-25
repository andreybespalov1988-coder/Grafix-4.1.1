'use strict';
const assert=require('assert');
const Advisor=require('./schedule-advisor');
const db={activeBranchId:1,branches:[{id:1},{id:2}],teachers:[{id:10,branchId:1,name:'Иванов',unavailable:[]},{id:11,branchId:1,name:'Петров',unavailable:[]}],people:[{id:20,branchId:1,name:'A'}],rooms:[{id:30,branchId:1,name:'R',capacity:20}],lessons:[
{id:1,branchId:1,title:'A',group:'A',groupId:20,teacher:'Иванов',teacherId:10,room:'R',roomId:30,duration:60,day:'Понедельник',time:'10:00',locked:true},
{id:2,branchId:1,title:'B',group:'A',groupId:20,teacher:'Иванов',teacherId:10,room:'R',roomId:30,duration:60,day:'Понедельник',time:'10:00'}
],scheduleRules:{workStart:'09:00',workEnd:'18:00',slotMinutes:60,allowedDays:['Понедельник'],maxTeacherDailyMinutes:360,maxGroupDailyMinutes:240,maxConsecutiveMinutes:180,blockedSlots:[],softConstraints:{}},constraints:[]};
const r=Advisor.analyze(db);
assert.strictEqual(r.status,'CONFLICT');
assert(r.metrics.conflictEdges>=1);
assert(r.minimalConflictSubset.length>=1);
console.log('Schedule Advisor diagnosis: PASS');
