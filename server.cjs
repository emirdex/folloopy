// Hostinger/Passenger must see the public HTTP server in this entry process.
process.env.NODE_ENV='production';
const {createServer}=require('node:http');
const {spawn}=require('node:child_process');
const path=require('node:path');
const next=require('next');
const {installPrivateApi}=require('./packages/runtime/private-api.cjs');
const mode=process.env.APP_MODE||'marketing';
if(!['marketing','application'].includes(mode))throw new Error('CONFIG_APP_MODE_INVALID');
process.env.APP_MODE=mode;
const port=Number(process.env.PORT||3000);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('CONFIG_PORT_INVALID');
let api,app,server,handle,stopping=false;
async function stop(code=0){
 if(stopping)return;stopping=true;
 const force=setTimeout(()=>{api?.kill('SIGKILL');process.exit(code)},25000);force.unref();
 api?.kill('SIGTERM');
 if(server)await new Promise(resolve=>server.close(resolve));
 if(app)await app.close();
 clearTimeout(force);process.exit(code);
}
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>stop(0).catch(()=>process.exit(1)));
async function start(){
 // Hostinger requires listen() before asynchronous database/API initialization.
 // Keep requests unavailable until both the private API and Next are ready.
 server=createServer((req,res)=>{
  if(!handle||stopping){res.writeHead(503,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','Retry-After':'2'});res.end('Uygulama hazırlanıyor. Lütfen kısa süre sonra yeniden deneyin.');return;}
  Promise.resolve().then(()=>handle(req,res)).catch(()=>{if(!res.headersSent)res.writeHead(500,{'Content-Type':'text/plain; charset=utf-8'});res.end('İşlem tamamlanamadı.')});
 });
 server.on('error',error=>{console.error('FOLLOOPY_HTTP_START_FAILED',error.code||'UNKNOWN');stop(1)});
 server.listen(port,'0.0.0.0');
 if(mode==='application'){
  // TypeScript is only required for the private API, never for a public-only launch.
  require('tsx/cjs');
  const {productionConfig}=require('./packages/runtime/config.ts');
  const config=productionConfig();
  if(port===config.apiPort)throw Error('PUBLIC_AND_INTERNAL_PORT_MUST_DIFFER');
  process.env.INTERNAL_API_URL=config.apiUrl;
  api=spawn(process.execPath,['--import','tsx','apps/api/main.ts'],{cwd:__dirname,env:{...process.env,FOLLOOPY_API_TRANSPORT:'ipc'},stdio:['inherit','inherit','inherit','ipc']});
  api.on('error',()=>stop(1));api.on('exit',()=>{if(!stopping)stop(1)});
  const requestApi=installPrivateApi(api,config.apiUrl);
  let ready=false;
  for(let i=0;i<60&&!stopping;i++){try{const response=await requestApi(config.apiUrl+'/health',{signal:AbortSignal.timeout(1000)});if(response.ok){ready=true;break}if(i===0)console.log('Folloopy API readiness status',response.status)}catch(error){if(i===0)console.log('Folloopy API readiness pending',error.cause?.code||error.name)}await new Promise(resolve=>setTimeout(resolve,1000))}
  if(!ready)throw Error('API_STARTUP_TIMEOUT');
 }
 if(stopping)return;
 app=next({dev:false,dir:path.join(__dirname,'apps','web'),hostname:'0.0.0.0',port,webpack:true});
 await app.prepare();
 if(stopping)return;
 handle=app.getRequestHandler();
 console.log('Folloopy public server ready ('+mode+')');
}
start().catch(error=>{console.error('FOLLOOPY_START_FAILED',error.code||error.message);stop(1).catch(()=>process.exit(1))});
