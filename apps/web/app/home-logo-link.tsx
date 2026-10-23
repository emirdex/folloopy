'use client';
import {useEffect,useRef,useState,type MouseEvent,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import Link from './destination-link';
import {FolloopyEyes} from './folloopy-loading';
import {homeReturnTransition} from '../../../packages/domain/home-return';
import './home-logo-link.css';

/** Only header logos that lead to the public homepage use this transition. */
export function HomeLogoLink({children,className}:{children:ReactNode;className?:string}){
 const [leaving,setLeaving]=useState(false);
 const transition=useRef<ReturnType<typeof homeReturnTransition>|null>(null);
 if(!transition.current)transition.current=homeReturnTransition({schedule:setTimeout,clear:timer=>clearTimeout(timer as ReturnType<typeof setTimeout>),navigate:href=>window.location.assign(href),visible:setLeaving});
 useEffect(()=>{
  const reset=()=>transition.current?.cancel();
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')reset()};
  window.addEventListener('pageshow',reset);
  window.addEventListener('pagehide',reset);
  window.addEventListener('pointerdown',reset,true);
  window.addEventListener('keydown',escape);
  return ()=>{transition.current?.dispose();window.removeEventListener('pageshow',reset);window.removeEventListener('pagehide',reset);window.removeEventListener('pointerdown',reset,true);window.removeEventListener('keydown',escape)};
 },[]);
 function goHome(event:MouseEvent<HTMLAnchorElement>){
  if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.currentTarget.target==='_blank')return;
  const href=event.currentTarget.href,destination=new URL(href);
  if(destination.origin===window.location.origin&&window.location.pathname==='/'&&!window.location.search)return;
  event.preventDefault();
  // The same timed eye animation as sign-in, scoped to this explicit logo click.
  transition.current?.start(href);
 }
 return <><Link href="/" className={className} onClick={goHome} aria-busy={leaving||undefined}>{children}</Link>{leaving?createPortal(<div className="home-return-overlay" role="status" aria-live="polite"><span className="sr-only">Ana sayfaya dönülüyor.</span><span className="home-return-scene" aria-hidden="true"><span className="home-return-aura"/><span className="home-return-sweep"/><span className="home-return-flight"><FolloopyEyes size={124}/></span><span className="home-return-shadow"/><span className="home-return-progress"/></span></div>,document.body):null}</>;
}
