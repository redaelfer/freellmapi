// Run from the standalone app: node scripts/verify-context-handoff.mjs
// All credentials, models and requests are synthetic and process-local.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {randomBytes, randomUUID} from 'node:crypto';
import {createApp} from '../upstream/server/dist/app.js';
import {initDb, getDb, getUnifiedApiKey} from '../upstream/server/dist/db/index.js';
import {encrypt} from '../upstream/server/dist/lib/crypto.js';
import {getProvider} from '../upstream/server/dist/providers/index.js';
import {setRoutingStrategy} from '../upstream/server/dist/services/router.js';

process.env.ENCRYPTION_KEY = randomBytes(32).toString('hex');
process.env.FREEAPI_DB_PATH = ':memory:';
process.env.RESPONSE_CACHE = 'off';
initDb(':memory:');
const db = getDb();
const profileId = db.prepare("INSERT INTO profiles (name,type,auto_include_new_models) VALUES ('coding-quality','custom',0)").run().lastInsertRowid;
const routes = ['google','nvidia'];
for (const [priority, platform] of routes.entries()) {
  const key = encrypt('synthetic-key');
  db.prepare("INSERT INTO api_keys (platform,label,encrypted_key,iv,auth_tag,status,enabled) VALUES (?,'test',?,?,?,'healthy',1)").run(platform,key.encrypted,key.iv,key.authTag);
  const model = db.prepare("INSERT INTO models (platform,model_id,display_name,intelligence_rank,speed_rank,size_label,context_window,enabled,supports_tools) VALUES (?,?,?,1,1,'Large',131072,1,1)").run(platform,'fixture-'+platform,'Fixture');
  db.prepare('INSERT INTO profile_models (profile_id,model_db_id,priority,enabled) VALUES (?,?,?,1)').run(profileId,model.lastInsertRowid,priority);
}
setRoutingStrategy('priority');
const ticket = randomUUID(), resultMarker = randomUUID(), callId = 'call_read_price';
const attempts = [];
let failedRequest, retriedRequest;
function chunk(delta, finish_reason = null) {
  return {id:'test',object:'chat.completion.chunk',created:0,model:'mock',choices:[{index:0,delta,finish_reason}]};
}
getProvider('google').streamChatCompletion = async function* (_key, messages) {
  attempts.push('google');
  if (messages.some(message => message.role === 'tool')) {
    failedRequest = structuredClone(messages);
    throw Object.assign(new Error('synthetic provider rate limit'), {status:429});
  }
  yield chunk({role:'assistant',tool_calls:[{index:0,id:callId,type:'function',function:{name:'Read',arguments:'{"file_path":"price.js"}'}}]});
  yield chunk({},'tool_calls');
};
getProvider('nvidia').streamChatCompletion = async function* (_key, messages) {
  attempts.push('nvidia');
  retriedRequest = structuredClone(messages);
  yield chunk({role:'assistant',content:resultMarker});
  yield chunk({},'stop');
};
const server = createApp().listen(0,'127.0.0.1');
await once(server,'listening');
async function send(messages) {
  const response = await fetch('http://127.0.0.1:'+server.address().port+'/v1/messages',{
    method:'POST',
    headers:{'content-type':'application/json','anthropic-version':'2023-06-01','x-api-key':getUnifiedApiKey(),'x-claude-code-session-id':ticket},
    body:JSON.stringify({model:'auto:coding-quality',max_tokens:128,stream:true,system:'Keep the test intact.',tools:[{name:'Read',description:'Read a file',input_schema:{type:'object',properties:{file_path:{type:'string'}}}}],messages})
  });
  assert.equal(response.status,200);
  return (await response.text()).split(/\r?\n/).filter(line=>line.startsWith('data: {')).map(line=>JSON.parse(line.slice(6)));
}
try {
  const messages = [{role:'user',content:'Debug ticket '+ticket}];
  const first = await send(messages);
  const tool = first.find(e=>e.content_block?.type==='tool_use')?.content_block;
  assert.equal(tool?.id,callId);
  const input = JSON.parse(first.filter(e=>e.delta?.type==='input_json_delta').map(e=>e.delta.partial_json).join(''));
  messages.push({role:'assistant',content:[{type:'tool_use',name:tool.name,id:tool.id,input}]});
  messages.push({role:'user',content:[{type:'tool_result',tool_use_id:tool.id,content:'Test failed at price.js:4. Evidence '+resultMarker}]});
  const second = await send(messages);
  assert.deepEqual(attempts,['google','google','nvidia']);
  assert.deepEqual(retriedRequest,failedRequest);
  assert.ok(retriedRequest.some(m=>m.role==='system' && JSON.stringify(m).includes('Keep the test intact.')));
  assert.ok(retriedRequest.some(m=>m.role==='user' && JSON.stringify(m).includes(ticket)));
  assert.ok(retriedRequest.some(m=>m.role==='assistant' && m.tool_calls?.some(call=>call.id===callId && call.function.name==='Read')));
  assert.ok(retriedRequest.some(m=>m.role==='tool' && m.tool_call_id===callId && JSON.stringify(m).includes(resultMarker)));
  assert.equal(second.filter(e=>e.type==='message_start').length,1);
  assert.equal(second.filter(e=>e.delta?.type==='text_delta').map(e=>e.delta.text).join(''),resultMarker);
  console.log('PASS: the next provider received the identical debugging history after a forced 429, including the previous tool call and its result.');
} finally {
  server.closeAllConnections();
  await new Promise(done=>server.close(done));
}
