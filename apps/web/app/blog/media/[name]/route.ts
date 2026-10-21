import {internalApiFetch,internalApiUrl} from '../../../internal-api';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {blogMediaDirectory} from '../../../blog-media-storage';
import {isBlogImage,blogImageType} from '../../../../../../packages/domain/blog-media';
export const runtime='nodejs';
export async function GET(_request:Request,{params}:{params:Promise<{name:string}>}){
 const{name}=await params;if(!isBlogImage('/blog/media/'+name))return new Response(null,{status:404});
 if(process.env.NODE_ENV==='production'){try{const res=await internalApiFetch(internalApiUrl()+'/public/media/'+name,{signal:AbortSignal.timeout(15000),cache:'no-store'});return new Response(res.body,{status:res.status,headers:{'Content-Type':res.headers.get('Content-Type')||'application/octet-stream','Cache-Control':res.ok?'public, max-age=31536000, immutable':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}})}catch{return new Response(null,{status:503})}}
 try{const bytes=await readFile(join(/* turbopackIgnore: true */ blogMediaDirectory,name)),type=blogImageType(bytes);if(!type)return new Response(null,{status:404});return new Response(bytes,{headers:{'Content-Type':type.mime,'X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=31536000, immutable','Content-Security-Policy':"default-src 'none'; sandbox"}})}catch{return new Response(null,{status:404})}
}
