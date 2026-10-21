'use client';
import {useEffect,useRef} from 'react';
import {ChevronDown,LogOut,Package,UserRound,Wallet} from 'lucide-react';
import Link from '../destination-link';
import {logoutAccount} from '../account-actions';
import {endPurchasePreview} from '../preview-actions';
export function AccountMenu({name,email,preview}:{name?:string;email?:string;preview:boolean}){
 const menu=useRef<HTMLDetailsElement>(null);
 const initials=name?.trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('')||'F';
 useEffect(()=>{
  function outside(event:PointerEvent){if(event.target instanceof Node&&!menu.current?.contains(event.target)&&menu.current)menu.current.open=false}
  function escape(event:KeyboardEvent){if(event.key==='Escape'&&menu.current?.open){menu.current.open=false;menu.current.querySelector('summary')?.focus()}}
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape)};
 },[]);
 return <details ref={menu} className="workspace-account-menu"><summary><span className="workspace-account-avatar" aria-hidden="true">{initials}</span><span>Hesabım</span><ChevronDown size={13} aria-hidden="true"/></summary><div className="workspace-account-dropdown"><div className="workspace-account-identity"><strong>{name||'Önizleme'}</strong><span>{email||'Yerel çalışma alanı'}</span></div><nav aria-label="Hesap işlemleri" onClick={event=>{if(event.target instanceof Element&&event.target.closest('a')&&menu.current)menu.current.open=false}}><Link href="/panel?view=account"><UserRound size={16} aria-hidden="true"/>Hesap ayarları</Link><Link href="/panel?view=account#billing"><Wallet size={16} aria-hidden="true"/>Fatura bilgileri</Link><Link href="/paketler"><Package size={16} aria-hidden="true"/>Paketleri incele</Link></nav><form action={preview?endPurchasePreview:logoutAccount}><button type="submit"><LogOut size={16} aria-hidden="true"/>Çıkış yap</button></form></div></details>;
}
