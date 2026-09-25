'use strict';
const assert=require('assert');const S=require('./substitution-engine');
const db={lessons:[{id:1,branchId:1,title:'Lesson',group:'G',groupId:1,teacher:'A',teacherId:10,room:'R',roomId:20,duration:60,day:'Понедельник',time:'10:00'}],teachers:[{id:10,branchId:1,name:'A',spec:'Math',subjects:['Math'],unavailable:[]},{id:11,branchId:1,name:'B',spec:'Math',subjects:['Math'],unavailable:[],travelMinutes:10}],rooms:[],people:[],history:[],substitutions:[],notifications:[]};
const candidates=S.findCandidates(db,1);assert(candidates.some(x=>x.teacher.id===11&&x.eligible));
const plan=S.createPlan(db,1,11,{type:'temporary',effectiveDate:'2026-09-15',reason:'absence'});db.substitutions.push(plan);assert.strictEqual(S.history(db).length,1);const approved=S.approvePlan(db,plan.id,{approvedBy:'QA'});assert.strictEqual(approved.plan.status,'approved');assert.strictEqual(db.notifications.length,1);
const moved=S.moveLesson(db,1,{day:'Вторник',time:'11:00'});assert.strictEqual(moved.after.day,'Вторник');
const split=S.splitLesson(db,1,2);assert.strictEqual(split.length,2);const merged=S.mergeLessons(db,split.map(x=>x.id));assert(merged.duration>=60);
console.log('Substitution 2.0 lifecycle: PASS');
