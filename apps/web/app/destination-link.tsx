'use client';
import NextLink from 'next/link';
import type {ComponentProps} from 'react';
import {destinationHref} from '../../../packages/runtime/site-origins';
export default function Link(props:ComponentProps<typeof NextLink>){
 const href=typeof props.href==='string'?destinationHref(props.href,{NEXT_PUBLIC_SITE_URL:process.env.NEXT_PUBLIC_SITE_URL,NEXT_PUBLIC_APP_URL:process.env.NEXT_PUBLIC_APP_URL}):props.href;
 // Panel destinations are request-bound. Prefetching every visible menu item
 // competes with the clicked route and its health probe on constrained hosts.
 const panel=typeof href==='string'&&/^(?:https?:\/\/[^/]+)?\/panel(?:[/?#]|$)/.test(href);
 return <NextLink {...props} href={href} prefetch={props.prefetch===undefined&&panel?false:props.prefetch} onNavigate={event=>{
  let cancelled=false;
  props.onNavigate?.({preventDefault(){cancelled=true;event.preventDefault()}});
  if(!cancelled&&typeof href==='string')window.dispatchEvent(new CustomEvent('folloopy:navigate',{detail:href}));
 }}>{props.children}</NextLink>;
}
