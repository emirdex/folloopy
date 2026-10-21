'use client';
import {useEffect,useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {Pause,Play,X,Download} from 'lucide-react';
import {controlBulk,downloadBulkReport} from './bulk-actions';
import {downloadCsv} from './bulk-composer';
export function BulkControls({id,status,canSend,pendingCount}:{id:string;status:string;canSend:boolean;pendingCount:number}){
 const[busy,start]=useTransition(),[error,setError]=useState(''),[cancel,setCancel]=useState(false);
 function act(action:'pause'|'resume'|'cancel'){setError('');start(async()=>{const result=await controlBulk(id,action);if('error' in result)setError(result.error);else setCancel(false)})}
 return <div className="bulk-controls"><div className="bulk-control-buttons">{['queued','running'].includes(status)?<button type="button" disabled={busy} onClick={()=>act('pause')}><Pause size={14}/>Duraklat</button>:status==='paused'&&canSend?<button type="button" disabled={busy} onClick={()=>act('resume')}><Play size={14}/>Sıradakilere devam et</button>:null}{['queued','running','paused'].includes(status)?<button type="button" disabled={busy} onClick={()=>setCancel(true)}><X size={14}/>Bekleyenleri iptal et</button>:null}<button type="button" disabled={busy} onClick={()=>start(async()=>{const result=await downloadBulkReport(id);if(result.error)setError(result.error);else if(result.csv)downloadCsv(result.csv,'folloopy-gonderim-sonuclari.csv')})}><Download size={14}/>Sonuçları indir</button></div>{cancel?<div className="bulk-cancel"><p>{pendingCount} bekleyen alıcı iptal edilecek ve ayrılan hakkı geri bırakılacak. Devam eden bir gönderim varsa tamamlanabilir.</p><button type="button" disabled={busy} onClick={()=>act('cancel')}>İptali Onayla</button><button type="button" disabled={busy} onClick={()=>setCancel(false)}>Vazgeç</button></div>:null}{error?<p className="bulk-alert is-error" role="alert">{error}</p>:null}</div>;
}
export function BulkProgressRefresh({active}:{active:boolean}){const router=useRouter(),[pending,start]=useTransition();useEffect(()=>{if(!active||pending)return;const timer=setInterval(()=>{if(!document.hidden)start(()=>router.refresh())},5000);return()=>clearInterval(timer)},[active,pending,router]);return null}
