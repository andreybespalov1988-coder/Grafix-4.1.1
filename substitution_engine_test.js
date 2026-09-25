'use strict';
const assert=require('assert');
const S=require('./substitution-engine');
const db={lessons:[{id:1,branchId:1,title:'Урок',group:'A',groupId:20,teacher:'Иванов',teacherId:10,room:'R',roomId:30,duration:60,day:'Вторник',time:'12:00'}],teachers:[{id:10,branchId:1,name:'Иванов',spec:'Вокал',unavailable:[]},{id:11,branchId:1,name:'Петров',spec:'Вокал',unavailable:[]}],rooms:[{id:30,branchId:1,name:'R'}],people:[{id:20,branchId:1,name:'A'}],history:[]};
const c=S.findCandidates(db,1);assert.strictEqual(c[0].teacher.id,11);assert.strictEqual(c[0].eligible,true);
const p=S.createPlan(db,1,11,{type:'temporary',effectiveDate:'2026-09-15'});S.ensureSubstitutions(db).push(p);const out=S.approvePlan(db,p.id,{approvedBy:'QA'});assert.strictEqual(out.lesson.teacherId,11);assert.strictEqual(out.plan.status,'approved');assert(db.history.length===1);assert(db.notifications.length===1);assert(db.notifications[0].type==='substitution-approved');
console.log('Substitution 2.0: PASS');
