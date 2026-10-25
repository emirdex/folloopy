// Opt-in, session-local console diagnostics. No DOM changes or network reports.
export const interactionTraceScript=String.raw`(function(){
 let enabled=false;
 try{
  if(new URL(location.href).searchParams.get('__interaction_trace')==='1')sessionStorage.setItem('folloopy:interaction-trace',String(Date.now()+1800000));
  enabled=Number(sessionStorage.getItem('folloopy:interaction-trace')||0)>Date.now();
 }catch{}
 if(!enabled)return;
 const roots=new Set(['panel','admin','blog','iletisim','hakkimizda','giris','kayit','paketler','odeme','yasal','hesap','baglantilar','t','sifremi-unuttum','sifre-yenile']);
 const route=path=>path==='/'?'/':roots.has(path.split('/')[1])?'/'+path.split('/')[1]:'/other';
 const trace=(stage,data={})=>console.warn('FOLLOOPY_UI_TRACE',JSON.stringify({stage,path:route(location.pathname),...data}));
 const asset=name=>{try{const url=new URL(name,location.href);return url.origin===location.origin&&url.pathname.startsWith('/_next/static/')?url.pathname.split('/').pop():''}catch{return ''}};
 const resources=()=>{
  try{for(const entry of performance.getEntriesByType('resource')){const file=asset(entry.name);if(file)trace('asset',{file,status:entry.responseStatus||0,ms:Math.round(entry.duration),bytes:entry.decodedBodySize||0})}}catch{}
 };
 window.addEventListener('error',event=>{const file=asset(event.target?.src||event.filename);trace('error',{file,kind:event.target?.tagName==='SCRIPT'?'script':'runtime'})},true);
 window.addEventListener('unhandledrejection',event=>trace('rejection',{kind:event.reason?.name==='ChunkLoadError'?'chunk':'other'}));
 window.addEventListener('load',resources);
 setTimeout(resources,5000);
 document.addEventListener('pointerdown',()=>trace('pointerdown'),true);
 document.addEventListener('click',event=>{
  const anchor=event.target instanceof Element?event.target.closest('a[href]'):null;
  let to='';try{if(anchor){const url=new URL(anchor.href,location.href);to=url.origin===location.origin&&/^https?:$/.test(url.protocol)?route(url.pathname):'external'}}catch{}
  trace('click:start',{to});queueMicrotask(()=>trace('click:end',{prevented:event.defaultPrevented}));
 },true);
 window.addEventListener('pagehide',event=>trace('pagehide',{persisted:event.persisted}));
 let last=Date.now(),ticks=0;
 window.addEventListener('pageshow',event=>{last=Date.now();trace('pageshow',{persisted:event.persisted})});
 setInterval(()=>{const now=Date.now(),lag=now-last-1000;last=now;if(document.hidden)return;if(lag>2000)trace('main-thread:lag',{ms:Math.round(lag)});if(++ticks%10===0)trace('alive')},1000);
 try{if(typeof PerformanceObserver==='function'&&PerformanceObserver.supportedEntryTypes?.includes('longtask'))new PerformanceObserver(list=>{for(const entry of list.getEntries())if(entry.duration>=1000)trace('longtask',{ms:Math.round(entry.duration)})}).observe({type:'longtask',buffered:true})}catch{}
 trace('boot',{ready:document.readyState});
})();`;

export function traceSection(stage:string,ms=0){
 try{
  if(new URL(location.href).searchParams.get('__interaction_trace')==='1')sessionStorage.setItem('folloopy:interaction-trace',String(Date.now()+1800000));
  if(Number(sessionStorage.getItem('folloopy:interaction-trace')||0)>Date.now())console.warn('FOLLOOPY_UI_TRACE',JSON.stringify({stage,path:'/',ms:Math.round(ms)}));
 }catch{}
}
