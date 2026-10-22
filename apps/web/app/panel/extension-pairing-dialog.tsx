'use client';

import {useEffect,useRef,type ReactNode} from 'react';
import {useFormStatus} from 'react-dom';
import {useRouter} from 'next/navigation';
import {ArrowRight,Check,CheckCheck,Mail,Monitor,ShieldCheck,X} from 'lucide-react';
import './extension-pairing-dialog.css';

export function ExtensionPairingDialog({state,sender,children}:{state:'request'|'success'|'error';sender?:string|null;children?:ReactNode}){
 const dialog=useRef<HTMLDialogElement>(null);
 const router=useRouter();
 const close=()=>{dialog.current?.close();router.replace('/panel?view=extensions',{scroll:false})};
 useEffect(()=>{const node=dialog.current;if(node&&!node.open)node.showModal();return()=>{if(node?.open)node.close()}},[state]);
 const success=state==='success',error=state==='error';
 return <dialog ref={dialog} className={'extension-approval-dialog is-'+state} aria-labelledby="extension-approval-title" aria-describedby="extension-approval-copy" onCancel={event=>{event.preventDefault();close()}}>
  <button type="button" className="extension-approval-close" aria-label="Bağlantı penceresini kapat" onClick={close}><X size={19}/></button>
  <div className="extension-approval-top"><span className="extension-approval-emblem">{success?<CheckCheck size={29}/>:<Monitor size={29}/>}</span><span className="extension-approval-kicker">{success?'BAĞLANTI ONAYLANDI':error?'BAĞLANTI TAMAMLANAMADI':'SON ADIM · HESAP BAĞLANTISI'}</span></div>
  <h2 id="extension-approval-title">{success?'Chrome eklentiniz için her şey hazır.':error?'Bağlantıyı yeniden başlatalım.':'Chrome eklentinizi hesabınıza bağlayın.'}</h2>
  <p id="extension-approval-copy">{success?'Şimdi Chrome araç çubuğundaki Folloopy simgesini açın. Bağlantıyı kontrol ederek Gmail’den takipli gönderime başlayın.':error?'İstek sona ermiş veya bağlantı koşulları değişmiş olabilir. Gmail bağlantınızı ve Signature üyeliğinizi kontrol edin; ardından eklentide “Hesabımı bağla” ile yeniden başlayın.':'Bu tarayıcıdaki Folloopy eklentisinin, bağlı Gmail hesabınızla takipli mail göndermesine izin verin.'}</p>
  {sender&&<div className="extension-approval-account"><span><Mail size={20}/></span><div><small>BAĞLANACAK GMAIL HESABI</small><strong>{sender}</strong></div><ShieldCheck size={19}/></div>}
  {state==='request'&&<div className="extension-approval-assurance"><ShieldCheck size={17}/><p>Yalnızca sizin başlattığınız isteği onaylayın. Bu bağlantı, önceki tarayıcı eşleştirmenizin yerini alır.</p></div>}
  {success?<><div className="extension-approval-next"><span>1</span>Chrome’da Folloopy’yi açın<span>2</span>“Panelde onayladım · Kontrol et”e basın</div><button className="extension-approval-primary" type="button" onClick={close}>Tamam, eklentiye dönüyorum<ArrowRight size={18}/></button></>:error?<button className="extension-approval-primary" type="button" onClick={close}>Eklentiler sayfasına dön<ArrowRight size={18}/></button>:children}
  {state==='request'&&<button className="extension-approval-cancel" type="button" onClick={close}>Şimdi değil</button>}
 </dialog>
}

export function ExtensionApprovalButton(){const{pending}=useFormStatus();return <button className="extension-approval-primary" type="submit" disabled={pending} aria-busy={pending}>{pending?<><span className="extension-approval-spinner" aria-hidden="true"/>Bağlantı onaylanıyor…</>:<>Bağlantıyı onayla<Check size={19}/></>}</button>}
