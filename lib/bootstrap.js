import {gatewaySecrets,startGateway} from './runtime.js';
import {ensureLocalOllama} from './ollama.js';
export async function startWorkspace({readConfig=gatewaySecrets,start=startGateway,ensureOllama=ensureLocalOllama}={}){
  const config=readConfig();
  await start();
  let localReady=null;
  if(/^(?:custom:|local-ollama-)/.test(config.model)){
    try{await ensureOllama(()=>{},{root:config.ollamaRoot});localReady=true;}catch{localReady=false;}
  }
  return {localReady};
}
