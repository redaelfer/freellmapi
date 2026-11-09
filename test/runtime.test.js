import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {codingLaunchConfig,defaultCodingModel,prepareCodexCatalog,gatewayUrl} from '../lib/runtime.js';
const localModel='local-ollama-jobos-coderlatest';
const secrets={apiKey:'SYNTHETIC_GATEWAY_SECRET',model:localModel,codexCatalog:'C:/private/catalog.json'};

test('coding launchers isolate auth, keep credentials out of arguments and preserve tool approval defaults', () => {
  const base = { PATH: 'KEEP_PATH', OPENAI_API_KEY: 'OLD_OPENAI', ANTHROPIC_API_KEY: 'OLD_ANTHROPIC', ANTHROPIC_AUTH_TOKEN: 'OLD_TOKEN', CLAUDE_CODE_OAUTH_TOKEN: 'OLD_OAUTH' };
  for (const client of ['codex', 'claude']) {
    const config = codingLaunchConfig(client, secrets, localModel, base); assert.equal(config.env.PATH, 'KEEP_PATH');
    assert.equal(config.env.OPENAI_API_KEY, undefined); assert.equal(config.env.ANTHROPIC_API_KEY, undefined); assert.equal(config.env.CLAUDE_CODE_OAUTH_TOKEN, undefined);
    assert.doesNotMatch(config.args.join(' '), /SYNTHETIC_GATEWAY_SECRET|OLD_|dangerously|bypass|skip-permissions/);
    if (client === 'codex') { assert.equal(config.env.FREELLMAPI_API_KEY, secrets.apiKey); assert.ok(config.args.includes('web_search="disabled"')); assert.ok(config.args.includes('model_providers.freellmapi.wire_api="responses"')); assert.ok(config.args.some(arg => arg.startsWith('model_catalog_json='))); }
    else { assert.equal(config.env.ANTHROPIC_BASE_URL, gatewayUrl); assert.equal(config.env.ANTHROPIC_AUTH_TOKEN, secrets.apiKey); assert.equal(config.env.ANTHROPIC_DEFAULT_HAIKU_MODEL, localModel); assert.equal(config.env.CLAUDE_CONFIG_DIR, fileURLToPath(new URL('../data/gateway/claude-config', import.meta.url))); }
  }
  assert.equal(base.OPENAI_API_KEY, 'OLD_OPENAI');
  assert.equal(codingLaunchConfig('codex', secrets, 'explicit-cloud-model', base).args.some(arg => arg.startsWith('model_catalog_json=')), false);
  assert.throws(() => codingLaunchConfig('codex', { model: localModel }), /gateway:setup/);
  assert.throws(() => codingLaunchConfig('unknown', secrets), /Choose/);
  assert.throws(() => codingLaunchConfig('claude', secrets, 'model; run-command'), /Invalid/);
});

test('Codex catalog copies a single schema entry without account identity and enables translated function tools', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'jobos-gateway-catalog-'));
  try {
    const source = join(dir, 'native.json'), target = join(dir, 'local.json');
    await writeFile(source, JSON.stringify({ auth_context: 'PRIVATE_IDENTITY', models: [{ slug: 'gpt-6.1-sol', tool_mode: 'code_mode_only', context_window: 400000, available_access_programs: {}, base_instructions: 'STATIC_CLIENT_INSTRUCTIONS' }, { slug: 'other' }] }));
    assert.equal(prepareCodexCatalog(localModel, { source, target }), target);
    const saved = await readFile(target, 'utf8'), entry = JSON.parse(saved).models[0];
    assert.doesNotMatch(saved, /PRIVATE_IDENTITY|code_mode_only|400000/); assert.equal(JSON.parse(saved).models.length, 1);
    assert.equal(entry.slug, localModel); assert.equal(entry.context_window, 32768); assert.equal(entry.tool_mode, null); assert.equal(entry.use_responses_lite, false); assert.equal(entry.supports_search_tool, false);
    assert.equal(prepareCodexCatalog(localModel, { source: join(dir, 'absent'), target }), null);
  } finally { assert.ok(dir.startsWith(join(tmpdir(), 'jobos-gateway-catalog-'))); await rm(dir, { recursive: true, force: true }); }
});


test('Claude defaults to the auto pool for all model roles while Codex keeps its saved default', () => {
  assert.equal(defaultCodingModel('claude', secrets), 'auto:coding-quality');
  assert.equal(defaultCodingModel('codex', secrets), localModel);
  const automatic = codingLaunchConfig('claude', secrets, undefined, {});
  assert.deepEqual(automatic.args, ['--model', 'auto:coding-quality']);
  for (const key of ['ANTHROPIC_MODEL', 'ANTHROPIC_DEFAULT_OPUS_MODEL', 'ANTHROPIC_DEFAULT_SONNET_MODEL', 'ANTHROPIC_DEFAULT_HAIKU_MODEL', 'ANTHROPIC_CUSTOM_MODEL_OPTION']) assert.equal(automatic.env[key], 'auto:coding-quality');
  assert.equal(automatic.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS, '4096');
  assert.equal(automatic.env.CLAUDE_CODE_MAX_CONTEXT_TOKENS, '131072');
  assert.equal(automatic.env.CLAUDE_CODE_SUBAGENT_MODEL, 'auto:coding-quality');
  assert.equal(automatic.env.CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY, '0');
  assert.equal(automatic.env.CLAUDE_CODE_MAX_RETRIES, '0');
  assert.equal(automatic.env.API_TIMEOUT_MS, '90000');
  assert.equal(automatic.env.ANTHROPIC_AUTH_TOKEN, secrets.apiKey);
  assert.ok(codingLaunchConfig('codex', secrets, undefined, {}).args.includes('model=' + JSON.stringify(localModel)));
  assert.throws(() => defaultCodingModel('unknown', secrets), /Choose/);
});

test('explicit Claude model and output choices remain available without mutating caller settings', () => {
  const env = { CLAUDE_CODE_MAX_OUTPUT_TOKENS: '8192', PATH: 'KEEP' };
  const pinned = codingLaunchConfig('claude', secrets, localModel, env);
  assert.deepEqual(pinned.args, ['--model', localModel]);
  assert.equal(pinned.env.ANTHROPIC_DEFAULT_HAIKU_MODEL, localModel);
  assert.equal(pinned.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS, '8192');
  assert.deepEqual(env, { CLAUDE_CODE_MAX_OUTPUT_TOKENS: '8192', PATH: 'KEEP' });
});
