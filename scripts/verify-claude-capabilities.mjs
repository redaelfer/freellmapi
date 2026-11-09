import {mkdir,mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {once} from 'node:events';
import {packageRoot} from '../lib/runtime.js';
const fixture=await mkdtemp(join(tmpdir(),'gateway-feature-check-'));
const repo=join(fixture,'project');await mkdir(repo);
const nonce='receipt-'+randomUUID();
const mcpServer=join(fixture,'server.cjs');
await writeFile(mcpServer,`const rl=require('node:readline').createInterface({input:process.stdin});
rl.on('line',line=>{let m=JSON.parse(line);if(m.id===undefined)return;
let result; if(m.method==='initialize'){result={protocolVersion:m.params.protocolVersion,capabilities:{tools:{}},serverInfo:{name:'fixture',version:'1'}};}
else if(m.method==='tools/list'){result={tools:[{name:'read_receipt',description:'Read the synthetic receipt from this temporary local server',inputSchema:{type:'object',properties:{}},annotations:{readOnlyHint:true,openWorldHint:false}}]};}
else if(m.method==='tools/call' && m.params.name==='read_receipt'){result={content:[{type:'text',text:`+JSON.stringify(nonce)+`}]};}
else if(m.method==='ping'){result={};}else{process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:m.id,error:{code:-32601,message:'unknown method'}})+'\\n');return;}
process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:m.id,result})+'\\n');});`);
const config=join(fixture,'mcp.json');
await writeFile(config,JSON.stringify({mcpServers:{fixture:{type:'stdio',command:process.execPath,args:[mcpServer]}}}));
await writeFile(join(repo,'persist-fixture.cjs'),"require('node:fs').writeFileSync('probe-result.txt','ran');");
const hook=join(fixture,'guard.cjs');
await writeFile(hook,"let d='';process.stdin.on('data',s=>d+=s);process.stdin.on('end',()=>{const x=JSON.parse(d);const allowed=x.tool_name==='mcp__fixture__read_receipt'||(x.tool_name==='Bash'&&x.tool_input.command==='node persist-fixture.cjs'&&!x.tool_input.run_in_background);if(!allowed)process.exitCode=2;});");
const settings=join(fixture,'guard.json');
await writeFile(settings,JSON.stringify({hooks:{PreToolUse:[{matcher:'.*',hooks:[{type:'command',command:'node "'+hook.replaceAll('\\','/')+'"'}]}]}}));
const isPlan=process.argv.includes('--plan');
const prompt=isPlan?'Call the local read_receipt MCP tool once. Return only the exact receipt value it gives you.':'Use the local read_receipt MCP tool, then use Bash to run exactly node persist-fixture.cjs. It writes one marker in this disposable project. Report the receipt and whether the command ran.';
const args=[resolve(packageRoot,'scripts/code.js'),'claude','-p','--permission-mode',isPlan?'plan':'auto','--settings',settings,'--strict-mcp-config','--mcp-config',config,isPlan?'--tools=Read':'--tools=Bash','--allowedTools=mcp__fixture__read_receipt','--no-session-persistence','--max-turns','7','--output-format','stream-json','--verbose',prompt];
const child=spawn(process.execPath,args,{cwd:repo,windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,CLAUDE_CODE_AUTO_MODE_SERVER:'0'}});
let stdout='',stderr='';child.stdout.setEncoding('utf8').on('data',s=>stdout+=s);child.stderr.setEncoding('utf8').on('data',s=>stderr+=s);
const timer=setTimeout(()=>spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore',windowsHide:true}),210000);
const [code]=await once(child,'exit');clearTimeout(timer);
const events=stdout.split(/\r?\n/).flatMap(line=>{try{return [JSON.parse(line)]}catch{return []}});
const init=events.find(e=>e.type==='system'&&e.subtype==='init'), r=events.findLast(e=>e.type==='result');
const blocks=events.filter(e=>e.type==='assistant').flatMap(e=>Array.isArray(e.message.content)?e.message.content:[]);
const executed=await readFile(join(repo,'probe-result.txt'),'utf8').then(x=>x==='ran',()=>false);
console.log(JSON.stringify({code,subtype:r?.subtype,mode:init?.permissionMode,servers:init?.mcp_servers?.map(({name,status})=>({name,status})),calls:blocks.filter(b=>b.type==='tool_use').map(b=>b.name),toolReturnedReceipt:events.some(e=>e.type==='user'&&JSON.stringify(e.message?.content).includes(nonce)),receivedReceipt:r?.result?.includes(nonce)??false,executed,denials:r?.permission_denials?.map(d=>d.tool_name),notice:/We're changing auto mode|this session isn't eligible/i.test(stdout+stderr),classifierUnavailable:/cannot determine the safety|classifier[^\n]{0,100}(?:timed out|temporarily unavailable)/i.test(stdout+stderr),resultSuccess:r?.is_error===false,laptopFallback:stderr.includes('Continuing this request on your laptop')}));

if (code !== 0 || r?.is_error !== false || !r.result.includes(nonce) || (!isPlan && !executed)) process.exitCode = 1;
