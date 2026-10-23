'use client';
import NextLink from 'next/link';
import type {ComponentProps} from 'react';
import {destinationHref} from '../../../packages/runtime/site-origins';
export default function Link(props:ComponentProps<typeof NextLink>){
 const href=typeof props.href==='string'?destinationHref(props.href,{NEXT_PUBLIC_SITE_URL:process.env.NEXT_PUBLIC_SITE_URL,NEXT_PUBLIC_APP_URL:process.env.NEXT_PUBLIC_APP_URL}):props.href;
 const path=typeof href==='string'?href:href.pathname;
 const workspace=typeof path==='string'&&/^(?:https?:\/\/[^/]+)?\/(?:panel|admin)(?:[/?#]|$)/.test(path);
 // Real pages must remain reachable even when a prefetched Flight response or
 // route chunk is stalled. Only the persistent member/admin workspaces use SPA
 // transitions; ordinary links retain the browser's native navigation behavior.
 if(typeof href==='string'&&!workspace){
  const {href:originalHref,prefetch,replace,scroll,shallow,locale,as,onNavigate,...anchor}=props;
  return <a {...anchor} href={href} onClick={event=>{
   props.onClick?.(event);
   if(!onNavigate||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.currentTarget.hasAttribute('download')||(event.currentTarget.target&&event.currentTarget.target!=='_self'))return;
   onNavigate({preventDefault:()=>event.preventDefault()});
  }}>{props.children}</a>;
 }
 return <NextLink {...props} href={href} prefetch={props.prefetch===undefined?false:props.prefetch} onNavigate={event=>{
  let cancelled=false;
  props.onNavigate?.({preventDefault(){cancelled=true;event.preventDefault()}});
  if(!cancelled&&workspace&&typeof window!=='undefined')window.dispatchEvent(new CustomEvent('folloopy:panel-navigate',{detail:{href,replace:props.replace===true}}));
 }}>{props.children}</NextLink>;
}
