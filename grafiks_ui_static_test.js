const fs=require('fs');
const s=fs.readFileSync('index.html','utf8');
const ai=fs.readFileSync('ai-ui.js','utf8');
const aiService=fs.readFileSync('ai-service.js','utf8');
const required=[
  'dashboardCalendar','dashboardClock','lessonTemporalStatus','is-now','is-past',
  'renderPublicPreview','publicStatus','public-empty','formatEnd(x.time,x.duration)',
  'CompressionStream','DecompressionStream','removeSelectedEditorColumns','removeSelectedEditorRows','resizeEditorColumnValue','resizeEditorRowValue','removeEditorRow',
  'updateEditorSelectionCounts','manager-grid','editor-control-row','size-control','dashboard-datetime','qualityTag','quality'
];
const aiRequired=['AI-помощник','aiPrompt','aiStatusBox','aiSend','sendAIMessage','refreshAIStatus'];
for(const x of aiRequired) if(!ai.includes(x)) throw new Error('Missing AI feature: '+x);
if(!aiService.includes('openrouter/free')) throw new Error('OpenRouter Free model missing from AI service.');
for(const x of required) if(!s.includes(x)) throw new Error('Missing UI feature: '+x);
if(/formatEnd\(x\)\)/.test(s)) throw new Error('Broken public preview formatEnd(x) call remains');

const qualityFn=/function\s+renderQuality\(\)\{([\s\S]*?)\n?\}/.exec(s);
if(!qualityFn) throw new Error('renderQuality definition missing');
if(!qualityFn[1].includes("if(!tag||!root)return")) throw new Error('renderQuality null guard regression');
const defs=new Set([...s.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(m=>m[1]));
const calls=[];
for(const m of s.matchAll(/onclick="([A-Za-z_$][\w$]*)\s*\(/g)) calls.push(m[1]);
const missing=[...new Set(calls.filter(x=>!defs.has(x)))];
if(missing.length) throw new Error('onclick functions without definitions: '+missing.join(', '));
console.log('Grafiks UI static checks passed.');
