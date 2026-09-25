'use strict';
const { createStorageManager } = require('./storage-manager');
const fs = require('fs');
const dir = process.argv[2];
const mode = process.argv[3];
if (!dir || !mode) throw new Error('Usage: node persistence_restart_worker.js <dir> <write|read|stale>');
const storage = createStorageManager({userDataPath:dir});
if (mode === 'write') {
  const data={organization:{name:'Restart Organization'},branches:[{id:77,name:'Restart Branch'}],teachers:[{id:78,branchId:77,name:'Restart Teacher'}],rooms:[{id:79,branchId:77,name:'Restart Room'}],people:[{id:80,branchId:77,name:'Restart Group',group:'Restart'}],lessons:[{id:81,branchId:77,title:'Restart Lesson',day:'Пятница',time:'17:00',duration:60,group:'Restart Group',teacher:'Restart Teacher',room:'Restart Room'}],printSettings:{columns:[{key:'title',label:'Занятие',width:'70mm',placement:'table'}],cardsLayout:true,fitA4:false}};
  const r=storage.persist({version:'2.0.2',revision:10,savedAt:new Date().toISOString(),activeBranchId:77,data});
  if(!r.ok)throw new Error('write failed');
} else if(mode==='stale') {
  const data={organization:{name:'STALE'},branches:[{id:77,name:'STALE'}],teachers:[],rooms:[],people:[],lessons:[]};
  const r=storage.persist({version:'2.0.2',revision:9,savedAt:new Date().toISOString(),activeBranchId:77,data});
  if(!r.skipped)throw new Error('stale revision was accepted');
} else if(mode==='read') {
  const r=storage.load();
  if(!r.ok||!r.data)throw new Error('read failed');
  process.stdout.write(JSON.stringify(r.data));
}
