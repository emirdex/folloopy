'use client';
import Link,{useLinkStatus} from 'next/link';
import {useEffect,useState} from 'react';
import {ArrowUpRight} from 'lucide-react';
import './new-mail-button.css';
function PendingStatus(){const{pending}=useLinkStatus();return pending?<span className="sr-only" role="status">Yeni mail açılıyor.</span>:null}
export function NewMailButton(){
 const[flight,setFlight]=useState(0);
 useEffect(()=>{if(!flight)return;const timer=setTimeout(()=>setFlight(0),650);return()=>clearTimeout(timer)},[flight]);
 return <Link href="/panel?view=compose" className={'button button-dark header-compose new-mail-button'+(flight?' is-launching':'')} onClick={event=>{if(event.button===0&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey)setFlight(value=>value+1)}}><span>Yeni mail</span><span key={flight} className="new-mail-arrow" aria-hidden="true"><ArrowUpRight size={15}/><i/></span><PendingStatus/></Link>;
}
