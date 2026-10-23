'use client';
import {useEffect,useRef} from 'react';
import {usePathname,useSearchParams} from 'next/navigation';

// A stalled RSC request must not leave a clicked panel link pending forever.
// Ordinary transitions commit and cancel this timer without a document reload.
export function NavigationRecovery(){
 const pathname=usePathname(),query=useSearchParams().toString();
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const clear=()=>{if(timer.current!==null)clearTimeout(timer.current);timer.current=null};
 useEffect(()=>{clear()},[pathname,query]);
 useEffect(()=>{
  const navigate=(event:Event)=>{
   const href=(event as CustomEvent<unknown>).detail;
   if(typeof href!=='string')return;
   const target=new URL(href,window.location.href);
   clear();
   if(target.origin!==window.location.origin||target.pathname!=='/panel')return;
   if(target.pathname+target.search===window.location.pathname+window.location.search)return;
   timer.current=setTimeout(()=>{timer.current=null;window.location.assign(target.href)},7000);
  };
  window.addEventListener('folloopy:navigate',navigate);
  window.addEventListener('popstate',clear);
  window.addEventListener('pagehide',clear);
  return()=>{clear();window.removeEventListener('folloopy:navigate',navigate);window.removeEventListener('popstate',clear);window.removeEventListener('pagehide',clear)};
 },[]);
 return null;
}
