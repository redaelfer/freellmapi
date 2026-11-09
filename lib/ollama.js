import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const base = 'http://127.0.0.1:11434';
export async function listLocalModels({ fetcher = fetch } = {}) {
  let response;
  try { response = await fetcher(base + '/api/tags', { redirect: 'error', signal: AbortSignal.timeout(10000) }); } catch { throw new Error('Start local Ollama before listing its downloaded models.'); }
  if (!response.ok) throw new Error('Ollama model listing failed.');
  const result = await response.json();
  return (result.models || []).filter(model => typeof model.name === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,119}$/.test(model.name) && !/cloud|https?:|\.\./i.test(model.name)).map(({ name }) => ({ name }));
}
export async function ensureLocalOllama(progress = () => {}, { root, fetcher = fetch, processSpawn = spawn, pause = ms => new Promise(resolve => setTimeout(resolve, ms)), env = process.env } = {}) {
  const reachable = async () => { try { return (await fetcher(base + '/api/version', { redirect: 'error', signal: AbortSignal.timeout(1500) })).ok; } catch { return false; } };
  if (await reachable()) return;
  const portable = root && join(root, 'runtime/ollama.exe');
  const command = env.OLLAMA_EXECUTABLE || (portable && existsSync(portable) ? portable : 'ollama');
  if (env.OLLAMA_EXECUTABLE && !existsSync(env.OLLAMA_EXECUTABLE)) throw new Error('OLLAMA_EXECUTABLE does not exist. Check the standalone .env file.');
  const modelPath = env.OLLAMA_MODELS || (root ? join(root, 'models') : undefined);
  const childEnv = { ...env, OLLAMA_HOST: '127.0.0.1:11434', OLLAMA_NO_CLOUD: '1', ...(modelPath ? { OLLAMA_MODELS: modelPath } : {}) };
  for (const key of Object.keys(childEnv)) if (/API_KEY$|AUTH_TOKEN$|OAUTH_TOKEN$/.test(key)) delete childEnv[key];
  progress('Starting installed local Ollama');
  const child = processSpawn(command, ['serve'], { shell: false, windowsHide: true, detached: true, stdio: 'ignore', env: childEnv });
  let failed = false; child.on('error', () => { failed = true; }); child.unref();
  for (let i = 0; i < 30 && !failed; i++) { await pause(500); if (await reachable()) return; }
  throw new Error('Local Ollama did not start. Install/start Ollama or set OLLAMA_EXECUTABLE and OLLAMA_MODELS in .env; see README.md.');
}
