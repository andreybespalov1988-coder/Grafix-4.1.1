'use strict';
const fs=require('fs');const vm=require('vm');
const source=fs.readFileSync('index.html','utf8');const script=source.match(/<script>([\s\S]*?)<\/script>/)?.[1];
function take(a,b){const s=script.indexOf(a),e=script.indexOf(b,s);if(s<0||e<0)throw new Error('missing function block');return script.slice(s,e)}
const code=[take('function resizeEditorColumn(key,value)','function resizeEditorColumnValue'),take('function resizeEditorColumnValue','function resizeEditorRowValue'),take('function resizeEditorRowValue','function removeEditorRow')].join('\n');
const els={style:{}};
const context={
 editorColumns:[{key:'title',label:'Занятие',width:'30mm',placement:'table'}],
 editorRowHeights:{},printEditorSource:{lessons:[{id:7,title:'Тест'}]},
 persistPrintSettings(){},
 document:{querySelectorAll(){return[{style:{}}]},querySelector(){return {style:{}}}},
 CSS:{escape(v){return String(v)}},Math,Number,String
};
vm.runInNewContext(code,context,{filename:'index.html:print-editor-runtime'});
context.resizeEditorColumnValue('title',55);
if(context.editorColumns[0].width!=='55mm')throw new Error('column width was not stored');
context.resizeEditorColumnValue('title',999);
if(context.editorColumns[0].width!=='100mm')throw new Error('column width upper clamp failed');
context.resizeEditorRowValue(0,22);
if(context.editorRowHeights['7']!=='22mm')throw new Error('row height was not stored');
context.resizeEditorRowValue(0,999);
if(context.editorRowHeights['7']!=='60mm')throw new Error('row height upper clamp failed');
if(!source.includes('startEditorColumnResize')||!source.includes('startEditorRowResize'))throw new Error('drag resize grips missing');
console.log('Print editor runtime resize test passed.');
