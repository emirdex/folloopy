'use client';
import NextLink from 'next/link';
import type {ComponentProps} from 'react';
import {destinationHref} from '../../../packages/runtime/site-origins';
export default function Link(props:ComponentProps<typeof NextLink>){
 const href=typeof props.href==='string'?destinationHref(props.href,{NEXT_PUBLIC_SITE_URL:process.env.NEXT_PUBLIC_SITE_URL,NEXT_PUBLIC_APP_URL:process.env.NEXT_PUBLIC_APP_URL}):props.href;
 // Authenticated panel pages must remain navigable even when an RSC stream
 // stalls. A real document link does not share the pending client-router queue
 // or its cached response, and works before hydration as well.
 const panel=typeof href==='string'&&/^(?:https?:\/\/[^/]+)?\/panel(?:[/?#]|$)/.test(href);
 if(panel&&typeof href==='string'){
  const{href:originalHref,as,prefetch,replace,scroll,shallow,passHref,legacyBehavior,locale,transitionTypes,onNavigate,onClick,...anchor}=props;
  return <a {...anchor} href={href} onClick={event=>{
   onClick?.(event);
   if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.currentTarget.target&&event.currentTarget.target!=='_self'||event.currentTarget.hasAttribute('download'))return;
   onNavigate?.({preventDefault:()=>event.preventDefault()});
   if(replace&&!event.defaultPrevented){event.preventDefault();window.location.replace(href)}
  }}>{props.children}</a>;
 }
 return <NextLink {...props} href={href}>{props.children}</NextLink>;
}
