import {writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {gatewaySecrets,gatewayRoot} from '../lib/runtime.js';
import {ensureLocalOllama} from '../lib/ollama.js';
import {LAPTOP_CONTEXT,LAPTOP_MODEL,OLLAMA_URL,laptopInstalled} from '../lib/laptop.js';

const base = 'qwen3.5:4b';
async function operation(endpoint,body) {
  const response = await fetch(OLLAMA_URL+endpoint,{method:'POST',redirect:'error',headers:{'content-type':'application/json'},
    body:JSON.stringify({...body,stream:true}),signal:AbortSignal.timeout(60*60*1000)});
  if (!response.ok) throw new Error('Ollama '+endpoint+' failed (HTTP '+response.status+').');
  let last=0, buffer='',success=false;
  const decoder = new TextDecoder();
  function handle(line) {
    if (!line.trim()) return;
    const row=JSON.parse(line);
    if(row.error) throw new Error('Ollama '+endpoint+' failed: '+String(row.error).replace(/https?:\/\/\S+/g,'[registry]'));
    if(row.status==='success') success=true;
    if(Date.now()-last>12000 || success) {
      console.log(row.total?'Downloading model layer '+Math.floor(100*(row.completed||0)/row.total)+'%':row.status);
      last=Date.now();
    }
  }
  for await (const chunk of response.body) {
    buffer+=decoder.decode(chunk,{stream:true});
    const lines=buffer.split('\n');buffer=lines.pop();
    for (const line of lines) handle(line);
  }
  handle(buffer+decoder.decode());
  if(!success) throw new Error('Ollama did not confirm '+endpoint+'. Rerun setup to resume.');
}

try {
  const switches=process.argv.slice(2);
  if(switches.length>1 || switches.some(s=>!['--enable-fallback','--disable-fallback'].includes(s))) {
    throw new Error('Use setup-laptop.js with --enable-fallback, --disable-fallback, or no arguments to install the model.');
  }
  const marker = join(gatewayRoot,'laptop-fallback-enabled');
  if(switches.includes('--disable-fallback')) {
    await rm(marker,{force:true});
    console.log('Automatic laptop backup disabled for new sessions. The downloaded model is still available with --local.');
    process.exit(0);
  }
  await ensureLocalOllama(console.log,{root:gatewaySecrets().ollamaRoot});
  if (!(await laptopInstalled())) {
    console.log('Preparing official Qwen 3.5 4B weights for local coding.');
    await operation('/api/pull',{model:base});
    await operation('/api/create',{model:LAPTOP_MODEL,from:base,parameters:{num_ctx:LAPTOP_CONTEXT,temperature:0.2}});
    if (!(await laptopInstalled())) throw new Error('The resulting model did not pass the local tool/context checks.');
  }
  console.log('Installed '+LAPTOP_MODEL+' with '+LAPTOP_CONTEXT+' configured context tokens.');
  if (process.argv.includes('--enable-fallback')) {
    const warm = await fetch(OLLAMA_URL+'/api/generate',{method:'POST',redirect:'error',headers:{'content-type':'application/json'},
      body:JSON.stringify({model:LAPTOP_MODEL,prompt:'',keep_alive:'5m',stream:false}),signal:AbortSignal.timeout(180000)});
    if(!warm.ok) throw new Error('Local model loading failed (HTTP '+warm.status+'). Automatic backup was not enabled.');
    await warm.json();
    const loaded = await (await fetch(OLLAMA_URL+'/api/ps',{signal:AbortSignal.timeout(10000)})).json();
    if (!loaded.models?.some(m=>m.name===LAPTOP_MODEL && m.context_length>=LAPTOP_CONTEXT)) {
      throw new Error('Ollama could not verify the full runtime context. Keep using --local for troubleshooting.');
    }
    await writeFile(marker,LAPTOP_MODEL+'\n',{mode:0o600});
    console.log('Verified runtime context. New automatic Claude sessions can fall back to the laptop.');
  }
} catch(error) { console.error(error.message);process.exitCode=1; }
