'use strict';
const fs=require('fs');
const os=require('os');
const path=require('path');
const {spawnSync}=require('child_process');
const electronPath=require('electron');

const root=__dirname;
const userData=path.join(os.tmpdir(),'grafix-4.1-ui-acceptance');
const resultFile=path.join(userData,'ui-acceptance-result.json');
fs.rmSync(userData,{recursive:true,force:true});
fs.mkdirSync(userData,{recursive:true});

function run(phase){
  const env={...process.env,GRAFIX_UI_ACCEPTANCE:'1',GRAFIX_UI_ACCEPTANCE_DATA:userData,GRAFIX_UI_ACCEPTANCE_RESULT:resultFile};
  const r=spawnSync(electronPath,[root,`--ui-${phase}`],{cwd:root,env,encoding:'utf8',timeout:120000,stdio:'pipe'});
  if(r.error) throw r.error;
  if(r.status!==0) throw new Error(`Electron UI ${phase} exited with ${r.status}\nSTDOUT:\n${r.stdout}\nSTDERR:\n${r.stderr}`);
  if(!fs.existsSync(resultFile)) throw new Error(`UI ${phase} did not produce result file.`);
  const data=JSON.parse(fs.readFileSync(resultFile,'utf8'));
  if(!data.ok) throw new Error(`UI ${phase} failed: ${data.error||'unknown error'}`);
  return data;
}
const write=run('write');
if(!write.summary?.backup||!write.summary?.restore) throw new Error('Backup/restore E2E did not pass.');
if(!write.summary?.exports) throw new Error('Packaged export E2E did not pass.');
if(Number(write.summary?.importedCount||0)<1) throw new Error('Import E2E did not add any activity.');
if(!write.summary?.history?.tested||!write.summary?.history?.undo||!write.summary?.history?.redo) throw new Error('Undo/redo E2E did not pass.');
const read=run('read');
if(!write.summary?.history?.tested||!write.summary?.history?.undo||!write.summary?.history?.redo) throw new Error('Undo/redo E2E did not pass.');
if(!Array.isArray(write.summary?.exportFiles)||write.summary.exportFiles.length<7) throw new Error('Expected export evidence list missing.');
if(read.version!=='4.1.2') throw new Error(`Unexpected app version: ${read.version}`);
if(read.data?.organization?.name!=='Grafix 4.1 UI E2E') throw new Error('Organization did not persist.');
for(const key of ['branches','teachers','people','rooms','lessons','activities','resources','constraints']) {
  if(!Array.isArray(read.data[key])||!read.data[key].length) throw new Error(`Persisted ${key} missing.`);
}
if(!read.ui?.constraintStudio || !read.ui?.advisor || !read.ui?.activities || !read.ui?.substitutions) throw new Error('Required 4.1 UI views were not rendered.');
console.log('Electron UI acceptance: PASS');
console.log(JSON.stringify({write:write.summary,read:read.summary},null,2));
