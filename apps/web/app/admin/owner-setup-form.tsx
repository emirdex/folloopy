'use client';
import {useActionState,useEffect,useRef,useState} from 'react';
import {ArrowUpRight,Eye,EyeOff,LoaderCircle,AlertCircle} from 'lucide-react';
import Link from 'next/link';
import {setupOwner} from './actions';
import {PASSWORD_HELP} from '../../../../packages/domain/password-policy';
import {ownerSetupIssue,type OwnerSetupIssue} from '../../../../packages/domain/owner-setup';

export function OwnerSetupForm({email}:{email:string}){
 const[state,action,pending]=useActionState(setupOwner,null);
 const[token,setToken]=useState(''),[showToken,setShowToken]=useState(false);
 const[issue,setIssue]=useState<OwnerSetupIssue|null>(null),[waiting,setWaiting]=useState(false);
 const alert=useRef<HTMLParagraphElement>(null);
 const error=issue?.error||state?.error;
 useEffect(()=>{const value=new URLSearchParams(window.location.hash.slice(1)).get('key');if(value){setToken(value);window.history.replaceState(null,'',window.location.pathname)}},[]);
 useEffect(()=>{if(error){alert.current?.focus({preventScroll:true});alert.current?.scrollIntoView({block:'nearest',behavior:'smooth'})}},[error]);
 useEffect(()=>{setWaiting(false);if(!pending)return;const timer=setTimeout(()=>setWaiting(true),12000);return()=>clearTimeout(timer)},[pending]);
 const invalid=(field:OwnerSetupIssue['field'])=>issue?.field===field||undefined;
 return <form action={action} className="admin-form setup-form" noValidate aria-busy={pending} onSubmit={event=>{
  if(pending){event.preventDefault();return;}
  const next=ownerSetupIssue(new FormData(event.currentTarget));setIssue(next);
  if(next)event.preventDefault();
 }} onInput={()=>{if(issue)setIssue(null)}}>
  <label>Yönetici e-postası<input value={email} readOnly autoComplete="username"/></label>
  <label>Ad soyad<input name="name" autoComplete="name" required minLength={2} maxLength={80} aria-invalid={invalid('name')} aria-describedby={invalid('name')?'owner-setup-error':undefined}/></label>
  <label>Kurulum anahtarı<div className="setup-token-input"><input name="token" type={showToken?'text':'password'} value={token} onChange={event=>setToken(event.target.value)} required minLength={32} maxLength={128} autoComplete="off" spellCheck={false} aria-invalid={invalid('token')} aria-describedby={invalid('token')?'owner-setup-error':undefined}/><button type="button" aria-label={showToken?'Kurulum anahtarını gizle':'Kurulum anahtarını göster'} onClick={()=>setShowToken(!showToken)}>{showToken?<EyeOff size={18}/>:<Eye size={18}/>}</button></div><small>{token?'Kurulum anahtarı girildi. Etkinleştirmeden sonra geçersiz olur.':'Size özel kurulum bağlantısını açın veya tek kullanımlık anahtarınızı girin.'}</small></label>
  <label>Şifre<input name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} aria-invalid={invalid('password')} aria-describedby={invalid('password')?'owner-setup-error admin-password-help':'admin-password-help'}/><small id="admin-password-help">{PASSWORD_HELP}</small></label>
  <label>Şifreyi tekrar girin<input name="confirmation" type="password" autoComplete="new-password" required minLength={8} maxLength={128} aria-invalid={invalid('confirmation')} aria-describedby={invalid('confirmation')?'owner-setup-error':undefined}/></label>
  {error?<p id="owner-setup-error" ref={alert} className="admin-error setup-feedback" role="alert" tabIndex={-1}><AlertCircle size={18} aria-hidden="true"/>{error}</p>:null}
  <button type="submit" className="admin-primary" disabled={pending}>{pending?<><LoaderCircle className="setup-spinner" size={17} aria-hidden="true"/>Hesabınız oluşturuluyor…</>:<>Yönetici hesabını etkinleştir<ArrowUpRight size={17}/></>}</button>
  {waiting?<p className="setup-waiting" role="status">Sunucudan yanıt bekleniyor. Sayfayı kapatmadan kısa süre bekleyin.</p>:null}
  <Link href="/giris" className="admin-quiet">Hesabınız hazırsa giriş yapın</Link>
 </form>;
}
