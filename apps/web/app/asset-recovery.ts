import {interactionTraceScript} from './interaction-trace';
// Independent of React: missing hydration chunks can prevent React effects
// (including error boundaries) from ever attaching their handlers. The module
// is async so it can also run while a stylesheet is delayed.
export const assetRecoveryScript=String.raw`(function(){
 let pending,watchdog,edited=false;
 const cancel=()=>{if(pending!==undefined)clearTimeout(pending);pending=undefined;if(watchdog!==undefined)clearTimeout(watchdog);watchdog=undefined};
 const ownAsset=value=>{try{const url=new URL(value,location.href);return url.origin===location.origin&&url.pathname.startsWith('/_next/static/')&&/\.(js|css)$/.test(url.pathname)}catch{return false}};
 const edit=()=>{edited=true;cancel()};
 const failed=()=>{
  if(edited||pending!==undefined)return;
  pending=setTimeout(()=>{
   pending=undefined;
   if(edited)return;
   // Storage failure must not turn a broken network into a reload loop.
   try{
    const key='folloopy:asset-retry:'+location.pathname,last=Number(sessionStorage.getItem(key)||0),now=Date.now();
    if(last&&now-last<300000)return;
    sessionStorage.setItem(key,String(now));
   }catch{return}
   // Navigate with GET; never replay a preceding server-action/form POST.
   location.replace(location.href.split('#')[0]);
  },1500);
 };
 window.addEventListener('error',event=>{
  const target=event.target;
  const source=target?.tagName==='SCRIPT'?target.src:target?.tagName==='LINK'&&target.rel==='stylesheet'?target.href:'';
  if(source&&ownAsset(source))failed();
 },true);
 window.addEventListener('unhandledrejection',event=>{
  const reason=event.reason;
  if(reason?.name==='ChunkLoadError'||/Loading chunk \S+ failed/.test(String(reason?.message||'')))failed();
 });
 // Catch completed failures as well as subsequent resource error events.
 for(const entry of performance.getEntriesByType('resource')){
  if(entry.responseStatus>=400&&ownAsset(entry.name)){failed();break}
 }
 // Stalled styles or bootstrap scripts can leave content/hydration pending
 // without an error event. Ignore intentionally skipped nomodule scripts.
 // Keep the same edit/navigation protections and five-minute loop guard.
 watchdog=setTimeout(()=>{
  watchdog=undefined;
  const completed=new Set(performance.getEntriesByType('resource').map(entry=>entry.name));
  const pendingScript=[...document.scripts].some(script=>script.src&&!script.noModule&&ownAsset(script.src)&&!completed.has(script.src));
  if(pendingScript||[...document.querySelectorAll('link[rel="stylesheet"]')].some(link=>ownAsset(link.href)&&!link.sheet))failed();
 },20000);
 window.addEventListener('folloopy:asset-failure',failed);
 window.addEventListener('pagehide',cancel);
 window.addEventListener('beforeinput',edit,true);
 window.addEventListener('change',edit,true);
 window.addEventListener('submit',edit,true);
 // A newer navigation must not be replaced by an older recovery timeout.
 window.addEventListener('click',event=>{if(event.target instanceof Element&&event.target.closest('a[href]'))cancel()},true);
})();`+'\n'+interactionTraceScript;
