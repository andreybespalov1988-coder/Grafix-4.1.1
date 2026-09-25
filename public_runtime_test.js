'use strict';
const fs=require('fs');
const vm=require('vm');
const source=fs.readFileSync('index.html','utf8');
const script=source.match(/<script>([\s\S]*?)<\/script>/)?.[1];
if(!script) throw new Error('renderer script missing');
function extract(name,nextName){
  let start=script.indexOf(`function ${name}(`); if(start<0) start=script.indexOf(`async function ${name}(`);
  if(start<0)throw new Error(`function ${name} missing`);
  let end=-1; if(nextName){const a=script.indexOf(`function ${nextName}(`,start+1);const b=script.indexOf(`async function ${nextName}(`,start+1);end=(a<0?b:(b<0?a:Math.min(a,b)));}else end=script.length;
  if(end<0)throw new Error(`boundary ${nextName} missing`);
  return script.slice(start,end);
}
const needed=[
  extract('refreshPublicGroupFilter','buildPublicRows'),
  extract('buildPublicRows','publicData'),
  extract('publicData','renderPublicPreview'),
  extract('renderPublicPreview','publicDayMarkup'),
  extract('publicDayMarkup','buildPublicEmbed'),
  script.slice(script.indexOf('async function buildPublicEmbed('),script.indexOf('async function copyPublicCode('))
].join('\n');
const elements={
  publicBranchMode:{value:'active'},publicPeriod:{value:'all'},publicGroup:{value:''},publicFilters:{checked:true},
  publicPreview:{innerHTML:'',querySelectorAll(){return[]}},publicStatus:{textContent:'',className:''},publicEmbedCode:{value:''}
};
const document={
  getElementById(id){return elements[id]||null;},
  querySelectorAll(){return[];}
};
const db={
  organization:{name:'Тестовая организация',tagline:'Расписание',address:'Адрес',phone:'+7',email:'test@example.ru',website:'',logoDataUrl:'',accent:'#7b1113'},
  branches:[{id:1,name:'Основной филиал'}],
  lessons:[
    {id:1,branchId:1,day:'Понедельник',time:'09:00',duration:60,title:'Вокал',group:'Группа А',teacher:'Петров',room:'101'},
    {id:2,branchId:1,day:'Вторник',time:'10:15',duration:45,title:'Танцы',group:'Группа А',teacher:'Иванова',room:'102'}
  ]
};
const DAYS=['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];
const activeBranchId=1;
function organization(){return db.organization;}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function formatEnd(time,duration){const p=time.split(':').map(Number);const m=p[0]*60+p[1]+Number(duration||0);return String(Math.floor(m/60)%24).padStart(2,'0')+':'+String(m%60).padStart(2,'0')}
const context={console,document,db,DAYS,activeBranchId,organization,esc,formatEnd,CompressionStream,DecompressionStream,TextEncoder,TextDecoder,Response,Blob,btoa,atob,Uint8Array,Math,JSON,String,Number,Date,setTimeout,clearTimeout};
vm.runInNewContext(needed,context,{filename:'index.html:public-runtime'});
(async()=>{
  const ok=await context.buildPublicEmbed();
  if(!ok)throw new Error('buildPublicEmbed returned empty');
  if(!elements.publicEmbedCode.value.includes('<div id="grafix-schedule"></div>'))throw new Error('Tilda code was not written');
  if(!elements.publicEmbedCode.value.includes('DecompressionStream'))throw new Error('compressed renderer missing');
  if(elements.publicEmbedCode.value.includes('g-days')||elements.publicEmbedCode.value.includes('data-p=\"'))throw new Error('weekday switcher must not be present in Tilda code');
  const generatedScript=elements.publicEmbedCode.value.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  if(!generatedScript)throw new Error('generated Tilda script missing');
  new Function(generatedScript);

  context.CompressionStream=undefined;
  const fallback=await context.buildPublicEmbed();
  if(!fallback || !elements.publicEmbedCode.value.includes('grafix-schedule'))throw new Error('UTF-8 Base64 fallback generation failed');
  if(!elements.publicPreview.innerHTML.includes('Вокал'))throw new Error('preview did not render lesson data');
  if(!/Сформировано занятий: 2/.test(elements.publicStatus.textContent))throw new Error('public status count incorrect');
  db.lessons=[];
  const empty=await context.buildPublicEmbed();
  if(!empty || !elements.publicEmbedCode.value.includes('grafix-schedule'))throw new Error('Tilda code must still be generated for an empty publication set');
  if(!elements.publicPreview.innerHTML.includes('Предпросмотр пока пуст'))throw new Error('empty preview state missing');
  console.log('Public runtime generation test passed.');
})().catch(error=>{console.error(error);process.exit(1)});
