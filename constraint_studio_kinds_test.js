'use strict';
const assert=require('assert');
const C=require('./constraint-studio');
const db={branches:[{id:1}],constraints:[],activities:[{id:1,branchId:1,day:'Понедельник',time:'10:00',duration:60,activeMinutes:60,setupMinutes:10,teardownMinutes:5,callMinutes:5,travelMinutes:15,recurrence:{type:'weekly'} }],lessons:[],teachers:[],people:[],rooms:[]};
const add=(kind,value)=>C.create(db,{name:kind,target:'activity',targetId:1,kind,hardness:'HARD',value});
add('setup_time',{min:20}); add('active_time',{min:60}); add('teardown_time',{min:10}); add('call_time',{min:10}); add('travel_time',{min:20}); add('recurrence',{recurrence:{type:'weekly',weeks:[1,2]}}); C.create(db,{name:'Room capacity',target:'room',targetId:5,kind:'capacity',hardness:'HARD',value:{capacity:30}});
const r=C.evaluateActivity(db,db.activities[0],{lessons:[]});
assert.strictEqual(r.hardViolations,5);
console.log('Constraint Studio extended kinds: PASS');
