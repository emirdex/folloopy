'use client';
import {useEffect,useState} from 'react';
import {probeService,connectionLabels,type ConnectionState} from '../../../../packages/domain/service-connection';
import './service-connection.css';

export function ConnectionIndicator({state}:{state:ConnectionState}){return <span className={'service-state connection-indicator '+(state==='online'?'is-online':state==='checking'?'is-checking':'is-offline')} role="status" aria-live="polite"><i className="connection-indicator-dot" aria-hidden="true"/><span>{connectionLabels[state]}</span></span>}
export function ServiceConnection(){
 const[state,setState]=useState<ConnectionState>('checking');
 useEffect(()=>{
  let disposed=false,current:AbortController|null=null;
  const check=async(showChecking=false)=>{
   current?.abort();current=null;
   if(!navigator.onLine){setState('offline');return}
   const controller=new AbortController();current=controller;
   if(showChecking)setState('checking');
   const timeout=window.setTimeout(()=>controller.abort('timeout'),5000);
   try{const result=await probeService(controller.signal);if(!disposed&&current===controller)setState(navigator.onLine?result:'offline')}
   finally{window.clearTimeout(timeout)}
  };
  const offline=()=>{current?.abort();current=null;setState('offline')};
  const online=()=>{void check(true)};
  const visible=()=>{if(!document.hidden)void check()};
  void check(true);const timer=window.setInterval(()=>{if(!document.hidden)void check()},30000);
  window.addEventListener('offline',offline);window.addEventListener('online',online);document.addEventListener('visibilitychange',visible);
  return ()=>{disposed=true;current?.abort();window.clearInterval(timer);window.removeEventListener('offline',offline);window.removeEventListener('online',online);document.removeEventListener('visibilitychange',visible)};
 },[]);
 return <ConnectionIndicator state={state}/>;
}
