import test from 'node:test';
import assert from 'node:assert/strict';
import {startWorkspace} from '../lib/bootstrap.js';
test('cloud dashboard stays available when an optional local model runtime is absent',async()=>{const calls=[];const r=await startWorkspace({readConfig:()=>({model:'local-ollama-test'}),start:async()=>calls.push('gateway'),ensureOllama:async()=>{calls.push('ollama');throw Error('PRIVATE_DIAGNOSTIC');}});assert.deepEqual(calls,['gateway','ollama']);assert.deepEqual(r,{localReady:false});assert.doesNotMatch(JSON.stringify(r),/PRIVATE/);});
test('explicit cloud defaults do not require Ollama or any JobOS service',async()=>{const r=await startWorkspace({readConfig:()=>({model:'explicit-cloud-id'}),start:async()=>{},ensureOllama:async()=>assert.fail('No local dependency for cloud')});assert.deepEqual(r,{localReady:null});});
