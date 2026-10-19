import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
const env={...process.env,DEV_API_KEY:process.env.DEV_API_KEY||randomBytes(32).toString('base64url')};
const children=[spawn(process.execPath,['--import','tsx','apps/api/main.ts'],{stdio:'inherit',env}),spawn(process.execPath,['node_modules/next/dist/bin/next','dev','apps/web','--hostname','127.0.0.1','--port','3000'],{stdio:'inherit',env})];
let stopping=false;
function stop(){if(stopping)return;stopping=true;for(const child of children)child.kill('SIGTERM')}
process.on('SIGINT',stop);process.on('SIGTERM',stop);for(const child of children)child.on('exit',stop);
