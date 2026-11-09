import { resolve } from 'node:path';
import { existsSync, statSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { gatewaySecrets, gatewayRequest, codingLaunchConfig, defaultCodingModel, startGateway, claudeExecutable, gatewayUrl, gatewayRoot } from './runtime.js';
import {LAPTOP_MODEL,LAPTOP_CONTEXT,OLLAMA_URL,laptopInstalled,startLaptopRelay} from './laptop.js';
import { ensureLocalOllama } from './ollama.js';
import { CLAUDE_ROUTE, ensureCodingProfile, ensurePinnedProfile } from './coding-profile.js';

export function parseLaunchArgs(client, input, defaultModel, workingDirectory = process.cwd()) {
  if (!['codex', 'claude'].includes(client)) throw new Error('Choose codex or claude.');
  const args = [...input];
  const take = flag => {
    const index = args.indexOf(flag); if (index < 0) return undefined;
    if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error('Supply a value after ' + flag + '.');
    return args.splice(index, 2)[1];
  };
  const localIndex = args.indexOf('--local');
  const localOnly = localIndex >= 0;
  if (localOnly) {
    if (client !== 'claude' || args.some(arg => arg === '--model' || arg.startsWith('--model='))) {
      throw new Error('--local is a Claude launcher option and already selects the downloaded model.');
    }
    args.splice(localIndex, 1);
  }
  const model = localOnly ? LAPTOP_MODEL : take('--model') || defaultModel;
  const cwd = resolve(workingDirectory, take('--cwd') || '.');
  if (!existsSync(cwd) || !statSync(cwd).isDirectory()) throw new Error('Choose an existing working folder with --cwd.');
  return { model, cwd, args, localOnly };
}
export async function runCodingClient(client, input) {
  if (input.includes('--help')) {
    console.log('From freellmapi: npm run codex (or claude) -- --cwd "C:\\your-project" --model catalog-id');
    console.log('Claude defaults to auto:coding-quality: a coding pool with quota fallback. Codex keeps its pinned default. Use --model to pin a route. Credentials stay in child environment variables; tool approvals are retained.');
    if (client === 'claude') console.log('Use --local for on-device inference. Add --continue in the same project to keep the session.');
    return;
  }
  const secrets = gatewaySecrets(), parsed = parseLaunchArgs(client, input, defaultCodingModel(client, secrets));
  if (/^(?:custom:|local-ollama-)/.test(parsed.model)) await ensureLocalOllama(() => {}, { root: secrets.ollamaRoot });
  if (parsed.localOnly) {
    await ensureLocalOllama(() => {}, { root: secrets.ollamaRoot });
    if (!(await laptopInstalled())) throw new Error('Run node scripts/setup-laptop.js from the freellmapi folder first.');
  } else await startGateway();
  if (client === 'claude' && !parsed.localOnly) {
    const { token } = await gatewayRequest('/api/auth/login', { method: 'POST', body: { email: secrets.email, password: secrets.password } });
    const request = (path, options = {}) => gatewayRequest(path, { ...options, token });
    if (parsed.model === CLAUDE_ROUTE) await ensureCodingProfile(request);
    else if (!/^auto(?::|$)/i.test(parsed.model)) parsed.model = await ensurePinnedProfile(parsed.model, request);
  }
  const config = codingLaunchConfig(client, secrets, parsed.model);
  if (client === 'claude' && !existsSync(claudeExecutable)) throw new Error('Install Claude Code in this folder; see freellmapi/README.md.');
  let relay;
  if (parsed.localOnly) {
    Object.assign(config.env, {ANTHROPIC_BASE_URL:OLLAMA_URL, ANTHROPIC_AUTH_TOKEN:'ollama',
      CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY:'0', CLAUDE_CODE_MAX_CONTEXT_TOKENS:String(LAPTOP_CONTEXT),
      CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING:'1', MAX_THINKING_TOKENS:'0', API_TIMEOUT_MS:process.env.API_TIMEOUT_MS || '900000'});
  } else if (client === 'claude' && parsed.model === CLAUDE_ROUTE && existsSync(resolve(gatewayRoot,'laptop-fallback-enabled'))) {
    relay = await startLaptopRelay({cloudUrl:gatewayUrl, gatewayKey:secrets.apiKey,
      startLocal:()=>ensureLocalOllama(()=>{}, {root:secrets.ollamaRoot}),
      onFallback:()=>console.error('Cloud coding routes unavailable. Continuing this request on your laptop with '+LAPTOP_MODEL+'.')});
    Object.assign(config.env, {ANTHROPIC_BASE_URL:relay.url, ANTHROPIC_AUTH_TOKEN:relay.sessionKey, API_TIMEOUT_MS:process.env.API_TIMEOUT_MS || '900000'});
  }
  if (client === 'claude' && process.stdout.isTTY) {
    console.log('Working folder: ' + parsed.cwd);
    console.log('Model route: ' + parsed.model + (relay ? ' (laptop backup enabled)' : ''));
  }
  const child = spawn(client === 'claude' ? claudeExecutable : 'codex', [...parsed.args, ...config.args], { cwd: parsed.cwd, shell: false, env: config.env, stdio: 'inherit', windowsHide: true });
  await new Promise(resolveDone => {
    child.once('error', () => { console.error('The coding client could not start. Check PATH/install and freellmapi/README.md.'); process.exitCode = 1; resolveDone(); });
    child.once('exit', code => { process.exitCode = code ?? 1; resolveDone(); });
  });
  relay?.close();
}
