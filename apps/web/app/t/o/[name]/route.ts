import {internalApiUrl} from '../../../internal-api';
const gif=Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7','base64');
async function collect(request:Request,{params}:{params:Promise<{name:string}>}){const{name}=await params;const headers={'Content-Type':'image/gif','Cache-Control':'no-store, private, max-age=0','X-Content-Type-Options':'nosniff'};if(/^[A-Za-z0-9_-]{43}\.gif$/.test(name)){try{await fetch(internalApiUrl()+'/t/o/'+name,{method:request.method==='HEAD'?'HEAD':'GET',cache:'no-store',signal:AbortSignal.timeout(2000)})}catch{/* Never break recipient rendering. */}}return new Response(request.method==='HEAD'?null:gif,{headers})}
export const GET=collect;export const HEAD=collect;
