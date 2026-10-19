'use client';
import {useActionState,useEffect,useState} from 'react';
import {ArrowUpRight,Eye,EyeOff} from 'lucide-react';
import Link from 'next/link';
import {setupOwner} from './actions';
import {PASSWORD_PATTERN,PASSWORD_HELP} from '../../../../packages/domain/password-policy';
export function OwnerSetupForm({email}:{email:string}){
 const[state,action,pending]=useActionState(setupOwner,null),[token,setToken]=useState(''),[showToken,setShowToken]=useState(false);
 useEffect(()=>{const value=new URLSearchParams(window.location.hash.slice(1)).get('key');if(value){setToken(value);window.history.replaceState(null,'',window.location.pathname)}},[]);
 return <form action={action} className="admin-form setup-form"><label>Yönetici e-postası<input value={email} readOnly autoComplete="username"/></label><label>Ad soyad<input name="name" autoComplete="name" required minLength={2} maxLength={80}/></label><label>Kurulum anahtarı<div className="setup-token-input"><input name="token" type={showToken?"text":"password"} value={token} onChange={e=>setToken(e.target.value)} required minLength={32} maxLength={128} autoComplete="off" spellCheck={false}/><button type="button" aria-label={showToken?"Kurulum anahtarını gizle":"Kurulum anahtarını göster"} onClick={()=>setShowToken(!showToken)}>{showToken?<EyeOff size={18}/>:<Eye size={18}/>}</button></div><small>{token?"Kurulum anahtarı girildi. Etkinleştirmeden sonra geçersiz olur.":"Size özel kurulum bağlantısını açın veya tek kullanımlık anahtarınızı girin."}</small></label><label>Şifre<input name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} pattern={PASSWORD_PATTERN} title={PASSWORD_HELP} aria-describedby="admin-password-help"/><small id="admin-password-help">{PASSWORD_HELP}</small></label><label>Şifreyi tekrar girin<input name="confirmation" type="password" autoComplete="new-password" required minLength={8} maxLength={128}/></label>{state?.error?<p className="admin-error" role="alert">{state.error}</p>:null}<button className="admin-primary" disabled={pending}>{pending?'Kuruluyor…':'Yönetici hesabını etkinleştir'}<ArrowUpRight size={17}/></button><Link href="/giris" className="admin-quiet">Hesabınız hazırsa giriş yapın</Link></form>
}
export {BlogEditor,type EditablePost} from './blog-editor';
