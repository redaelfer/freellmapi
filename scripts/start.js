import {startWorkspace} from '../lib/bootstrap.js';
import {gatewayUrl} from '../lib/runtime.js';
try{
  const result=await startWorkspace();
  console.log('FreeLLMAPI is running at '+gatewayUrl+'.');
  console.log('Dashboard login: open data/gateway/private.json privately in your editor.');
  if(result.localReady===false)console.log('Local Ollama is unavailable. The dashboard remains usable for provider keys and cloud routes; start Ollama before selecting local models.');
}catch(error){console.error(error.message);process.exitCode=1;}
