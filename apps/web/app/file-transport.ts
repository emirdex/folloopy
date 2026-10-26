import 'server-only';
import {cookies} from 'next/headers';
import {internalApiFetch,internalApiKey,internalApiUrl} from './internal-api';
import {FILE_CHUNK_SIZE} from '../../../packages/domain/file-sharing';
export async function fileTransport(req:Request,path:string,publicShare=false){
 const headersOut={'Cache-Control':'no-store, private','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
 if(process.env.DEPLOYMENT_ROLE==='public')return Response.json({code:'FORBIDDEN'},{status:403,headers:headersOut});
 if(req.method==='POST'&&req.headers.get('origin')!==new URL(process.env.APP_URL||process.env.NEXT_PUBLIC_APP_URL||process.env.SITE_URL||req.url).origin)return Response.json({code:'FORBIDDEN'},{status:403,headers:headersOut});
 const session=(await cookies()).get('mt_session')?.value;
 if(!publicShare&&!session)return Response.json({code:'UNAUTHORIZED'},{status:401,headers:headersOut});
 try{
  let body:Buffer|undefined;
  if(req.method==='POST'){
   const limit=path.includes('/chunks/')?FILE_CHUNK_SIZE:path==='/api/member-tools/schedules'?15*1024*1024:4096;if(Number(req.headers.get('content-length')||0)>limit)return Response.json({code:'INVALID_FILE'},{status:413,headers:headersOut});
   const reader=req.body?.getReader(),chunks:Uint8Array[]=[];let size=0;
   if(reader)for(;;){const r=await reader.read();if(r.done)break;size+=r.value.byteLength;if(size>limit){await reader.cancel();return Response.json({code:'INVALID_FILE'},{status:413,headers:headersOut})}chunks.push(r.value)}
   body=Buffer.concat(chunks);
  }
  const type=path.includes('/chunks/')?'application/octet-stream':'application/json';
  const response=await internalApiFetch(internalApiUrl()+path,{method:req.method,headers:{Authorization:'Bearer '+internalApiKey(),...(publicShare?{'x-file-session':req.headers.get('x-file-session')||'','user-agent':req.headers.get('user-agent')||'','sec-purpose':req.headers.get('sec-purpose')||''}:{'x-user-session':session!}),...(body?.length?{'Content-Type':type}:{})},...(body?.length?{body:new Uint8Array(body)}:{}),signal:AbortSignal.timeout(25000),cache:'no-store'});
  return new Response(new Uint8Array(await response.arrayBuffer()),{status:response.status,headers:{...headersOut,'Content-Type':response.headers.get('content-type')||'application/json','Content-Security-Policy':"default-src 'none'; sandbox"}});
 }catch{return Response.json({code:'FILE_UNAVAILABLE'},{status:503,headers:headersOut})}
}
