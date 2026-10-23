import {NextRequest,NextResponse} from 'next/server';
import {isMarketingMode} from '../../packages/runtime/app-mode';
import {isAccountPath,isPublicPath,siteOrigins} from '../../packages/runtime/site-origins';
export function proxy(request:NextRequest){
 const path=request.nextUrl.pathname;
 const {publicOrigin,appOrigin,split}=siteOrigins(process.env);
 if(split){
  const onPanel=process.env.DEPLOYMENT_ROLE==='panel'||request.nextUrl.host===new URL(appOrigin).host;
  let target:string|undefined;
  if(!onPanel&&isAccountPath(path))target=appOrigin+path+request.nextUrl.search;
  else if(!onPanel&&path==='/'&&['view','id','filter','mode','q'].some(key=>request.nextUrl.searchParams.has(key)))target=appOrigin+'/panel'+request.nextUrl.search;
  else if(onPanel&&path==='/')target=appOrigin+'/panel'+request.nextUrl.search;
  else if(onPanel&&isPublicPath(path))target=publicOrigin+path+request.nextUrl.search;
  else if(onPanel&&path==='/sitemap.xml')target=publicOrigin+path;
  if(target){
   // Never forward a password, action body or OAuth POST to another host.
   if(!['GET','HEAD'].includes(request.method))return new NextResponse('Bu işlem için hesap sayfasını yeniden açın.',{status:409,headers:{'Cache-Control':'no-store'}});
   const response=NextResponse.redirect(target,307);response.headers.set('Cache-Control','no-store');return response;
  }
  if(onPanel){const response=NextResponse.next();response.headers.set('X-Robots-Tag','noindex, nofollow');return response}
 }
 if(!isMarketingMode())return NextResponse.next();
 const privatePaths=['/admin','/api','/panel','/baglantilar','/t','/hesap'];
 if(privatePaths.some(p=>path===p||path.startsWith(p+'/')))return new NextResponse('Sayfa bulunamadı.',{status:404,headers:{'Cache-Control':'no-store'}});
 if(isAccountPath(path))return NextResponse.redirect(new URL('/iletisim',request.url),307);
 return NextResponse.next();
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|brands/).*)']};
