'use client';
import {useActionState,useEffect,useId,useRef,useState} from 'react';
import {X,UserRoundMinus,LoaderCircle} from 'lucide-react';
import {deleteMember} from './actions';

export function DeleteMemberButton({id,name,email}:{id:string;name:string;email:string}){
 const [open,setOpen]=useState(false);
 return <><button type="button" className="admin-member-delete-trigger" aria-label={name+' üyeliğini sil'} title="Üyeyi sil" onClick={()=>setOpen(true)}><X size={17}/></button>{open?<DeleteMemberDialog id={id} name={name} email={email} onClose={()=>setOpen(false)}/>:null}</>;
}
function DeleteMemberDialog({id,name,email,onClose}:{id:string;name:string;email:string;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),titleId=useId(),descriptionId=useId();
 const [state,action,pending]=useActionState(deleteMember,null);
 useEffect(()=>{const element=dialog.current,previous=document.activeElement as HTMLElement|null;const overflow=document.body.style.overflow;element?.showModal();document.body.style.overflow='hidden';return()=>{element?.close();document.body.style.overflow=overflow;if(previous?.isConnected)previous.focus()}},[]);
 useEffect(()=>{if(state?.ok)onClose()},[state,onClose]);
 return <dialog ref={dialog} className="admin-member-delete-dialog" aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={event=>{event.preventDefault();if(!pending)onClose()}} onClick={event=>{if(event.target===event.currentTarget&&!pending)onClose()}}>
  <div className="admin-member-delete-content"><span className="admin-member-delete-icon"><UserRoundMinus size={25}/></span><h2 id={titleId}>Üyeyi silmek istediğinize<br/>emin misiniz?</h2><div className="admin-member-delete-identity"><strong>{name}</strong><span>{email}</span></div><p id={descriptionId}>Üyenin hesabı, oturumları, bağlantıları, gönderim ve taslak kayıtları kalıcı olarak silinir. Varsa işlem geçmişi anonim olarak korunur.</p><span className="admin-member-delete-warning">Bu işlem geri alınamaz.</span>{state?.error?<p className="admin-member-delete-error" role="alert">{state.error}</p>:null}<form action={action}><input type="hidden" name="id" value={id}/><input type="hidden" name="email" value={email}/><input type="hidden" name="confirm" value="yes"/><button type="button" className="admin-member-delete-cancel" disabled={pending} onClick={onClose} autoFocus>Vazgeç</button><button type="submit" className="admin-member-delete-confirm" disabled={pending}>{pending?<LoaderCircle size={16} className="admin-member-delete-spinner"/>:<X size={16}/>} {pending?'Siliniyor…':'Evet, üyeyi sil'}</button></form></div>
 </dialog>;
}
