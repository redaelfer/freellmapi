import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, copyFile, readdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { EventEmitter } from 'node:events';
import { spawnSync } from 'node:child_process';
import { parseLaunchArgs } from '../lib/launch.js';
import { packageRoot, gatewayRoot, gatewayRepo, claudeExecutable, defaultCodingModel } from '../lib/runtime.js';
import { ensureLocalOllama, listLocalModels } from '../lib/ollama.js';

test('gateway source, private state and Claude installation all belong to this standalone folder', () => {
  assert.equal(gatewayRoot, join(packageRoot, 'data/gateway'));
  assert.equal(gatewayRepo, join(packageRoot, 'upstream'));
  assert.ok(claudeExecutable.startsWith(join(packageRoot, 'data/coding-tools')));
});

test('launch parsing preserves client arguments and resolves a target project without changing process cwd', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'freellmapi-launch-'));
  try {
    await mkdir(join(folder, 'project with spaces'));
    const original = process.cwd(), input = ['--cwd', 'project with spaces', '--model', 'local-ollama-model', '--print', 'synthetic task'];
    const result = parseLaunchArgs('claude', input, 'default', folder);
    assert.equal(result.cwd, join(folder, 'project with spaces')); assert.equal(result.model, 'local-ollama-model');
    assert.deepEqual(result.args, ['--print', 'synthetic task']); assert.equal(input.length, 6); assert.equal(process.cwd(), original);
    assert.equal(parseLaunchArgs('codex', [], 'default', folder).cwd, folder);
    const defaults = { model: 'local-ollama-jobos-coderlatest' };
    assert.equal(parseLaunchArgs('claude', ['--cwd', 'project with spaces'], defaultCodingModel('claude', defaults), folder).model, 'auto:coding-quality');
    assert.equal(parseLaunchArgs('claude', ['--model', 'chosen-model'], defaultCodingModel('claude', defaults), folder).model, 'chosen-model');
    for (const args of [['--model'], ['--cwd'], ['--model', '--print'], ['--cwd', 'absent']]) assert.throws(() => parseLaunchArgs('codex', args, 'default', folder));
  } finally { assert.ok(folder.startsWith(join(tmpdir(), 'freellmapi-launch-'))); await rm(folder, { recursive: true, force: true }); }
});

test('standalone public package works when copied away from JobOS, without its libraries or dependencies', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'freellmapi-isolated-'));
  try {
    await copyFile(join(packageRoot, 'package.json'), join(folder, 'package.json'));
    for (const dir of ['lib', 'scripts']) {
      await mkdir(join(folder, dir));
      for (const file of await readdir(join(packageRoot, dir))) if (file.endsWith('.js')) await copyFile(join(packageRoot, dir, file), join(folder, dir, file));
    }
    const result = spawnSync(process.execPath, ['scripts/code.js', 'codex', '--help'], { cwd: folder, encoding: 'utf8', timeout: 15000, windowsHide: true });
    assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /npm run codex/);
    assert.equal((await readFile(join(folder, 'package.json'), 'utf8')).includes('"dependencies"'), false);
  } finally { assert.ok(folder.startsWith(join(tmpdir(), 'freellmapi-isolated-'))); await rm(folder, { recursive: true, force: true }); }
});

test('running external Ollama requires no portable runtime and lists only downloaded valid names', async () => {
  await ensureLocalOllama(() => {}, { fetcher: async () => new Response('{}'), processSpawn: () => assert.fail('Do not start a duplicate Ollama service') });
  const result = await listLocalModels({ fetcher: async () => Response.json({ models: [{ name: 'qwen3:4b', private: 'NOT_RETURNED' }, { name: 'https://bad.example/model' }, { name: 'model:cloud' }] }) });
  assert.deepEqual(result, [{ name: 'qwen3:4b' }]);
});

test('standalone Ollama startup uses a configured model directory, strips API credentials and keeps normal process controls', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'freellmapi-ollama-')); let calls = 0, launched;
  try {
    const executable = join(folder, 'ollama.exe'); await writeFile(executable, 'synthetic fixture, never executed');
    await ensureLocalOllama(() => {}, { env: { OLLAMA_EXECUTABLE: executable, OLLAMA_MODELS: folder, GEMINI_API_KEY: 'PRIVATE', ANTHROPIC_AUTH_TOKEN: 'PRIVATE' }, pause: async () => {}, fetcher: async () => { if (++calls === 1) throw Error('not running'); return new Response('{}'); }, processSpawn: (command, args, options) => {
      launched = { command, args, options }; return Object.assign(new EventEmitter(), { unref() {} });
    } });
    assert.equal(launched.command, executable); assert.deepEqual(launched.args, ['serve']); assert.equal(launched.options.shell, false); assert.equal(launched.options.windowsHide, true);
    assert.equal(launched.options.env.OLLAMA_MODELS, folder); assert.equal(launched.options.env.OLLAMA_HOST, '127.0.0.1:11434'); assert.equal(launched.options.env.GEMINI_API_KEY, undefined); assert.equal(launched.options.env.ANTHROPIC_AUTH_TOKEN, undefined);
  } finally { assert.ok(folder.startsWith(join(tmpdir(), 'freellmapi-ollama-'))); await rm(folder, { recursive: true, force: true }); }
});
