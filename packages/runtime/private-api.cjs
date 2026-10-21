// Process-local IPC transport. The private API never needs a public listener.
const {randomUUID}=require('node:crypto');
const clientKey=Symbol.for('folloopy.privateApiFetch');
const MAX_BODY=8*1024*1024;
function installPrivateApi(child,origin){
 let ready=false,closed=false;
 const pending=new Map();
 const fail=()=>{closed=true;for(const entry of pending.values())entry.reject(Error('PRIVATE_API_UNAVAILABLE'));pending.clear();};
 child.on('exit',fail);child.on('error',fail);
 child.on('message',message=>{
  if(message?.type==='folloopy-api-ready'){ready=true;return;}
  if(message?.type!=='folloopy-api-response')return;
  const entry=pending.get(message.id);if(!entry)return;
  pending.delete(message.id);
  if(message.error){entry.reject(Error('PRIVATE_API_REQUEST_FAILED'));return;}
  try{const bytes=Buffer.from(message.body,'base64');if(bytes.length>MAX_BODY)throw Error('PRIVATE_API_RESPONSE_TOO_LARGE');entry.resolve(new Response(entry.method==='HEAD'||[204,205,304].includes(message.status)?null:bytes,{status:message.status,headers:message.headers}));}catch(error){entry.reject(error);}
 });
 const request=async(url,init={})=>{
  const target=new URL(url);if(target.origin!==origin||target.username||target.password)throw Error('PRIVATE_API_ORIGIN_INVALID');
  if(closed||!ready)throw Error('PRIVATE_API_UNAVAILABLE');
  const method=init.method||'GET';
  let body='';if(init.body!=null){if(typeof init.body==='string')body=Buffer.from(init.body).toString('base64');else if(ArrayBuffer.isView(init.body))body=Buffer.from(init.body.buffer,init.body.byteOffset,init.body.byteLength).toString('base64');else throw Error('PRIVATE_API_BODY_INVALID');}
  if(Buffer.byteLength(body,'base64')>MAX_BODY)throw Error('PRIVATE_API_BODY_TOO_LARGE');
  const signal=init.signal||AbortSignal.timeout(30000);signal.throwIfAborted();
  const id=randomUUID();
  return new Promise((resolve,reject)=>{
   const abort=()=>{pending.delete(id);reject(signal.reason||Error('PRIVATE_API_ABORTED'));};
   const finish=fn=>value=>{signal.removeEventListener('abort',abort);fn(value);};
   pending.set(id,{resolve:finish(resolve),reject:finish(reject),method});signal.addEventListener('abort',abort,{once:true});
   child.send({type:'folloopy-api-request',id,method,url:target.pathname+target.search,headers:Object.fromEntries(new Headers(init.headers)),body},error=>{if(error){const entry=pending.get(id);pending.delete(id);entry?.reject(error);}});
  });
 };
 process[clientKey]=request;
 return request;
}
function privateApiFetch(url,init){const request=process[clientKey];return request?request(url,init):fetch(url,init);}
async function servePrivateApi(app,channel=process){
 await app.ready();
 channel.on('message',async m=>{
  if(m?.type!=='folloopy-api-request'||typeof m.id!=='string')return;
  try{
   if(typeof m.url!=='string'||!m.url.startsWith('/')||m.url.startsWith('//')||Buffer.byteLength(m.body,'base64')>MAX_BODY)throw Error('INVALID_PRIVATE_REQUEST');
   const response=await app.inject({method:m.method,url:m.url,headers:m.headers,...(m.body?{payload:Buffer.from(m.body,'base64')}:{})});
   channel.send?.({type:'folloopy-api-response',id:m.id,status:response.statusCode,headers:response.headers,body:response.rawPayload.toString('base64')});
  }catch{channel.send?.({type:'folloopy-api-response',id:m.id,error:true});}
 });
 channel.send({type:'folloopy-api-ready'});
}
module.exports={installPrivateApi,privateApiFetch,servePrivateApi};
