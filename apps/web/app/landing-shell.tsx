'use client';
import type {MouseEvent,ReactNode} from 'react';
import {useEffect,useRef,useState} from 'react';
import {FolloopyLogo} from './folloopy-brand';
import Link from './destination-link';
import {Icon} from './icons';
import {samePageSectionId} from './section-navigation';
function Brand(){return <FolloopyLogo/>}
export function LandingShell({hasPreview,hasAccount,marketing=false,children}:{hasPreview:boolean;hasAccount:boolean;marketing?:boolean;children:ReactNode}){
 const root=useRef<HTMLDivElement>(null);const[scrolled,setScrolled]=useState(false),[menuOpen,setMenuOpen]=useState(false);
 function prepareSection(target:HTMLElement){
  const main=root.current?.querySelector('main');
  if(!main||target===main)return;
  // Resolve deferred section heights before calculating the scroll destination.
  // Keep sections beyond the requested destination deferred as before.
  for(const section of main.children){
   if(section instanceof HTMLElement&&section.tagName==='SECTION')section.style.contentVisibility='visible';
   if(section.contains(target))break;
  }
 }
 // Honor incoming section links, then keep the one-page address clean.
 useEffect(()=>{
  const cleanSectionAddress=()=>{
   const id=samePageSectionId(window.location.href,window.location.href),target=id?document.getElementById(id):null;
   if(!target||!root.current?.contains(target))return;
   prepareSection(target);
   target.scrollIntoView({behavior:'instant',block:'start'});
   window.history.replaceState(window.history.state,'',window.location.pathname+window.location.search);
  };
  cleanSectionAddress();
  window.addEventListener('hashchange',cleanSectionAddress);
  return()=>window.removeEventListener('hashchange',cleanSectionAddress);
 },[]);
 function navigateSection(event:MouseEvent<HTMLDivElement>){
  if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  const link=event.target instanceof Element?event.target.closest<HTMLAnchorElement>('a[href]'):null;
  if(!link||link.hasAttribute('download')||(link.target&&link.target!=='_self'))return;
  const id=samePageSectionId(link.href,window.location.href),target=id?document.getElementById(id):null;
  if(!target||!root.current?.contains(target))return;
  event.preventDefault();
  setMenuOpen(false);
  prepareSection(target);
  // Use the existing CSS scroll behavior, including reduced-motion preferences.
  target.scrollIntoView({block:'start'});
  if(link.classList.contains('site-skip')){target.tabIndex=-1;target.focus({preventScroll:true})}
 }
 useEffect(()=>{const check=()=>setScrolled(window.scrollY>45);check();window.addEventListener('scroll',check,{passive:true});const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;let observer:IntersectionObserver|undefined;if(!reduce){root.current?.classList.add('motion-ready');observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('revealed');observer?.unobserve(e.target)}}),{threshold:.1});root.current?.querySelectorAll('[data-reveal]').forEach(el=>observer?.observe(el))}return()=>{window.removeEventListener('scroll',check);observer?.disconnect()}},[]);
 useEffect(()=>{if(!menuOpen)return;const dismiss=(event:KeyboardEvent)=>{if(event.key==='Escape'){setMenuOpen(false);root.current?.querySelector<HTMLButtonElement>('.site-menu-button')?.focus()}};const resize=()=>{if(window.innerWidth>820)setMenuOpen(false)};window.addEventListener('keydown',dismiss);window.addEventListener('resize',resize);return()=>{window.removeEventListener('keydown',dismiss);window.removeEventListener('resize',resize)}},[menuOpen]);
 const closeMenu=()=>setMenuOpen(false);
 return <div className="landing-page" ref={root} onClickCapture={navigateSection}><a href="#main" className="site-skip">İçeriğe geç</a><header className={`site-header ${scrolled?'is-scrolled':''}`}><a href="#main" aria-label="Folloopy ana sayfa" onClick={closeMenu}><Brand/></a><nav aria-label="Web sitesi gezinme" className={menuOpen?'site-nav open':'site-nav'}><a href="#urun" onClick={closeMenu}>Özellikler</a><a href="#nasil-calisir" onClick={closeMenu}>Nasıl Çalışır?</a><a href="#planlar" onClick={closeMenu}>Fiyatlandırma</a><Link href="/blog" onClick={closeMenu}>Blog</Link><a href="#sss" onClick={closeMenu}>Sıkça Sorulan Sorular</a><Link href="/iletisim" onClick={closeMenu}>İletişim</Link></nav><div className="site-header-actions">{hasPreview?<Link href="/panel" className="site-login">Panele dön<Icon name="external" size={14}/></Link>:<Link href={marketing?"/iletisim":hasAccount?"/paketler":"/giris"} className="site-login">{marketing?"İletişim":hasAccount?"Paket seç":"Giriş yap"}</Link>}<Link href={marketing?"/iletisim":hasAccount?"/paketler":"/kayit"} className="site-button site-button-dark nav-cta">{marketing?"Bize ulaşın":hasAccount?"Paketler":"Hesap oluştur"}<Icon name="external" size={14}/></Link><button className="site-menu-button" aria-expanded={menuOpen} aria-controls="mobile-navigation" aria-label={menuOpen?'Menüyü kapat':'Menüyü aç'} onClick={()=>setMenuOpen(!menuOpen)}><Icon name={menuOpen?'close':'sliders'} size={20}/></button></div></header>{menuOpen?<nav id="mobile-navigation" className="mobile-site-nav" aria-label="Mobil gezinme">{[{href:'#urun',label:'Özellikler'},{href:'#nasil-calisir',label:'Nasıl Çalışır?'},{href:'#planlar',label:'Fiyatlandırma'},{href:'/blog',label:'Blog'},{href:'#sss',label:'Sıkça Sorulan Sorular'},{href:'/iletisim',label:'İletişim'},...(!marketing?[{href:hasAccount?'/paketler':'/giris',label:hasAccount?'Paketler':'Giriş yap'}]:[])].map(l=><a href={l.href} onClick={closeMenu} key={l.href}>{l.label}<Icon name="arrow" size={16}/></a>)}</nav>:null}
{children}</div>;
}
