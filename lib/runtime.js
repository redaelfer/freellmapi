import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { homedir } from 'node:os';
import { spawn } from 'node:child_process';
import { ensureLocalOllama, listLocalModels } from './ollama.js';
import { CLAUDE_ROUTE, CLAUDE_CONTEXT_TOKENS } from './coding-profile.js';

export const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const gatewayRoot = join(packageRoot, 'data/gateway');
export const gatewayUrl = 'http://127.0.0.1:3001';
export const gatewayRepo = join(packageRoot, 'upstream');
export const claudeExecutable = join(packageRoot, 'data/coding-tools/node_modules/@anthropic-ai/claude-code/bin/claude.exe');
const settingsFile = join(gatewayRoot, 'private.json');

export function gatewaySecrets() {
  if (!existsSync(settingsFile)) throw new Error('Run npm run setup in the freellmapi folder first.');
  const config = JSON.parse(readFileSync(settingsFile, 'utf8'));
  const catalog = join(gatewayRoot, 'codex-models.json');
  return { ...config, codexCatalog: existsSync(catalog) ? catalog : undefined };
}
function saveSecrets(value) { mkdirSync(gatewayRoot, { recursive: true }); writeFileSync(settingsFile, JSON.stringify(value, null, 2), { mode: 0o600 }); }
export function prepareCodexCatalog(model, { source = join(process.env.USERPROFILE || homedir(), '.codex/models_cache.json'), target = join(gatewayRoot, 'codex-models.json') } = {}) {
  if (!existsSync(source)) return null;
  const cached = JSON.parse(readFileSync(source, 'utf8'));
  const template = cached.models?.find(item => item.slug === 'gpt-6.1-sol') || cached.models?.[0];
  if (!template) return null;
  // Use the installed client's schema, without its account identity/auth data.
  // The local model's real limits replace the upstream catalog's larger limits.
  const entry = { ...template, slug: model, display_name: 'Local Ollama through FreeLLMAPI', description: 'Local coding model; review generated changes.', context_window: 32768, max_context_window: 32768, default_reasoning_level: 'none', supported_reasoning_levels: [{ effort: 'none', description: 'Local model default' }], supports_reasoning_effort_updates: false, supports_search_tool: false, supports_experimental_context: false, input_modalities: ['text'], use_responses_lite: false, tool_mode: null, web_search_tool_type: 'text', multi_agent_version: 'v1', availability_nux: null, additional_speed_tiers: [], service_tiers: [], upgrade: null };
  mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, JSON.stringify({ models: [entry] }), { mode: 0o600 }); return target;
}
export async function gatewayRequest(path, { method = 'GET', body, token, timeout = 20000 } = {}) {
  let response;
  try { response = await fetch(gatewayUrl + path, { method, redirect: 'error', signal: AbortSignal.timeout(timeout), headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }); }
  catch { throw new Error('Local FreeLLMAPI is unavailable or timed out. Run npm start in the freellmapi folder.'); }
  let result; try { result = await response.json(); } catch { throw new Error('Local FreeLLMAPI returned an unreadable response.'); }
  if (!response.ok) throw new Error(`FreeLLMAPI request rejected (HTTP ${response.status}). Check its dashboard; no credentials were printed.`);
  return result;
}
export async function startGateway() {
  const config = gatewaySecrets();
  try { await gatewayRequest('/api/ping', { timeout: 1000 }); return; } catch { /* Start this dedicated gateway. */ }
  const entry = join(gatewayRepo, 'server/dist/index.js');
  if (!existsSync(entry)) throw new Error('FreeLLMAPI has not been built. Read freellmapi/README.md for installation.');
  const env = { ...process.env, HOST: '127.0.0.1', PORT: '3001', NODE_ENV: 'production', CLIENT_DIST: join(gatewayRepo, 'client/dist'), FREEAPI_DB_PATH: join(gatewayRoot, 'gateway.sqlite'), ENCRYPTION_KEY: config.encryptionKey, RESPONSE_CACHE: 'off' };
  // Upstream keys are stored encrypted by the gateway, never inherited as
  // unrelated account credentials or written into a launcher command line.
  for (const key of Object.keys(env)) if (/API_KEY$|AUTH_TOKEN$|OAUTH_TOKEN$/.test(key)) delete env[key];
  const child = spawn(process.execPath, [entry], { cwd: join(gatewayRepo, 'server'), env, shell: false, windowsHide: true, detached: true, stdio: 'ignore' });
  let failed = false; child.on('error', () => { failed = true; }); child.unref();
  for (let attempt = 0; attempt < 40; attempt++) {
    if (failed) break;
    await new Promise(resolve => setTimeout(resolve, 500));
    try { await gatewayRequest('/api/ping', { timeout: 1000 }); return; } catch { /* Wait without logging credentials/setup codes. */ }
  }
  throw new Error('FreeLLMAPI did not start on localhost:3001. Check the build and freellmapi/README.md.');
}
export async function setupGateway(credentials = { get: () => '', save: () => {} }, progress = () => {}) {
  mkdirSync(gatewayRoot, { recursive: true });
  if (!existsSync(settingsFile)) {
    // Never claim a pre-existing server/account at this port.
    let occupied = false; try { await gatewayRequest('/api/ping', { timeout: 1000 }); occupied = true; } catch {}
    if (occupied) throw new Error('Port 3001 already has a gateway. Preserve it and read FREELLMAPI.md before connecting.');
    saveSecrets({ encryptionKey: randomBytes(32).toString('hex'), email: 'local@jobos.invalid', password: randomBytes(24).toString('base64url'), model: 'custom:qwen3:4b' });
  }
  progress('Starting installed local Ollama');
  await ensureLocalOllama(() => {}, { allowDownload: false, root: gatewaySecrets().ollamaRoot });
  const installed = await listLocalModels();
  if (!installed.length) throw new Error('Download an Ollama model in JobOS before setting up the gateway.');
  // Give coding requests an explicit context default. Otherwise Ollama's
  // OpenAI-compatible endpoint can use 4K while clients assume a larger window.
  const codingModel = 'jobos-coder:latest';
  const baseModel = installed.find(model => model.name === 'qwen3:4b')?.name || installed.find(model => model.name !== codingModel)?.name;
  if (!baseModel) throw new Error('Keep a downloaded base model, such as qwen3:4b, before preparing the coding alias.');
  progress('Preparing a local coding alias with a 32768-token context');
  const created = await fetch('http://127.0.0.1:11434/api/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: codingModel, from: baseModel, parameters: { num_ctx: 32768, temperature: 0 }, system: 'Follow the requested output format. Use tools when requested. Do not print private reasoning. /no_think', stream: false }), signal: AbortSignal.timeout(60000) });
  if (!created.ok || (await created.json()).status !== 'success') throw new Error('The local coding alias could not be created. Existing models were kept.');
  const available = [...installed.filter(model => model.name !== codingModel), { name: codingModel }];
  progress('Starting the separate local FreeLLMAPI gateway'); await startGateway();
  const config = gatewaySecrets();
  const status = await gatewayRequest('/api/auth/status');
  const session = await gatewayRequest(status.needsSetup ? '/api/auth/setup' : '/api/auth/login', { method: 'POST', body: { email: config.email, password: config.password } });
  const token = session.token;
  const unified = await gatewayRequest('/api/settings/api-key', { token });
  const apiKey = unified.apiKey ?? unified.key;
  if (!apiKey) throw new Error('The gateway did not supply its client key. Check the dashboard.');
  progress('Registering downloaded local models without cloud fallback');
  await gatewayRequest('/api/keys/custom', { method: 'POST', token, body: { baseUrl: 'http://127.0.0.1:11434/v1', models: available.map(model => ({ model: model.name, displayName: 'Local Ollama · ' + model.name, supportsTools: true })), label: 'Local Ollama', groupLabel: 'local-ollama' } });
  const catalog = await gatewayRequest('/v1/models', { token: apiKey });
  const model = catalog.data?.find(item => item.name === 'Local Ollama · ' + codingModel)?.id || 'custom:' + codingModel;
  // Pin a specific local model. 'auto' remains an explicit user choice.
  const codexCatalog = prepareCodexCatalog(model);
  saveSecrets({ ...config, apiKey, model, localModel: codingModel, contextTokens: 32768, ...(codexCatalog ? { codexCatalog } : {}) });
  const existing = await gatewayRequest('/api/keys', { token });
  const keys = Array.isArray(existing) ? existing : existing.keys || [];
  for (const [local, platform] of [['gemini', 'google'], ['groq', 'groq'], ['openrouter', 'openrouter']]) {
    const key = credentials.get(local);
    if (!key || keys.some(item => item.platform === platform)) continue;
    // API keys belong to the user's own provider accounts; no account/token
    // is fabricated. Only already configured credentials are imported.
    await gatewayRequest('/api/keys', { method: 'POST', token, body: { platform, key, label: 'Imported from JobOS' } });
    progress('Imported existing ' + platform + ' credential privately');
  }
  credentials.save({ freellmapi: apiKey });
  return { model, url: gatewayUrl, installedCount: available.length };
}

export function defaultCodingModel(client, secrets) {
  if (!['codex', 'claude'].includes(client)) throw new Error('Choose codex or claude.');
  // Claude uses the enabled gateway pool; explicit --model choices still win.
  // Keep the existing Codex local default independent of this preference.
  return client === 'claude' ? CLAUDE_ROUTE : secrets.model;
}

export function codingLaunchConfig(client, secrets, model = defaultCodingModel(client, secrets), baseEnv = process.env) {
  if (!['codex', 'claude'].includes(client)) throw new Error('Choose codex or claude.');
  if (!secrets.apiKey) throw new Error('Complete gateway:setup (JobOS) or setup (freellmapi) before launching a coding client.');
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:/@#-]{0,199}$/.test(model) || /\.\.|https?:/i.test(model)) throw new Error('Invalid gateway model ID.');
  const env = { ...baseEnv };
  for (const key of ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'CLAUDE_CODE_OAUTH_TOKEN', 'OPENAI_API_KEY']) delete env[key];
  if (client === 'claude') return { args: ['--model', model], env: { ...env, ANTHROPIC_BASE_URL: gatewayUrl, ANTHROPIC_AUTH_TOKEN: secrets.apiKey, ANTHROPIC_MODEL: model, ANTHROPIC_DEFAULT_OPUS_MODEL: model, ANTHROPIC_DEFAULT_SONNET_MODEL: model, ANTHROPIC_DEFAULT_HAIKU_MODEL: model, CLAUDE_CONFIG_DIR: join(gatewayRoot, 'claude-config'), CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1', CLAUDE_CODE_MAX_CONTEXT_TOKENS: env.CLAUDE_CODE_MAX_CONTEXT_TOKENS || String(model === CLAUDE_ROUTE ? CLAUDE_CONTEXT_TOKENS : 32768), CLAUDE_CODE_MAX_OUTPUT_TOKENS: env.CLAUDE_CODE_MAX_OUTPUT_TOKENS || '4096', CLAUDE_CODE_MAX_RETRIES: env.CLAUDE_CODE_MAX_RETRIES || '0', API_TIMEOUT_MS: env.API_TIMEOUT_MS || '90000', CLAUDE_CODE_SUBAGENT_MODEL: model, CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY: model === CLAUDE_ROUTE ? '0' : '1', ANTHROPIC_CUSTOM_MODEL_OPTION: model } };
  return { args: ['-c', 'model_provider="freellmapi"', '-c', `model=${JSON.stringify(model)}`, '-c', 'model_providers.freellmapi.name="FreeLLMAPI"', '-c', `model_providers.freellmapi.base_url=${JSON.stringify(gatewayUrl + '/v1')}`, '-c', 'model_providers.freellmapi.wire_api="responses"', '-c', 'model_providers.freellmapi.env_key="FREELLMAPI_API_KEY"', '-c', 'model_providers.freellmapi.requires_openai_auth=false', '-c', 'web_search="disabled"', '-c', 'model_context_window=32768', ...(secrets.codexCatalog && model === secrets.model ? ['-c', `model_catalog_json=${JSON.stringify(secrets.codexCatalog)}`] : [])], env: { ...env, FREELLMAPI_API_KEY: secrets.apiKey } };
}
