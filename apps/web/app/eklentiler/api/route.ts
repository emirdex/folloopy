import {internalApiFetch,internalApiKey,internalApiUrl} from '../../internal-api';
export const dynamic='force-dynamic';
function cors(req:Request){const origin=req.headers.get('origin')||'';return /^chrome-extension:\/\/[a-p]{32}$/.test(origin)?{'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Cache-Control':'no-store'}:null}
export async function OPTIONS(req:Request){const h=cors(req);return new Response(null,{status:h?204:403,headers:h||{}})}
export async function POST(req:Request){
 const h=cors(req);if(!h||process.env.DEPLOYMENT_ROLE!=='panel')return Response.json({code:'FORBIDDEN'},{status:403});
 try{
  if(Number(req.headers.get('content-length')||0)>15728640)return Response.json({code:'INVALID_ACCOUNT'},{status:413,headers:h});
  const reader=req.body?.getReader();if(!reader)throw Error();let size=0;const chunks:Uint8Array[]=[];
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>15728640){await reader.cancel();return Response.json({code:'INVALID_ACCOUNT'},{status:413,headers:h})}chunks.push(value)}
  const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  const r=await internalApiFetch(internalApiUrl()+'/api/extension/transport',{method:'POST',headers:{Authorization:'Bearer '+internalApiKey(),'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(25000)});
  return new Response(await r.text(),{status:r.status,headers:{...h,'Content-Type':'application/json'}});
 }catch{return Response.json({code:'SERVICE_UNAVAILABLE'},{status:503,headers:h})}
}
