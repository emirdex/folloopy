import {cookies} from 'next/headers';
import {internalApiUrl,internalApiKey} from '../../internal-api';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {currentAccount} from '../../account-api';
import {blogMediaDirectory} from '../../blog-media-storage';
import {BLOG_IMAGE_LIMIT,blogImageType} from '../../../../../packages/domain/blog-media';
export const runtime='nodejs';
export async function POST(request:Request){
 const user=await currentAccount();if(!user||user.role!=='owner')return Response.json({error:'Yönetici girişi gerekli.'},{status:403});
 if(request.headers.get('origin')!==(process.env.SITE_URL||new URL(request.url).origin))return Response.json({error:'Geçersiz istek.'},{status:403});
 const length=Number(request.headers.get('content-length'));if(length>BLOG_IMAGE_LIMIT)return Response.json({error:'Görsel en fazla 5 MB olabilir.'},{status:413});
 const reader=request.body?.getReader();if(!reader)return Response.json({error:'Bir görsel seçin.'},{status:400});
 const chunks:Uint8Array[]=[];let size=0;
 while(true){const{done,value}=await reader.read();if(done)break;size+=value.length;if(size>BLOG_IMAGE_LIMIT){await reader.cancel();return Response.json({error:'Görsel en fazla 5 MB olabilir.'},{status:413})}chunks.push(value)}
 const bytes=Buffer.concat(chunks),type=blogImageType(bytes);if(!type)return Response.json({error:'PNG, JPEG veya WebP görsel yükleyin. SVG ve diğer dosyalar kabul edilmez.'},{status:415});
 if(process.env.NODE_ENV==='production'){const token=(await cookies()).get('mt_session')?.value||'';try{const res=await fetch(internalApiUrl()+'/api/admin/media',{method:'POST',headers:{Authorization:'Bearer '+internalApiKey(),'x-user-session':token,'Content-Type':'application/octet-stream'},body:bytes,signal:AbortSignal.timeout(20000),cache:'no-store'});return Response.json(await res.json(),{status:res.status,headers:{'Cache-Control':'no-store'}})}catch{return Response.json({error:'Görsel kaydedilemedi. Yeniden deneyin.'},{status:503})}}
 const name=randomUUID()+'.'+type.ext;await mkdir(blogMediaDirectory,{recursive:true});await writeFile(join(/* turbopackIgnore: true */ blogMediaDirectory,name),bytes,{flag:'wx'});
 return Response.json({url:'/blog/media/'+name},{status:201,headers:{'Cache-Control':'no-store'}});
}
