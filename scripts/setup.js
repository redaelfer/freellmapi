import { setupGateway } from '../lib/runtime.js';
try {
  const result = await setupGateway(undefined, phase => console.log(phase));
  console.log('FreeLLMAPI ready at ' + result.url + '. Default: ' + result.model);
  console.log('Private login/key: data/gateway/private.json.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
