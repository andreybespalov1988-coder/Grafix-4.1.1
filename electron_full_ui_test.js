'use strict';
const fs=require('fs');const os=require('os');const path=require('path');const {spawn}=require('child_process');const electronPath=require('electron');
const root=__dirname;const userData=path.join(os.tmpdir(),'grafix-4.1-full-ui-test');const port=9334;
const views=['dashboard','schedule','calendar','planner','conflicts','constraints','advisor','activities','substitutions','public','reports','people','teachers','rooms','analytics','settings','ai'];
fs.rmSync(userData,{recursive:true,force:true});fs.mkdirSync(userData,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function evalCdp(tab,expression){const ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});let timer;const out=await new Promise((resolve,reject)=>{const id=1;const onMessage=e=>{const data=JSON.parse(e.data);if(data.id===id){ws.removeEventListener('message',onMessage);clearTimeout(timer);resolve(data);}};ws.addEventListener('message',onMessage);ws.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression,awaitPromise:true,returnByValue:true}}));timer=setTimeout(()=>{ws.removeEventListener('message',onMessage);reject(new Error('CDP evaluation timeout'));},30000);});ws.close();if(out?.result?.exceptionDetails)throw new Error(out.result.exceptionDetails.exception?.description||out.result.exceptionDetails.text||'Renderer evaluation failed');return out?.result?.result?.value;}
(async()=>{
 const child=spawn(electronPath,[root,'--user-data-dir='+userData,'--remote-debugging-port='+port],{cwd:root,env:{...process.env,GRAFIX_UI_ACCEPTANCE:'0',GRAFIX_UI_ACCEPTANCE_DATA:userData},stdio:['ignore','pipe','pipe']});
 let stderr='';child.stderr.on('data',d=>stderr+=String(d));
 try{
  let tab=null;for(let i=0;i<120;i++){try{const tabs=await fetch('http://127.0.0.1:'+port+'/json').then(r=>r.json());tab=tabs.find(t=>t.type==='page');if(tab)break;}catch(_){}await sleep(250);}
  if(!tab)throw new Error('Renderer tab did not start. '+stderr);
  const expression='(async()=>{for(let i=0;i<120&&!window.dteDataReady;i++)await new Promise(r=>setTimeout(r,50));if(!window.dteDataReady)throw new Error("dteDataReady timeout");const views=VIEWS_JSON;const results=[];for(const v of views){showView(v);await new Promise(r=>setTimeout(r,80));const el=document.getElementById(v);results.push({view:v,active:el?.classList.contains("active"),exists:!!el,text:(el?.innerText||"").trim().slice(0,140)});}return results;})()'.replace('VIEWS_JSON',JSON.stringify(views));
  const result=await evalCdp(tab,expression);
  const bad=result.filter(x=>!x.exists||!x.active);if(bad.length)throw new Error('Broken views: '+JSON.stringify(bad));
  console.log('Electron full UI view sweep: PASS');console.log(JSON.stringify(result,null,2));
 }finally{child.kill();await sleep(300);fs.rmSync(userData,{recursive:true,force:true});}
})().catch(error=>{console.error(error.stack||error.message);process.exit(1)});