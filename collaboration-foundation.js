'use strict';

function clone(v){return JSON.parse(JSON.stringify(v));}
function getPath(obj,path){return String(path||'').split('.').filter(Boolean).reduce((v,k)=>v==null?undefined:v[k],obj);}
function setPath(obj,path,value){const keys=String(path||'').split('.').filter(Boolean);if(!keys.length)throw new Error('Patch path is empty.');let node=obj;for(const k of keys.slice(0,-1)){if(!node[k]||typeof node[k]!=='object'||Array.isArray(node[k]))node[k]={};node=node[k];}node[keys[keys.length-1]]=clone(value);}
function createOperation({actorId='local-user',baseRevision=0,changes=[],metadata={}}={}){return{id:`op-${Date.now()}-${Math.random().toString(16).slice(2)}`,actorId:String(actorId),baseRevision:Number(baseRevision)||0,changes:Array.isArray(changes)?clone(changes):[],metadata:clone(metadata),createdAt:new Date().toISOString()};}
function applyOperation(envelope,operation,{strictRevision=true}={}){
 if(!envelope||typeof envelope!=='object')throw new Error('Envelope is required.');
 if(!operation||!Array.isArray(operation.changes))throw new Error('Operation is invalid.');
 const current=Number(envelope.revision)||0;
 if(strictRevision && Number(operation.baseRevision)!==current)return{ok:false,conflict:true,currentRevision:current,baseRevision:Number(operation.baseRevision),operationId:operation.id};
 const next=clone(envelope);
 for(const change of operation.changes){if(!change||change.op!=='set')throw new Error(`Unsupported collaboration operation: ${change?.op}`);setPath(next.data,change.path,change.value);}
 next.revision=current+1;next.savedAt=new Date().toISOString();next.lastOperation={id:operation.id,actorId:operation.actorId,metadata:operation.metadata||{}};
 return{ok:true,conflict:false,envelope:next};
}
function diffSet(before,after,paths=[]){const out=[];for(const path of paths){const a=getPath(before,path),b=getPath(after,path);if(JSON.stringify(a)!==JSON.stringify(b))out.push({op:'set',path,value:clone(b)});}return out;}
module.exports={createOperation,applyOperation,diffSet};
