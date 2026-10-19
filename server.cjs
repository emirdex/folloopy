// Hostinger: framework Other, entry server.cjs, build npm run build.
const {spawn}=require('node:child_process');
const path=require('node:path');
const child=spawn(process.execPath,['--import','tsx','scripts/start.ts'],{cwd:__dirname,env:{...process.env,NODE_ENV:'production'},stdio:'inherit'});
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>child.kill(signal));
child.on('error',()=>process.exit(1));child.on('exit',code=>process.exit(code??1));
