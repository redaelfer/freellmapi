import { gatewaySecrets, gatewayRequest, startGateway } from '../lib/runtime.js';
try {
  await startGateway(); const config = gatewaySecrets();
  const result = await gatewayRequest('/v1/models', { token: config.apiKey });
  console.log('Default: ' + config.model);
  console.log('Available catalog entries; provider quotas and tool compatibility still apply:');
  for (const model of result.data || []) if (model.available !== false) console.log(model.id + ' · ' + (model.name || model.id));
} catch (error) { console.error(error.message); process.exitCode = 1; }
