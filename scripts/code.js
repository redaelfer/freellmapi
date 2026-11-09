import { runCodingClient } from '../lib/launch.js';
try { await runCodingClient(process.argv[2], process.argv.slice(3)); }
catch (error) { console.error(error.message); process.exitCode = 1; }
