'use client';
import {useActionState,useEffect,useRef,useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {Icon} from './icons';
type Action=(previous:{error:string}|null,data:FormData)=>Promise<{error:string}|null>;
export function Refresh(){const router=useRouter();const[pending,start]=useTransition();return <button type="button" className={`icon-button ${pending?'refreshing':''}`} aria-label="Kayıtları yenile" disabled={pending} title="Kayıtları yenile" onClick={()=>start(()=>router.refresh())}><Icon name="refresh" size={17}/></button>}
export function Counter({value}:{value:number}){const[display,setDisplay]=useState(value);useEffect(()=>{if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;let id=0;let start:number|undefined;const run=(time:number)=>{start??=time;const fraction=Math.min((time-start)/650,1);setDisplay(Math.round(value*(1-Math.pow(1-fraction,3))));if(fraction<1)id=requestAnimationFrame(run)};id=requestAnimationFrame(run);return()=>cancelAnimationFrame(id)},[value]);return <span aria-label={String(value)}>{display}</span>}
export function Search(){
 const dialog=useRef<HTMLDialogElement>(null),backdropPress=useRef(false);
 const close=()=>{backdropPress.current=false;dialog.current?.close()};
 useEffect(()=>{
  const element=dialog.current;
  const handle=(event:KeyboardEvent)=>{
   if(event.key==='Escape'&&dialog.current?.open){event.preventDefault();dialog.current.close();backdropPress.current=false;return}
   if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();if(!dialog.current?.open)dialog.current?.showModal()}
  };
  window.addEventListener('keydown',handle);
  return()=>{window.removeEventListener('keydown',handle);element?.close()};
 },[]);
 return <><button className="global-search" onClick={()=>dialog.current?.showModal()} aria-label="Maillerde ara"><Icon name="search" size={16}/><span>Maillerde ara</span><kbd>⌘ K</kbd></button><dialog ref={dialog} className="search-dialog" aria-labelledby="search-title" onCancel={event=>{event.preventDefault();close()}} onPointerDown={event=>{const rect=event.currentTarget.getBoundingClientRect();backdropPress.current=event.target===event.currentTarget&&(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)}} onClick={event=>{const rect=event.currentTarget.getBoundingClientRect(),outside=event.target===event.currentTarget&&(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom);if(backdropPress.current&&outside)close();backdropPress.current=false}}><div className="dialog-heading"><h2 id="search-title">Maillerde Ara</h2><button type="button" className="icon-button" aria-label="Aramayı kapat" onClick={close}><Icon name="close"/></button></div><form action="/panel" method="get"><input type="hidden" name="view" value="messages"/><Icon name="search" size={21}/><input name="q" aria-label="Mail konusu" placeholder="Konuya göre arayın…" autoFocus maxLength={200}/><button className="button button-dark">Ara<Icon name="arrow" size={16}/></button></form><p>Son 50 mail kaydı içinde arama yapar.</p></dialog></>}
export function StopButton({action,id}:{action:Action;id:string}){const[state,formAction,pending]=useActionState(action,null);return <form action={formAction} className="stop-form"><input type="hidden" name="id" value={id}/><button className="button button-outline" disabled={pending}><Icon name="pause" size={15}/>{pending?'Durduruluyor…':'Takibi durdur'}</button>{state?.error?<p role="alert">{state.error}</p>:null}</form>}
export {MailForm} from './panel/mail-composer';
