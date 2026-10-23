'use client';
import NextLink from 'next/link';
import type {ComponentProps} from 'react';
import {destinationHref} from '../../../packages/runtime/site-origins';
export default function Link(props:ComponentProps<typeof NextLink>){
 const href=typeof props.href==='string'?destinationHref(props.href,{NEXT_PUBLIC_SITE_URL:process.env.NEXT_PUBLIC_SITE_URL,NEXT_PUBLIC_APP_URL:process.env.NEXT_PUBLIC_APP_URL}):props.href;
 const panel=typeof href==='string'&&/^(?:https?:\/\/[^/]+)?\/panel(?:[/?#]|$)/.test(href);
 // Preserve the current document while a panel response loads. Avoid starting
 // every authenticated menu request before the user chooses a destination.
 return <NextLink {...props} href={href} prefetch={panel&&props.prefetch===undefined?false:props.prefetch} onNavigate={event=>{
  let cancelled=false;
  props.onNavigate?.({preventDefault(){cancelled=true;event.preventDefault()}});
  if(!cancelled&&panel&&typeof window!=='undefined')window.dispatchEvent(new CustomEvent('folloopy:panel-navigate',{detail:{href,replace:props.replace===true}}));
 }}>{props.children}</NextLink>;
}
