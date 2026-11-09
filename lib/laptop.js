import {createServer} from 'node:http';
import {randomBytes} from 'node:crypto';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';

export const OLLAMA_URL = 'http://127.0.0.1:11434';
export const LAPTOP_MODEL = 'freellm-coder-128k:latest';
export const LAPTOP_CONTEXT = 131072;
const requestLimit = 32 * 1024 * 1024;

export async function laptopInstalled(fetcher = fetch) {
  try {
    const response = await fetcher(OLLAMA_URL+'/api/show', {method:'POST', redirect:'error',
      headers:{'content-type':'application/json'}, body:JSON.stringify({model:LAPTOP_MODEL}), signal:AbortSignal.timeout(2000)});
    if (!response.ok) return false;
    const details = await response.json();
    return !details.remote_model && !details.remote_host && details.capabilities?.includes('tools')
      && /^\s*num_ctx\s+131072\s*$/m.test(details.parameters || '');
  } catch { return false; }
}

function errorResponse(status, message) {
  return Response.json({type:'error',error:{type:'api_error',message}}, {status});
}

export async function routeMessage({path, method, rawBody, headers, cloudUrl, gatewayKey, signal,
  fetcher = fetch, onFallback = () => {}, startLocal = async () => {}}) {
  const upstreamHeaders = new Headers();
  for (const key of ['content-type','anthropic-version','anthropic-beta','x-claude-code-session-id','x-session-id','accept']) {
    if (headers[key]) upstreamHeaders.set(key, headers[key]);
  }
  upstreamHeaders.set('x-api-key',gatewayKey);
  const options = {method, headers:upstreamHeaders, redirect:'error', signal};
  if (method === 'POST') options.body = rawBody;
  let cloud;
  try {
    cloud = await fetcher(cloudUrl+path, {...options,signal:AbortSignal.any([signal,AbortSignal.timeout(90000)])});
  } catch {
    signal.throwIfAborted();
    cloud = errorResponse(503,'The local FreeLLMAPI gateway could not be reached.');
  }
  // A 200 response (including a partially emitted SSE stream) is delivered once.
  // Only an unsuccessful cloud response before output can be sent to Ollama.
  if (path.split('?')[0] !== '/v1/messages' || method !== 'POST' || ![429,500,502,503,504,529].includes(cloud.status)) return cloud;
  const body = JSON.parse(rawBody);
  if (body.model !== 'auto:coding-quality') return cloud;
  try { await startLocal(); } catch { return cloud; }
  if (!(await laptopInstalled(fetcher))) return cloud;
  const localBody = JSON.stringify({...body,model:LAPTOP_MODEL});
  const localHeaders = {'content-type':'application/json','anthropic-version':headers['anthropic-version'] || '2023-06-01','x-api-key':'ollama'};
  let inputTokens;
  try {
    const count = await fetcher(OLLAMA_URL+'/v1/messages/count_tokens',{method:'POST',redirect:'error',headers:localHeaders,body:localBody,
      signal:AbortSignal.any([signal,AbortSignal.timeout(20000)])});
    if (count.ok) inputTokens = (await count.json()).input_tokens;
  } catch { signal.throwIfAborted(); }
  // Older Ollama versions lack token counting. Only admit conservatively small
  // text/tool requests then. Leave margin for the rendered conversation template.
  const estimate = Number.isSafeInteger(inputTokens) && inputTokens > 0 ? inputTokens : Buffer.byteLength(localBody);
  if (estimate + (body.max_tokens || 4096) + 4096 > LAPTOP_CONTEXT) {
    await cloud.body?.cancel();
    return errorResponse(413,'Cloud routes are unavailable and this conversation exceeds the safe local context budget. Compact it in Claude Code and continue.');
  }
  await cloud.body?.cancel();
  onFallback(cloud.status);
  return fetcher(OLLAMA_URL+path,{method:'POST',redirect:'error',headers:localHeaders,body:localBody,signal});
}

export async function startLaptopRelay({cloudUrl,gatewayKey,onFallback,startLocal}) {
  const sessionKey = randomBytes(32).toString('hex');
  const server = createServer(async(req,res)=>{
    const abort = new AbortController();
    res.once('close',()=>{if(!res.writableEnded) abort.abort();});
    try {
      const path=req.url ?? '';
      if (req.headers['x-api-key']!==sessionKey && req.headers.authorization!=='Bearer '+sessionKey) {
        res.writeHead(401).end(); return;
      }
      if (!((req.method==='POST' && /^\/v1\/messages(?:\/count_tokens)?(?:\?[^#]*)?$/.test(path))
          || (req.method==='GET' && /^\/v1\/models(?:\/[\w:.-]+)?(?:\?[^#]*)?$/.test(path)))) {
        res.writeHead(404).end(); return;
      }
      const parts=[]; let bytes=0;
      for await (const part of req) {
        bytes+=part.length;
        if (bytes>requestLimit) {res.writeHead(413).end();return;}
        parts.push(part);
      }
      const upstream=await routeMessage({path,method:req.method,headers:req.headers,rawBody:Buffer.concat(parts).toString(),
        cloudUrl,gatewayKey,signal:abort.signal,onFallback,startLocal});
      const responseHeaders={'content-type':upstream.headers.get('content-type') || 'application/json','cache-control':'no-store'};
      for (const name of ['retry-after','request-id','x-request-id']) {
        if (upstream.headers.has(name)) responseHeaders[name]=upstream.headers.get(name);
      }
      res.writeHead(upstream.status,responseHeaders);
      if(upstream.body) await pipeline(Readable.fromWeb(upstream.body),res);
      else res.end();
    } catch {
      if(!res.headersSent && !res.destroyed) {
        res.writeHead(502,{'content-type':'application/json'}).end(JSON.stringify({type:'error',error:{type:'api_error',message:'The gateway or laptop model could not finish this request.'}}));
      } else res.destroy();
    }
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  return {url:'http://127.0.0.1:'+server.address().port,sessionKey,close:()=>{server.close();server.closeAllConnections();}};
}
