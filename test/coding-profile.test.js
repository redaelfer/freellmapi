import test from 'node:test';
import assert from 'node:assert/strict';
import {selectCodingModels,ensureCodingProfile,ensurePinnedProfile,pinMembers,CLAUDE_ROUTE} from '../lib/coding-profile.js';

const good = {id:1, platform:'google', modelId:'gemini-3.6-flash', enabled:true, fallbackEnabled:true, supportsTools:true, contextWindow:1048576, keyCount:1};

test('quality defaults require the approved provider and model, enabled dashboard selection, tools, context and a key', () => {
  const rejected = [
    {contextWindow:65536}, {keyCount:0}, {supportsTools:false}, {enabled:false}, {fallbackEnabled:false},
    {platform:'custom', modelId:'qwen3:4b'}, {platform:'nvidia', modelId:'poolside/laguna-xs-2.1'},
    {platform:'openrouter', modelId:'dots-studio/dots-3-note-preview'}, {platform:'other', modelId:'meta/muse-glimmer-30b'}, {platform:'openrouter'}, {modelId:'gemini-3.5-flash-lite'}
  ].map((overrides, index) => ({...good, id:index+10, ...overrides}));
  const fallback = {...good, id:3, platform:'openrouter', modelId:'dots-studio/dots-3-note-preview:free'};
  const nvidia = {...good, id:4, platform:'nvidia', modelId:'meta/muse-glimmer-30b'};
  const rows = [fallback,good,...rejected,nvidia,{...good, id:2, modelId:'gemini-3.5-flash'}];
  assert.deepEqual(selectCodingModels(rows).map(row => row.modelDbId), [2,1,4,3]);
  assert.equal(CLAUDE_ROUTE, 'auto:coding-quality');
});

test('new quality chain starts empty and enrolls only eligible models', async () => {
  const request = async (path, options = {}) => {
    if (path === '/api/models') return [good];
    if (path === '/api/profiles' && !options.method) return [{id:1, name:'Default'}];
    if (path === '/api/profiles' && options.method === 'POST') {
      assert.equal(options.body.name, 'coding-quality');
      assert.equal(options.body.empty, true);
      return {id:7};
    }
    assert.equal(path, '/api/profiles/7/reorder');
    assert.deepEqual(options.body, [{modelDbId:1, priority:0, enabled:true}]);
    return {success:true};
  };
  assert.deepEqual(await ensureCodingProfile(request), {id:7, created:true, modelCount:1});
});

test('existing quality chain respects removals and rejects weak routes, empty chains and automatic additions', async () => {
  const request = (rows, includeNew = false) => async (path, options) => {
    assert.equal(options, undefined);
    if (path === '/api/profiles') return [{id:8, name:'coding-quality', auto_include_new_models:includeNew}];
    if (path === '/api/models') return [good];
    assert.equal(path, '/api/profiles/8/models');
    return rows;
  };
  const approved = {model_db_id:1, enabled:true};
  assert.equal((await ensureCodingProfile(request([approved, {model_db_id:2, enabled:false}]))).modelCount, 1);
  await assert.rejects(ensureCodingProfile(request([])), /empty/);
  await assert.rejects(ensureCodingProfile(request([approved], true)), /automatic model additions/);
  await assert.rejects(ensureCodingProfile(request([approved, {model_db_id:99, enabled:true}])), /Check the coding-quality/);
});

test('no eligible models stops setup before creating a chain', async () => {
  await assert.rejects(ensureCodingProfile(async (path, options) => {
    assert.equal(options, undefined);
    return [];
  }), /Enable an approved coding route/);
});

test('explicit aliases resolve through the catalog group without leaking into unrelated or remote endpoints',()=>{
  const rows=[{modelDbId:1,canonicalId:'north-mini-code',modelId:'cohere/north-mini-code:free'},{modelDbId:2,canonicalId:'local-ollama-coder',modelId:'coder:latest',qualifiedModelId:'custom-local/coder:latest'},{modelDbId:3,canonicalId:'remote-coder',modelId:'coder:latest',qualifiedModelId:'custom-remote/coder:latest'}];
  assert.deepEqual(pinMembers('north-mini-code',rows),[1]);
  assert.deepEqual(pinMembers('local-ollama-coder',rows),[2]);
  assert.deepEqual(pinMembers('custom-remote/coder:latest',rows),[3]);
  assert.throws(()=>pinMembers('misspelled-model',rows),/no automatic fallback/);
});

test('an explicit model pin creates only its exact route and is idempotent',async()=>{
  let profile, members=[];let updates=0;
  const request=async(path,opts={})=>{
    if(path==='/api/fallback')return[{modelDbId:8,canonicalId:'selected',modelId:'vendor/selected'},{modelDbId:9,canonicalId:'other',modelId:'vendor/other'}];
    if(path==='/api/profiles'&&!opts.method)return profile?[profile]:[];
    if(path==='/api/profiles'&&opts.method==='POST'){assert.equal(opts.body.empty,true);profile={id:10,name:opts.body.name};return profile;}
    if(path==='/api/profiles/10/models')return members;
    if(path==='/api/profiles/10/reorder'){updates++;members=opts.body.map(r=>({model_db_id:r.modelDbId,enabled:r.enabled}));return{success:true};}
    throw Error('Unexpected mutation');
  };
  const route=await ensurePinnedProfile('selected',request);assert.match(route,/^auto:pin-[a-f0-9]{12}$/);assert.deepEqual(members,[{model_db_id:8,enabled:true}]);
  assert.equal(await ensurePinnedProfile('selected',request),route);assert.equal(updates,1);
});
