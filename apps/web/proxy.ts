import {NextRequest,NextResponse} from 'next/server';
import {isMarketingMode} from '../../packages/runtime/app-mode';
export function proxy(request:NextRequest){
 if(!isMarketingMode())return NextResponse.next();
 const path=request.nextUrl.pathname;
 const privatePaths=['/admin','/api','/panel','/baglantilar','/t','/hesap'];
 if(privatePaths.some(p=>path===p||path.startsWith(p+'/')))return new NextResponse('Sayfa bulunamadı.',{status:404,headers:{'Cache-Control':'no-store'}});
 return NextResponse.redirect(new URL('/iletisim',request.url),307);
}
export const config={matcher:['/admin/:path*','/api/:path*','/panel/:path*','/baglantilar/:path*','/t/:path*','/hesap/:path*','/giris','/kayit','/paketler','/odeme','/sifremi-unuttum','/sifre-yenile']};
