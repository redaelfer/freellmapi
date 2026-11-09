import {spawnSync} from 'node:child_process';
import {readdirSync} from 'node:fs';
import {join} from 'node:path';
let failed=false;
for(const dir of ['lib','scripts','test']) for(const file of readdirSync(dir).filter(n=>n.endsWith('.js'))){const r=spawnSync(process.execPath,['--check',join(dir,file)],{encoding:'utf8',windowsHide:true});if(r.status){failed=true;console.error(r.stderr);}}
if(failed)process.exit(1);console.log('Standalone JavaScript syntax checks passed.');
