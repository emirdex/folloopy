'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowUpRight,Menu,X} from 'lucide-react';
import {HomeLogoLink} from '../home-logo-link';
import {FolloopyLogo} from '../folloopy-brand';
import Link from '../destination-link';
import './journal-header.css';
const navigation=[['/#urun','Özellikler'],['/#nasil-calisir','Nasıl Çalışır?'],['/#planlar','Fiyatlandırma'],['/blog','Blog'],['/#sss','Sıkça Sorulan Sorular']] as const;
export function JournalHeader({marketing}:{marketing:boolean}){
 const [open,setOpen]=useState(false),header=useRef<HTMLElement>(null),toggle=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  if(!open)return;
  const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){setOpen(false);toggle.current?.focus()}};
  const outside=(event:PointerEvent)=>{if(!header.current?.contains(event.target as Node))setOpen(false)};
  const resize=()=>{if(window.innerWidth>1100)setOpen(false)};
  document.addEventListener('keydown',key);document.addEventListener('pointerdown',outside);window.addEventListener('resize',resize);
  return ()=>{document.removeEventListener('keydown',key);document.removeEventListener('pointerdown',outside);window.removeEventListener('resize',resize)};
 },[open]);
 return <header ref={header} className={'journal-header journal-site-header'+(open?' is-menu-open':'')}><HomeLogoLink className="commerce-brand"><FolloopyLogo/></HomeLogoLink><nav id="journal-site-navigation" aria-label="Web sitesi gezinme" className={open?'is-open':''}>{navigation.map(([href,label])=><Link key={href} href={href} aria-current={href==='/blog'?'page':undefined} onClick={()=>setOpen(false)}>{label}</Link>)}</nav><div className="journal-header-actions"><Link href={marketing?'/iletisim':'/giris'} className="journal-login" onClick={()=>setOpen(false)}>{marketing?'Bize ulaşın':'Giriş yap'}<ArrowUpRight size={15} aria-hidden="true"/></Link><button ref={toggle} className="journal-menu-toggle" type="button" aria-label={open?'Menüyü kapat':'Menüyü aç'} aria-expanded={open} aria-controls="journal-site-navigation" onClick={()=>setOpen(value=>!value)}>{open?<X size={20}/>:<Menu size={20}/>}</button></div></header>;
}
