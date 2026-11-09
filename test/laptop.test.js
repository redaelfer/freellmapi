import test from 'node:test';
import assert from 'node:assert/strict';
import {LAPTOP_CONTEXT,LAPTOP_MODEL,OLLAMA_URL,laptopInstalled,routeMessage} from '../lib/laptop.js';
import {parseLaunchArgs} from '../lib/launch.js';

const conversation = {model:'auto:coding-quality',max_tokens:4096,stream:true,
  system:'Keep the original test.',tools:[{name:'Read',input_schema:{type:'object'}}],
  messages:[{role:'user',content:'Fix ticket 42'},{role:'assistant',content:[{type:'tool_use',id:'r1',name:'Read',input:{file_path:'price.js'}}]},
    {role:'user',content:[{type:'tool_result',tool_use_id:'r1',content:'Expected 7, got 9'}]}]};
function args(fetcher, body=conversation) {
  return {path:'/v1/messages?beta=true',method:'POST',rawBody:JSON.stringify(body),headers:{'anthropic-version':'2023-06-01'},
    cloudUrl:'http://127.0.0.1:3001',gatewayKey:'fixture-cloud-key',signal:new AbortController().signal,fetcher};
}
const show = {capabilities:['tools'],parameters:'num_ctx 131072'};

test('after quota exhaustion the laptop receives the same tool history with local-only credentials',async()=>{
  const calls=[];
  const response=await routeMessage(args(async(url,opts)=>{
    calls.push(url);
    if(url.includes('3001')) {
      assert.equal(opts.headers.get('x-api-key'),'fixture-cloud-key');return new Response('quota',{status:429});
    }
    assert.ok(url.startsWith(OLLAMA_URL+'/'));
    assert.doesNotMatch(JSON.stringify(Object.fromEntries(new Headers(opts.headers))),/fixture-cloud-key/);
    if(url.endsWith('/api/show'))return Response.json(show);
    if(url.includes('/count_tokens'))return Response.json({input_tokens:1200});
    assert.deepEqual(JSON.parse(opts.body),{...conversation,model:LAPTOP_MODEL});return new Response('finished locally');
  }));
  assert.equal(await response.text(),'finished locally');assert.equal(calls.length,4);
});
test('an accepted stream is never replayed, including when its body breaks',async()=>{
  let count=0;
  const response=await routeMessage(args(async()=>{count++;return new Response(new ReadableStream({start(c){c.error(Error('interrupted'));}}));}));
  await assert.rejects(response.text(),/interrupted/);assert.equal(count,1);
});
test('auth failures and explicit model pins do not switch routes',async()=>{
  for(const [status,model] of [[401,'auto:coding-quality'],[429,'pinned-model']]) {
    let count=0;
    const response=await routeMessage(args(async()=>{count++;return new Response('refused',{status});},{...conversation,model}));
    assert.equal(response.status,status);assert.equal(count,1);
  }
});
test('oversized conversations fail explicitly before local inference',async()=>{
  const response=await routeMessage(args(async(url)=>{
    if(url.includes('3001'))return new Response('quota',{status:429});
    if(url.endsWith('/api/show'))return Response.json(show);
    if(url.endsWith('/count_tokens'))return Response.json({input_tokens:LAPTOP_CONTEXT});
    assert.fail('Oversized request reached inference');
  }));assert.equal(response.status,413);
});
test('local mode keeps resume arguments and rejects ambiguous model selection',()=>{
  const parsed=parseLaunchArgs('claude',['--local','--continue'],'auto:coding-quality');
  assert.equal(parsed.localOnly,true);assert.equal(parsed.model,LAPTOP_MODEL);assert.deepEqual(parsed.args,['--continue']);
  assert.throws(()=>parseLaunchArgs('claude',['--local','--model','other'],'auto'),/already selects/);
});
test('a cloud-backed or undersized Ollama alias cannot qualify as laptop fallback',async()=>{
  for(const value of [{...show,remote_host:'https://example.invalid'},{...show,parameters:'num_ctx 4096'},{...show,capabilities:[]}]) {
    assert.equal(await laptopInstalled(async()=>Response.json(value)),false);
  }
});
