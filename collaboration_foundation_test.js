'use strict';
const assert=require('assert');const C=require('./collaboration-foundation');
const envelope={version:'4.1.0',revision:7,savedAt:'',data:{organization:{name:'A'},branches:[{id:1}],lessons:[]}};
const op=C.createOperation({actorId:'user-1',baseRevision:7,changes:[{op:'set',path:'organization.name',value:'B'}]});
const applied=C.applyOperation(envelope,op);assert(applied.ok&&applied.envelope.revision===8);assert.strictEqual(applied.envelope.data.organization.name,'B');
const stale=C.applyOperation(applied.envelope,C.createOperation({actorId:'user-2',baseRevision:7,changes:[{op:'set',path:'organization.name',value:'C'}]}));assert.strictEqual(stale.conflict,true);
assert.deepStrictEqual(C.diffSet(envelope.data,applied.envelope.data,['organization.name']),[{op:'set',path:'organization.name',value:'B'}]);
console.log('Collaboration foundation: PASS');
