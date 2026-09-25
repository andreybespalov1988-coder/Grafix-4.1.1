'use strict';
const fs=require('fs');
const os=require('os');
const path=require('path');
const {spawnSync}=require('child_process');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'schedule-studio-restart-'));
function run(mode){const r=spawnSync(process.execPath,[path.join(__dirname,'persistence_restart_worker.js'),dir,mode],{encoding:'utf8'});if(r.status!==0)throw new Error(`${mode} failed: ${r.stderr||r.stdout}`);return r.stdout;}
try{
  run('write');
  run('stale');
  const raw=run('read');
  const parsed=JSON.parse(raw);
  if(parsed.revision!==10)throw new Error('new process did not preserve revision 10');
  if(parsed.data.organization.name!=='Restart Organization')throw new Error('new process did not preserve organization');
  if(parsed.activeBranchId!==77)throw new Error('new process did not preserve active branch');
  if(parsed.data.lessons[0].title!=='Restart Lesson')throw new Error('new process did not preserve lesson');
  if(!parsed.data.printSettings?.cardsLayout || parsed.data.printSettings?.fitA4!==false || parsed.data.printSettings?.columns?.[0]?.label!=='Занятие')throw new Error('new process did not preserve print settings');
  console.log('Restart lifecycle test passed.');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
