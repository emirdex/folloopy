'use client';
import {useEffect,useRef,type ReactNode} from 'react';

/** Reveal the current item inside a horizontal mobile navigation, without moving the page. */
export function MobileNavigation({active,label,className,children}:{active:string;label:string;className?:string;children:ReactNode}){
 const nav=useRef<HTMLElement>(null);
 useEffect(()=>{
  const media=window.matchMedia('(max-width:900px)');
  const reveal=()=>{const element=nav.current,current=element?.querySelector<HTMLElement>('[aria-current="page"]');if(!media.matches||!element||!current||element.scrollWidth<=element.clientWidth)return;const outer=element.getBoundingClientRect(),item=current.getBoundingClientRect();element.scrollLeft+=item.left-outer.left-(element.clientWidth-item.width)/2};
  reveal();media.addEventListener('change',reveal);return()=>media.removeEventListener('change',reveal);
 },[active]);
 return <nav ref={nav} className={className} aria-label={label}>{children}</nav>;
}
