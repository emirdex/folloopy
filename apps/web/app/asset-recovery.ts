import {interactionTraceScript} from './interaction-trace';
// Independent of React: missing hydration chunks can prevent React effects
// (including error boundaries) from ever attaching their handlers. The module
// script never blocks HTML parsing while a stylesheet is delayed.
export const assetRecoveryScript=String.raw`(function(){
 let pending,edited=false;
 const cancel=()=>{if(pending!==undefined)clearTimeout(pending);pending=undefined};
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
  if(target?.tagName!=='SCRIPT'||!target.src)return;
  try{const url=new URL(target.src,location.href);if(url.origin===location.origin&&url.pathname.startsWith('/_next/static/')&&url.pathname.endsWith('.js'))failed()}catch{}
 },true);
 window.addEventListener('unhandledrejection',event=>{
  const reason=event.reason;
  if(reason?.name==='ChunkLoadError'||/Loading chunk \S+ failed/.test(String(reason?.message||'')))failed();
 });
 // A module runs after HTML parsing. Catch script HTTP failures that finished
 // before its listeners attached as well as subsequent resource error events.
 for(const entry of performance.getEntriesByType('resource')){
  try{const url=new URL(entry.name,location.href);if(entry.responseStatus>=400&&url.origin===location.origin&&url.pathname.startsWith('/_next/static/')&&url.pathname.endsWith('.js')){failed();break}}catch{}
 }
 window.addEventListener('folloopy:asset-failure',failed);
 window.addEventListener('pagehide',cancel);
 window.addEventListener('beforeinput',edit,true);
 window.addEventListener('change',edit,true);
 window.addEventListener('submit',edit,true);
 // A newer navigation must not be replaced by an older recovery timeout.
 window.addEventListener('click',event=>{if(event.target instanceof Element&&event.target.closest('a[href]'))cancel()},true);
})();`+'\n'+interactionTraceScript;
