'use client';
import {useEffect,useRef,type ReactNode} from 'react';
import {useSearchParams,useRouter} from 'next/navigation';
import type {Account} from '../account-api';
import Link from '../destination-link';
import {MobileNavigation} from '../mobile-navigation';
import {FolloopyLogo,FolloopyMark} from '../folloopy-brand';
import {Icon} from '../icons';
import {Search} from '../controls';
import {ServiceConnection} from './service-connection';
import {NewMailButton} from './new-mail-button';
const nav=[{id:'overview',label:'Genel Bakış',icon:'overview'},{id:'compose',label:'Yeni Mail',icon:'plus'},{id:'messages',label:'Takip Edilen Mailler',icon:'mail'},{id:'drafts',label:'Taslaklar',icon:'drafts'},{id:'bulk',label:'Toplu Gönderim',icon:'send'},{id:'files',label:'Dosya Paylaşımları',icon:'drafts'},{id:'activity',label:'Etkinlik Akışı',icon:'pulse'},{id:'setup',label:'Bağlı Hesaplar',icon:'link'},{id:'extensions',label:'Eklentiler',icon:'sparkles'},{id:'tools',label:'Bildirimler ve Araçlar',icon:'pulse'},{id:'guide',label:'Kullanım Kılavuzu',icon:'book'},{id:'account',label:'Hesap Detayları',icon:'user'}] as const;
export function WorkspaceShell({children,user}:{children:ReactNode;user:Account|null}){
 const params=useSearchParams(),query=params.toString(),router=useRouter(),bodyRef=useRef<HTMLDivElement>(null);
 const view=params.get('view')||'',active=view==='draft-editor'?'drafts':nav.some(item=>item.id===view)?view:params.has('id')||params.has('q')||params.has('mode')||params.has('filter')?'messages':'overview';
 useEffect(()=>{if(bodyRef.current)bodyRef.current.scrollTop=0},[query]);
 return <div className="product-shell"><header className="product-header"><Link className="brand" href="/panel"><FolloopyLogo/></Link><span className="header-separator"/><span className="workspace-name">E-posta takibi</span><div className="header-actions"><Search/><ServiceConnection/><NewMailButton/></div></header><div className="app-layout"><aside className="sidebar"><div className="sidebar-label">ÇALIŞMA ALANI</div><MobileNavigation active={active} label="Ana gezinme">{nav.map(item=><Link key={item.id} href={item.id==='overview'?'/panel':`/panel?view=${item.id}`} className={`nav-item ${active===item.id?'active':''}`} aria-current={active===item.id?'page':undefined} title={item.label} onMouseEnter={()=>router.prefetch(item.id==='overview'?'/panel':`/panel?view=${item.id}`)} onFocus={()=>router.prefetch(item.id==='overview'?'/panel':`/panel?view=${item.id}`)}><Icon name={item.icon} size={19}/><span>{item.label}</span>{active===item.id?<span className="nav-current-dot"/>:null}</Link>)}</MobileNavigation><div className="sidebar-bottom"><div className="workspace-badge"><span><FolloopyMark size={28}/></span><div><strong title={user?.name}>{user?.name||'Hesabım'}</strong><small title={user?.email}>{user?.email||'Çalışma alanınız'}</small></div></div></div></aside><main className="workspace-content"><div className="workspace-body" ref={bodyRef}>{children}</div><footer className="workspace-footer"><span><Icon name="shield" size={13}/>E-posta etkileşimleriniz, tek çalışma alanında.</span><span>Folloopy / 0.1</span></footer></main></div></div>
}
