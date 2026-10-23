'use client';
import {useEffect} from 'react';
import {usePathname,useSearchParams} from 'next/navigation';
import {panelNavigationGuard} from '../../../../packages/domain/panel-navigation';
import './panel-navigation.css';

export function PanelNavigation(){
 const pathname=usePathname(),query=useSearchParams().toString();
 useEffect(()=>{window.dispatchEvent(new Event('folloopy:panel-committed'))},[pathname,query]);
 useEffect(()=>{
  const guard=panelNavigationGuard({paths:['/panel','/admin'],current:()=>window.location.href,recover:(href,replace)=>{if(replace)window.location.replace(href);else window.location.assign(href)},schedule:(run,ms)=>window.setTimeout(run,ms),cancel:timer=>window.clearTimeout(timer as number)});
  const navigate=(event:Event)=>{
   const detail=(event as CustomEvent<unknown>).detail;
   if(!detail||typeof detail!=='object'||!('href' in detail)||typeof detail.href!=='string')return;
   document.querySelector('.member-panel-page')?.classList.add('has-client-navigation');
   guard.navigate(detail.href,'replace' in detail&&detail.replace===true);
  };
  const commit=()=>guard.commit(window.location.href);
  const cancel=()=>guard.cancel();
  window.addEventListener('folloopy:panel-navigate',navigate);
  window.addEventListener('folloopy:panel-committed',commit);
  window.addEventListener('popstate',cancel);
  window.addEventListener('pagehide',cancel);
  return()=>{guard.cancel();window.removeEventListener('folloopy:panel-navigate',navigate);window.removeEventListener('folloopy:panel-committed',commit);window.removeEventListener('popstate',cancel);window.removeEventListener('pagehide',cancel)};
 },[]);
 return null;
}
