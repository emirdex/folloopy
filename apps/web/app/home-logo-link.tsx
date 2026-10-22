'use client';
import {useEffect,useRef,useState,type MouseEvent,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import Link from './destination-link';
import {FolloopyEyes} from './folloopy-loading';
import './home-logo-link.css';

/** Only header logos that lead to the public homepage use this transition. */
export function HomeLogoLink({children,className}:{children:ReactNode;className?:string}){
 const [leaving,setLeaving]=useState(false);
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 useEffect(()=>{
  const reset=(event:PageTransitionEvent)=>{if(!event.persisted)return;if(timer.current)clearTimeout(timer.current);timer.current=null;setLeaving(false)};
  window.addEventListener('pageshow',reset);
  return ()=>{if(timer.current)clearTimeout(timer.current);window.removeEventListener('pageshow',reset)};
 },[]);
 function goHome(event:MouseEvent<HTMLAnchorElement>){
  if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.currentTarget.target==='_blank')return;
  const href=event.currentTarget.href,destination=new URL(href);
  if(destination.origin===window.location.origin&&window.location.pathname==='/'&&!window.location.search)return;
  event.preventDefault();
  if(timer.current)return;
  setLeaving(true);
  // The same timed eye animation as sign-in, scoped to this explicit logo click.
  timer.current=setTimeout(()=>window.location.assign(href),2000);
 }
 return <><Link href="/" className={className} onClick={goHome} aria-busy={leaving||undefined}>{children}</Link>{leaving?createPortal(<div className="home-return-overlay" role="status" aria-live="polite"><span className="sr-only">Ana sayfaya dönülüyor.</span><span className="home-return-scene" aria-hidden="true"><span className="home-return-aura"/><span className="home-return-sweep"/><span className="home-return-flight"><FolloopyEyes size={124}/></span><span className="home-return-shadow"/><span className="home-return-progress"/></span></div>,document.body):null}</>;
}
