'use strict';
const assert = require('assert');
const http = require('http');
const AIService = require('./ai-service');

async function withServer(handler, fn) {
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  try { return await fn(`http://127.0.0.1:${address.port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

(async()=>{
  const originalKey = process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  const noKey = new AIService();
  assert.strictEqual(noKey.model, 'openrouter/free');
  assert.strictEqual(noKey.endpoint, 'https://openrouter.ai/api/v1/chat/completions');
  assert.strictEqual(noKey.status().state, 'no-api-key');
  assert.strictEqual((await noKey.ask([{role:'user',content:'PING'}])).code, 'AI_NO_API_KEY');
  const invalid = new AIService({apiKey:'invalid-test-key'});
  process.env.OPENROUTER_API_KEY = 'invalid-test-key';
  const invalidResult = await invalid.ask([{role:'user',content:'Reply with GRAFIX_INVALID_KEY_TEST'}]);
  assert.strictEqual(invalidResult.ok, false);
  assert.ok(['AI_UNAUTHORIZED','AI_PROVIDER_4XX'].includes(invalidResult.code));

  const r429 = await withServer((req,res)=>{res.writeHead(429,{'content-type':'application/json'});res.end(JSON.stringify({error:{message:'rate test'}}));}, async endpoint => (new AIService({apiKey:'x',endpoint})).ask([{role:'user',content:'x'}]));
  assert.strictEqual(r429.code,'AI_RATE_LIMITED');
  const r500 = await withServer((req,res)=>{res.writeHead(503,{'content-type':'application/json'});res.end(JSON.stringify({error:{message:'server test'}}));}, async endpoint => (new AIService({apiKey:'x',endpoint})).ask([{role:'user',content:'x'}]));
  assert.strictEqual(r500.code,'AI_PROVIDER_5XX');
  const timeout = await withServer((_req,_res)=>{}, async endpoint => (new AIService({apiKey:'x',endpoint,timeoutMs:1000})).ask([{role:'user',content:'x'}]));
  assert.strictEqual(timeout.code,'AI_TIMEOUT');
  const network = await (new AIService({apiKey:'x',endpoint:'http://127.0.0.1:9',timeoutMs:2000})).ask([{role:'user',content:'x'}]);
  assert.strictEqual(network.code,'AI_NETWORK_ERROR');
  if(originalKey===undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY=originalKey;
  console.log('AI service contract/error handling: PASS');
})().catch(error=>{console.error(error);process.exit(1)});
