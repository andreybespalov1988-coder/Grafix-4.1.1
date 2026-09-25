'use strict';
const assert=require('assert');
const AIService=require('./ai-service');
(async()=>{
  const key=String(process.env.OPENROUTER_API_KEY||'').trim();
  const invalid=await new AIService({apiKey:'invalid-test-key'}).ask([{role:'user',content:'Reply with HTTP401_TEST only.'}]);
  assert.strictEqual(invalid.ok,false);
  assert.ok(invalid.code==='AI_UNAUTHORIZED'||invalid.code==='AI_PROVIDER_4XX');
  console.log('REAL OpenRouter invalid-key request: PASS');
  if(!key){console.log('REAL OpenRouter valid-key request: NOT TESTED (OPENROUTER_API_KEY absent; no key was invented)');process.exit(0);}
  const ai=new AIService({apiKey:key});
  const result=await ai.ask([{role:'system',content:'You are Grafix 4.1 AI.'},{role:'user',content:'Reply with the exact token GRAFIX_OPENROUTER_OK and nothing else.'}],{timeoutMs:45000});
  if(!result.ok){console.error('REAL OpenRouter valid-key request: FAIL');console.error('code='+result.code+' status='+(result.status||''));process.exit(1)}
  assert.strictEqual(result.model,'openrouter/free');
  assert.ok(/GRAFIX_OPENROUTER_OK/i.test(result.content));
  console.log('REAL OpenRouter valid-key request: PASS');
  console.log('REAL LLM RESPONSE: PASS');
})().catch(error=>{console.error(error);process.exit(1)});
