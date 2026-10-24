// Hostinger/Passenger must see the public HTTP server in this entry process.
process.env.NODE_ENV='production';
const {createServer}=require('node:http');
const path=require('node:path');
const next=require('next');
const {installLocalApi}=require('./packages/runtime/private-api.cjs');
const {observeHttp}=require('./packages/runtime/http-diagnostics.cjs');
const {publicOrigin,guardPublicRequest,canonicalRedirect}=require('./packages/runtime/public-request.cjs');
const trustedOrigin=publicOrigin(process.env);
process.env.__NEXT_PRIVATE_ORIGIN=trustedOrigin;
const mode=process.env.APP_MODE||'marketing';
if(!['marketing','application'].includes(mode))throw new Error('CONFIG_APP_MODE_INVALID');
process.env.APP_MODE=mode;
const port=Number(process.env.PORT||3000);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('CONFIG_PORT_INVALID');
let apiRuntime,app,server,handle,stopping=false;
let releaseStartup;
const startupReady=new Promise(resolve=>{releaseStartup=resolve});
async function stop(code=0){
 if(stopping)return;stopping=true;
 releaseStartup();
 const force=setTimeout(()=>process.exit(code),25000);force.unref();
 if(server)await new Promise(resolve=>server.close(resolve));
 if(apiRuntime)await apiRuntime.close();
 if(app)await app.close();
 clearTimeout(force);process.exit(code);
}
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>stop(0).catch(()=>process.exit(1)));
async function start(){
 // Hostinger requires listen() before asynchronous database/API initialization.
 // Queue cold-start requests until both the private API and Next are ready.
 server=createServer((req,res)=>{
  observeHttp(req,res,{phase:handle?'ready':'startup'});
  const serve=async()=>{
   const canonical=canonicalRedirect(req,trustedOrigin,process.env.DEPLOYMENT_ROLE!=='panel');
   if(canonical){res.writeHead(308,{'Location':canonical,'Cache-Control':'no-store'});res.end();return;}
   const denied=guardPublicRequest(req,trustedOrigin);
   if(denied){res.writeHead(denied,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});res.end('Geçersiz istek kaynağı.');return;}

   if(!handle&&!stopping){let timer;await Promise.race([startupReady,new Promise(resolve=>{timer=setTimeout(resolve,30000);timer.unref?.()})]);clearTimeout(timer);}
   if(res.destroyed)return;
   if(!handle||stopping){res.writeHead(503,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','Retry-After':'2'});res.end('Uygulama hazırlanamadı. Lütfen kısa süre sonra yeniden deneyin.');return;}
   await handle(req,res);
  };
  serve().catch(()=>{if(!res.headersSent)res.writeHead(500,{'Content-Type':'text/plain; charset=utf-8'});res.end('İşlem tamamlanamadı.')});
 });
 server.on('error',error=>{console.error('FOLLOOPY_HTTP_START_FAILED',error.code||'UNKNOWN');stop(1)});
 server.listen(port,'0.0.0.0');
 if(mode==='application'){
  // Keep the private API in this process: managed hosts can restrict child workers.
  require('tsx/cjs');
  const {productionConfig}=require('./packages/runtime/config.ts');
  const config=productionConfig();
  process.env.INTERNAL_API_URL=config.apiUrl;
  const {startApi}=require('./apps/api/runtime.ts');
  apiRuntime=await startApi(config);
  if(stopping){await apiRuntime.close();return;}
  const requestApi=installLocalApi(apiRuntime.app,config.apiUrl);
  const response=await requestApi(config.apiUrl+'/health',{signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('API_DATABASE_UNAVAILABLE');
  console.log('Folloopy private API ready (same process)');
 }
 if(stopping)return;
 app=next({dev:false,dir:path.join(__dirname,'apps','web'),hostname:'0.0.0.0',port,webpack:true});
 await app.prepare();
 if(stopping)return;
 handle=app.getRequestHandler();
 releaseStartup();
 console.log('Folloopy public server ready ('+mode+')');
}
start().catch(error=>{console.error('FOLLOOPY_START_FAILED',error.code||error.message);stop(1).catch(()=>process.exit(1))});
