'use client';
import {useActionState,useState} from 'react';
import {Trash2,X} from 'lucide-react';
import {deleteMailDraft} from './draft-actions';
export function DraftDelete({id,version,title}:{id:string;version:number;title:string}){
 const[confirm,setConfirm]=useState(false),[state,action,pending]=useActionState(deleteMailDraft,null);
 return <div className="draft-delete">{confirm?<form action={action}><input type="hidden" name="id" value={id}/><input type="hidden" name="version" value={version}/><span>Bu taslak silinsin mi?</span><button className="draft-delete-confirm" disabled={pending}>{pending?'Siliniyor…':'Sil'}</button><button type="button" disabled={pending} onClick={()=>setConfirm(false)} aria-label="Silmekten vazgeç"><X size={14}/></button></form>:<button type="button" onClick={()=>setConfirm(true)} aria-label={`${title} taslağını sil`}><Trash2 size={14}/>Sil</button>}{state?.error?<p role="alert">{state.error}</p>:null}</div>;
}
