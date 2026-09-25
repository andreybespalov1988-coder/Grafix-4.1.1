'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createStorageManager } = require('./storage-manager');

function assert(condition, message) { if (!condition) throw new Error(message); }
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'schedule-studio-protocol-'));
try {
  const storage = createStorageManager({userDataPath:dir});
  const db1 = {organization:{name:'Async 1'},branches:[{id:1,name:'Branch 1'}],teachers:[],rooms:[],people:[],lessons:[]};
  const db2 = {organization:{name:'Async 2'},branches:[{id:2,name:'Branch 2'}],teachers:[],rooms:[],people:[],lessons:[]};
  const db3 = {organization:{name:'Shutdown final'},branches:[{id:3,name:'Final Branch'}],teachers:[],rooms:[],people:[],lessons:[]};
  const payload = (data, revision) => ({version:'2.0.2',revision,savedAt:new Date().toISOString(),activeBranchId:data.branches[0].id,data});

  storage.persist(payload(db1,1));
  storage.persist(payload(db2,2));
  const shutdown = storage.persist(payload(db3,3));
  assert(shutdown.ok && shutdown.revision === 3, 'shutdown revision 3 did not persist');

  // Simulate an already queued stale async write arriving after shutdown.
  const stale = storage.persist(payload(db2,2));
  assert(stale.skipped, 'stale async save was accepted after shutdown');
  const saved = JSON.parse(fs.readFileSync(storage.paths.file,'utf8'));
  assert(saved.revision===3 && saved.data.organization.name==='Shutdown final', 'stale async save overwrote final shutdown state');

  console.log('IPC persistence protocol test passed.');
} finally {
  fs.rmSync(dir,{recursive:true,force:true});
}
