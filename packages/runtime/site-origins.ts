// Public values only: this module is also imported by browser components.
export function siteOrigins(env:Record<string,string|undefined>){
 const publicOrigin=origin(env.SITE_URL||env.NEXT_PUBLIC_SITE_URL||'http://127.0.0.1:3000');
 const appOrigin=origin(env.APP_URL||env.NEXT_PUBLIC_APP_URL||publicOrigin);
 return {publicOrigin,appOrigin,split:publicOrigin!==appOrigin};
}
function origin(value:string){const url=new URL(value);if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('CONFIG_ORIGIN_INVALID');return url.origin}
export function isAccountPath(path:string){return ['/giris','/kayit','/panel','/admin','/hesap','/paketler','/odeme','/sifre-yenile','/sifremi-unuttum','/baglantilar'].some(prefix=>path===prefix||path.startsWith(prefix+'/'))}
export function isPublicPath(path:string){return path==='/'||['/blog','/hakkimizda','/iletisim','/yasal'].some(prefix=>path===prefix||path.startsWith(prefix+'/'))}
export function destinationHref(href:string,env:Record<string,string|undefined>){
 if(!href.startsWith('/')||href.startsWith('//'))return href;
 const origins=siteOrigins(env);if(!origins.split)return href;
 const path=href.split(/[?#]/,1)[0];
 if(isAccountPath(path))return origins.appOrigin+href;
 if(isPublicPath(path))return origins.publicOrigin+href;
 return href;
}
