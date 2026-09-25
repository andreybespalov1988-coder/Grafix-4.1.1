'use strict';
const fs=require('fs');
const os=require('os');
const path=require('path');
const {spawn}=require('child_process');
const electronPath=require('electron');

const root=__dirname;
const userData=path.join(os.tmpdir(),'grafix-4.1-ai-ui-test');
const port=9333;
fs.rmSync(userData,{recursive:true,force:true});
fs.mkdirSync(userData,{recursive:true});

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function evaluate(tab,expression){
  const ws=new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  const id=1;
  let timer;
  const out=await new Promise((resolve,reject)=>{
    const onMessage=e=>{const data=JSON.parse(e.data);if(data.id===id){ws.removeEventListener('message',onMessage);clearTimeout(timer);resolve(data);}};
    ws.addEventListener('message',onMessage);
    ws.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression,awaitPromise:true,returnByValue:true}}));
    timer=setTimeout(()=>{ws.removeEventListener('message',onMessage);reject(new Error('CDP evaluation timeout'));},30000);
  });
  ws.close();
  return out?.result?.result?.value;
}

(async()=>{
  const child=spawn(electronPath,[root,'--user-data-dir='+userData,'--remote-debugging-port='+port],{cwd:root,env:{...process.env,GRAFIX_UI_ACCEPTANCE:'0'},stdio:['ignore','pipe','pipe']});
  let stderr='';
  child.stderr.on('data',d=>stderr+=String(d));
  try{
    let tab=null;
    for(let i=0;i<120;i++){
      try{const tabs=await fetch('http://127.0.0.1:'+port+'/json').then(r=>r.json());tab=tabs.find(t=>t.type==='page');if(tab)break;}catch(_){}
      await sleep(250);
    }
    if(!tab)throw new Error('Electron renderer tab did not start. '+stderr);
    const expression="(async()=>{for(let i=0;i<100&&!window.dteDataReady;i++)await new Promise(r=>setTimeout(r,50));showView('ai');await refreshAIStatus();return {appReady:!!window.dteDataReady,nav:!!document.querySelector('[data-view=ai]'),view:!!document.getElementById('ai'),status:document.getElementById('aiStatusBox')?.innerText||'',model:document.getElementById('aiModel')?.innerText||'',sendDisabled:!!document.getElementById('aiSend')?.disabled,aiStatus:await window.dteDesktop.aiStatus()};})()";
    const info=await evaluate(tab,expression);
    if(!info?.appReady||!info.nav||!info.view)throw new Error('AI UI is not present or app is not ready.');
    if(!['no-api-key','ready'].includes(info.aiStatus?.state))throw new Error('Unexpected AI startup state.');
    if(info.aiStatus.state==='no-api-key'&&!info.sendDisabled)throw new Error('Send must be disabled without API key.');
    console.log('Electron AI UI startup/status: PASS');
    console.log(JSON.stringify({nav:info.nav,view:info.view,status:info.status,model:info.model,sendDisabled:info.sendDisabled,state:info.aiStatus.state}));
    if(info.aiStatus.state==='ready'){
      const responseExpression="(async()=>{const input=document.getElementById('aiPrompt');input.value='Reply with the exact token GRAFIX_UI_LLM_OK and nothing else.';await sendAIMessage();return {messages:window.__grafixAI?.messages||[]};})()";
      const reply=await evaluate(tab,responseExpression);
      const last=reply?.messages?.[reply.messages.length-1];
      if(!last||last.role!=='assistant'||!/GRAFIX_UI_LLM_OK/i.test(last.content||''))throw new Error('Real AI response was not received through UI.');
      console.log('Electron AI UI real request/response: PASS');
    }else{
      console.log('Electron AI UI real request/response: NOT TESTED (API key absent)');
    }
  }finally{
    child.kill();
    await sleep(250);
    fs.rmSync(userData,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error.message);process.exit(1)});