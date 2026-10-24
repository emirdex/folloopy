// Log route categories only: never headers, cookies, query strings or bodies.
function requestCategory(raw){
 let path;try{path=new URL(raw,'http://local').pathname}catch{return '/other'}
 if(path.startsWith('/_next/static/'))return '/_next/static/*';
 const exact=['/','/panel','/admin','/blog','/iletisim','/giris','/kayit','/paketler','/odeme','/health','/sifremi-unuttum','/sifre-yenile'];
 if(exact.includes(path))return path;
 for(const prefix of ['/blog/','/yasal/','/hesap/','/baglantilar/','/t/','/brands/','/fonts/'])if(path.startsWith(prefix))return prefix+'*';
 return '/other';
}
function observeHttp(req,res,options={}){
 const now=options.now||Date.now,schedule=options.schedule||setTimeout,clear=options.clear||clearTimeout,log=options.log||console.warn;
 const started=now(),route=requestCategory(req.url),method=['GET','HEAD','POST'].includes(req.method)?req.method:'OTHER';
 let done=false;
 const report=(event,status)=>log('FOLLOOPY_HTTP_DIAGNOSTIC',JSON.stringify({event,route,method,phase:options.phase||'ready',durationMs:Math.max(0,now()-started),status}));
 const timer=schedule(()=>{if(!done)report('pending',null)},10000);timer?.unref?.();
 const finish=()=>{
  if(done)return;done=true;clear(timer);res.removeListener('finish',finish);res.removeListener('close',finish);
  if(now()-started>=10000||res.statusCode>=500||(route==='/_next/static/*'&&res.statusCode>=400))report(res.writableFinished?'completed':'aborted',res.writableFinished?res.statusCode:null);
 };
 res.once('finish',finish);res.once('close',finish);
}
module.exports={observeHttp,requestCategory};
