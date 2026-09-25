'use strict';
const assert=require('assert');
const C=require('./constraint-studio');
const db={branches:[{id:1}],constraints:[],lessons:[
  {id:1,branchId:1,title:'A',day:'Понедельник',time:'10:00',duration:60,teacherId:10,groupId:20,roomId:30},
  {id:2,branchId:1,title:'B',day:'Понедельник',time:'11:00',duration:60,teacherId:11,groupId:21,roomId:31}
]};
C.create(db,{id:1,name:'A before B',target:'relationship',kind:'before',hardness:'HARD',value:{otherId:2}});
let r=C.evaluateActivity(db,db.lessons[0],{lessons:db.lessons}); assert.strictEqual(r.hardViolations,0);
r=C.evaluateActivity(db,{...db.lessons[0],time:'12:00'},{lessons:db.lessons}); assert.strictEqual(r.hardViolations,1);
C.create(db,{id:2,name:'same room',target:'relationship',kind:'same_room',hardness:'HARD',value:{otherId:2}});
r=C.evaluateActivity(db,db.lessons[0],{lessons:db.lessons}); assert.strictEqual(r.hardViolations,1);
C.update(db,2,{hardness:'SOFT',weight:17}); r=C.evaluateActivity(db,db.lessons[0],{lessons:db.lessons}); assert.strictEqual(r.softPenalty,17);
console.log('Constraint Studio relationship rules: PASS');
