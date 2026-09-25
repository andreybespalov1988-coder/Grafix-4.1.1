'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createStorageManager } = require('./storage-manager');

function assert(condition, message) { if (!condition) throw new Error(message); }
function envelope(data, revision) {
  return {version:'2.0.2',revision,savedAt:new Date().toISOString(),activeBranchId:data.branches[0].id,data};
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'schedule-studio-storage-'));
try {
  const storage = createStorageManager({userDataPath:dir});
  const first = {organization:{name:'A'},branches:[{id:1,name:'A'}],teachers:[],rooms:[],people:[],lessons:[]};
  const second = {organization:{name:'B'},branches:[{id:2,name:'B'}],teachers:[],rooms:[],people:[],lessons:[]};
  const third = {organization:{name:'C'},branches:[{id:3,name:'C'}],teachers:[],rooms:[],people:[],lessons:[]};

  assert(storage.persist(envelope(first,1)).ok, 'revision 1 save failed');
  assert(storage.persist(envelope(second,3)).ok, 'revision 3 save failed');
  const stale = storage.persist(envelope(third,2));
  assert(stale.skipped, 'stale revision was not skipped');
  assert(JSON.parse(fs.readFileSync(storage.paths.file,'utf8')).revision === 3, 'stale revision overwrote revision 3');

  // Restart: a new storage manager must preserve the revision and data.
  const reopened = createStorageManager({userDataPath:dir});
  const loaded = reopened.load();
  assert(loaded.ok && loaded.data.revision === 3, 'restart did not load latest revision');
  assert(loaded.data.data.organization.name === 'B', 'restart loaded wrong organization');

  // Backup recovery: corrupt primary while keeping a valid backup.
  const backupPayload = envelope({organization:{name:'Backup'},branches:[{id:8,name:'Backup'}],teachers:[],rooms:[],people:[],lessons:[]},4);
  fs.writeFileSync(reopened.paths.backup, JSON.stringify(backupPayload), 'utf8');
  fs.writeFileSync(reopened.paths.file, '{broken-json', 'utf8');
  const recoveredManager = createStorageManager({userDataPath:dir});
  const recovered = recoveredManager.load();
  assert(recovered.ok && recovered.recovered, 'backup recovery did not trigger');
  assert(recovered.data.data.organization.name === 'Backup', 'backup data was not restored');
  assert(JSON.parse(fs.readFileSync(recoveredManager.paths.file,'utf8')).data.organization.name === 'Backup', 'primary file was not repaired from backup');

  // Interrupted-write artifact must not become a data source on restart.
  fs.writeFileSync(recoveredManager.paths.file+'.999.tmp', '{partial', 'utf8');
  const afterTemp = createStorageManager({userDataPath:dir}).load();
  assert(afterTemp.ok && afterTemp.data.data.organization.name === 'Backup', 'stray temp file affected recovery');

  // Legacy bare-DB migration.
  const legacyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'schedule-studio-legacy-'));
  try {
    const legacyFile = path.join(legacyDir,'schedule-studio-data.json');
    fs.writeFileSync(legacyFile, JSON.stringify({organization:{name:'Legacy'},branches:[{id:11,name:'Legacy'}],teachers:[],rooms:[],people:[],lessons:[]}), 'utf8');
    const legacyStorage = createStorageManager({userDataPath:legacyDir});
    const legacyLoaded = legacyStorage.load();
    assert(legacyLoaded.data.revision === 0, 'legacy bare DB revision should start at 0');
    assert(legacyLoaded.data.data.organization.name === 'Legacy', 'legacy DB content changed');
  } finally { fs.rmSync(legacyDir,{recursive:true,force:true}); }

  console.log('Storage tests passed.');
} finally {
  fs.rmSync(dir,{recursive:true,force:true});
}
