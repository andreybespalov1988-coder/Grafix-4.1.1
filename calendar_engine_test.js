'use strict';const assert=require('assert');const C=require('./calendar-engine');
const p={start:'2026-09-01',end:'2026-09-30',weeksMode:'weekly',exceptions:{'2026-09-14':{type:'cancel'},'2026-09-21':{type:'workday'}}};
const dates=C.occurrenceDates(p,{day:'Понедельник'});assert(dates.some(x=>x.date==='2026-09-07'));assert(!dates.some(x=>x.date==='2026-09-14'));assert(dates.some(x=>x.date==='2026-09-21'));
const ex=C.addException(p,'2026-09-28',{type:'holiday'});assert.strictEqual(C.classifyDate(ex,'2026-09-28'),'holiday');
const moved=C.addException(p,'2026-09-21',{type:'move',newDate:'2026-09-22',reason:'Перенос'});const xs=C.expandTemplates(moved,[{id:1,day:'Понедельник',time:'18:00',duration:60,title:'A'}]);assert(xs.every(x=>x.instance&&x.templateId===1&&x.date));assert(!xs.some(x=>x.date==='2026-09-21'));assert(xs.some(x=>x.date==='2026-09-22'&&x.movedFrom==='2026-09-21'));
assert.strictEqual(C.classifyDate(moved,'2026-09-21'),'normal');console.log('Calendar Engine: PASS');
