import {isMarketingMode} from '../packages/runtime/app-mode';
import {spawn,type ChildProcess} from 'node:child_process';
import {productionConfig} from '../packages/runtime/config';
if(isMarketingMode({...process.env,NODE_ENV:'production'})){
 const web=spawn(process.execPath,['node_modules/next/dist/bin/next','start','apps/web','--hostname','0.0.0.0','--port',String(process.env.PORT||3000)],{stdio:'inherit',env:{...process.env,NODE_ENV:'production',APP_MODE:'marketing'}});
 for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,()=>web.kill(signal));
 web.on('error',()=>process.exit(1));web.on('exit',code=>process.exit(code??1));
}else await startApplication();
async function startApplication(){
const config=productionConfig({...process.env,NODE_ENV:'production'});
const port=Number(process.env.PORT||3000);if(port===config.apiPort)throw Error('PUBLIC_AND_INTERNAL_PORT_MUST_DIFFER');
const env:NodeJS.ProcessEnv={...process.env,NODE_ENV:'production',INTERNAL_API_URL:config.apiUrl};
const api=spawn(process.execPath,['--import','tsx','apps/api/main.ts'],{stdio:'inherit',env});
let web:ChildProcess|undefined,stopping=false;
function stop(code=0){if(stopping)return;stopping=true;api.kill('SIGTERM');web?.kill('SIGTERM');setTimeout(()=>{api.kill('SIGKILL');web?.kill('SIGKILL');process.exit(code)},25000).unref();process.exitCode=code}
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
api.on('error',()=>stop(1));api.on('exit',code=>stop(code||1));
for(let i=0;i<60&&!stopping;i++){try{const res=await fetch(config.apiUrl+'/health',{signal:AbortSignal.timeout(1000)});if(res.ok)break}catch{}if(i===59){stop(1);throw Error('API_STARTUP_TIMEOUT')}await new Promise(r=>setTimeout(r,1000))}
if(!stopping){web=spawn(process.execPath,['node_modules/next/dist/bin/next','start','apps/web','--hostname','0.0.0.0','--port',String(port)],{stdio:'inherit',env});web.on('error',()=>stop(1));web.on('exit',code=>stop(code||1))}

}
