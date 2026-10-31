'use client';
import {createContext,useCallback,useContext,useEffect,useRef,useState,type AnchorHTMLAttributes,type ReactNode} from 'react';
import {usePathname,useSearchParams} from 'next/navigation';
import {X,Mail,Eye,Clock3,RefreshCw,ArrowUpRight,FileText,Users,ShieldCheck} from 'lucide-react';
import type {MessageInspection} from '../../../../packages/domain/message-inspection';
import {fileEventLabels} from '../../../../packages/domain/file-sharing';
import './message-drawer.css';
type Selection={id:string;trigger:HTMLElement};
const DrawerContext=createContext<((selection:Selection)=>void)|null>(null);
const uuid=/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const date=(value:string|null|undefined)=>value?new Intl.DateTimeFormat('tr-TR',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Istanbul'}).format(new Date(value)):'—';
const states:Record<string,string>={sent:'Gönderildi',failed:'Gönderilemedi',sending:'Gönderim kontrol ediliyor',unknown:'Gönderim sonucu belirsiz',prepared:'Hazırlanıyor'};
export function MessageInspectLink({id,children,...props}:Omit<AnchorHTMLAttributes<HTMLAnchorElement>,'href'> & {id:string;children:ReactNode}){
 const open=useContext(DrawerContext);
 return <a {...props} href={'/panel?id='+encodeURIComponent(id)} aria-haspopup={open?'dialog':undefined} onClick={event=>{
  props.onClick?.(event);
  if(!open||!uuid.test(id)||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||props.target&&props.target!=='_self')return;
  event.preventDefault();open({id,trigger:event.currentTarget});
 }}>{children}</a>;
}
export function MessageDrawerProvider({children}:{children:ReactNode}){
 const [selected,setSelected]=useState<Selection|null>(null),[data,setData]=useState<MessageInspection|null>(null),[error,setError]=useState(''),[revision,setRevision]=useState(0),[loading,setLoading]=useState(false);
 const dialog=useRef<HTMLDialogElement>(null),closeButton=useRef<HTMLButtonElement>(null),trigger=useRef<HTMLElement|null>(null),outside=useRef(false);
 const pathname=usePathname(),query=useSearchParams().toString(),opened=!!selected;
 const close=useCallback(()=>{setSelected(null);setData(null);setError('')},[]);
 const open=useCallback((selection:Selection)=>{trigger.current=selection.trigger;setData(null);setError('');setSelected(selection)},[]);
 useEffect(()=>{close()},[pathname,query,close]);
 useEffect(()=>{
  const node=dialog.current;if(!opened||!node)return;
  if(typeof node.showModal!=='function'){if(selected)window.location.assign('/panel?id='+selected.id);return}
  const scrollers=[document.documentElement,document.body,...document.querySelectorAll<HTMLElement>('.workspace-body')];
  const positions=scrollers.map(element=>({element,overflow:element.style.overflow,top:element.scrollTop,left:element.scrollLeft}));
  try{if(!node.open)node.showModal()}catch{if(selected)window.location.assign('/panel?id='+selected.id);return}
  for(const {element} of positions)element.style.overflow='hidden';
  closeButton.current?.focus({preventScroll:true});
  return()=>{if(node.open)node.close();for(const {element,overflow,top,left} of positions){element.style.overflow=overflow;element.scrollTop=top;element.scrollLeft=left}if(trigger.current?.isConnected)trigger.current.focus({preventScroll:true});outside.current=false};
  // Selection changes reuse the same native modal and preserve the underlying list.
 },[opened]);
 useEffect(()=>{
  if(!selected)return;const abort=new AbortController();let active=true,timedOut=false;setLoading(true);setError('');setData(null);
  const timeout=window.setTimeout(()=>{timedOut=true;abort.abort()},12000);
  fetch('/panel/mail-inspection/'+selected.id,{signal:abort.signal,cache:'no-store',credentials:'same-origin'}).then(async response=>{
   if(!response.ok)throw Error(response.status===401||response.status===403?'Oturumunuzu ve paket erişiminizi kontrol edin.':response.status===404?'Mail kaydı bulunamadı veya takip süresi dolmuş.':'Mail ayrıntıları yüklenemedi.');
   const result=await response.json() as MessageInspection;if(result.message?.id!==selected.id)throw Error('Mail ayrıntıları doğrulanamadı.');if(active)setData(result);
  }).catch(reason=>{if(active&&(!abort.signal.aborted||timedOut))setError(timedOut?'Yanıt gecikti. Yeniden deneyebilirsiniz.':reason instanceof Error?reason.message:'Mail ayrıntıları yüklenemedi.');}).finally(()=>{window.clearTimeout(timeout);if(active)setLoading(false)});
  return()=>{active=false;window.clearTimeout(timeout);abort.abort()};
 },[selected?.id,revision]);
 const isOutside=(event:{clientX:number;clientY:number})=>{const rect=dialog.current?.getBoundingClientRect();return !!rect&&(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)};
 return <DrawerContext.Provider value={open}>{children}<dialog ref={dialog} className="message-drawer" aria-labelledby="message-drawer-title" onCancel={event=>{event.preventDefault();close()}} onClose={()=>{if(!dialog.current?.open)close()}} onKeyDown={event=>event.stopPropagation()} onPointerDown={event=>{outside.current=event.target===event.currentTarget&&isOutside(event)}} onPointerUp={event=>{if(outside.current&&event.target===event.currentTarget&&isOutside(event))close();outside.current=false}}>
 <header className="message-drawer-header"><span className="message-drawer-symbol"><Mail size={21}/></span><div><span>MAİL AYRINTISI</span><h2 id="message-drawer-title">{data?.message.subject||'Mail hareketleri'}</h2></div><button ref={closeButton} type="button" className="message-drawer-close" aria-label="Mail ayrıntısını kapat" onClick={close}><X size={21}/></button></header>
 <div className="message-drawer-body" aria-busy={loading}>{loading?<div className="message-drawer-loading" role="status"><Clock3 size={23}/><p>Mail ayrıntıları yükleniyor…</p></div>:error?<div className="message-drawer-error" role="alert"><p>{error}</p><button type="button" onClick={()=>setRevision(v=>v+1)}>Yeniden dene<RefreshCw size={15}/></button></div>:data&&selected?.id===data.message.id?<Inspection data={data}/>:null}</div>
 <footer className="message-drawer-footer"><span><ShieldCheck size={14}/>Türkiye saati · Mail bazında takip</span><button type="button" disabled={loading||!selected} onClick={()=>setRevision(v=>v+1)}><RefreshCw size={14}/>Yenile</button>{selected?<a href={'/panel?id='+selected.id} onClick={close}>Tam sayfada aç<ArrowUpRight size={14}/></a>:null}</footer>
 </dialog></DrawerContext.Provider>;
}
function Inspection({data}:{data:MessageInspection}){
 const {message:m,recipients:r}=data,multiple=m.recipient_count>1,opened=m.activity_count>0;
 return <><section className="message-drawer-summary"><span className={'message-drawer-status '+(m.state==='sent'?'is-sent':'')}>{states[m.state]||'Durum kontrol ediliyor'}</span><dl><div><dt>Gönderim zamanı</dt><dd>{date(m.sent_at)}</dd></div><div><dt>Takip</dt><dd>{m.tracking_enabled?'Açık':'Kapalı'}</dd></div></dl></section>
 <section className="message-drawer-section"><h3><Users size={17}/>Alıcılar</h3>{(['to','cc','bcc'] as const).map(key=>r[key].length||r.complete?<div className="message-drawer-recipient-group" key={key}><span>{({to:'Kime',cc:'CC',bcc:'BCC'})[key]}</span><div>{r[key].length?r[key].map(email=><span className="message-drawer-recipient" key={email}>{email}</span>):<small>Yok</small>}</div></div>:null)}{!r.complete?<p className="message-drawer-note">{r.source==='unavailable'?'Bu eski kaydın alıcı adresleri saklanmamış.':'Bu eski kayıtta Kime / CC / BCC ayrımının tamamı saklanmamış.'}</p>:null}</section>
 <section className="message-drawer-section"><h3><Eye size={17}/>{opened?'Bu mailde açılma algılandı':'Henüz açılma algılanmadı'}</h3><div className="message-drawer-opening-times"><div><span>İlk açılma sinyali</span><strong>{date(m.first_activity_at)}</strong></div><div><span>Son açılma sinyali</span><strong>{date(m.last_activity_at)}</strong></div></div><p className="message-drawer-note">{multiple?'Kime, CC ve BCC alıcıları aynı takip görselini alır. Bu sinyalin hangi kişiden geldiği ayırt edilemez.':'Açılma sinyali, takip görselinin yüklenmesini gösterir; kesin okuma veya kişi doğrulaması değildir.'}</p></section>
 <section className="message-drawer-section"><h3><Clock3 size={17}/>Kısa etkinlik çizelgesi</h3><ol className="message-drawer-timeline">{data.openings.map((opening,index)=><li key={opening.first_at+'-'+index}><span className="is-opening"><Eye size={14}/></span><div><strong>Açılma sinyali</strong><time dateTime={opening.first_at}>{date(opening.first_at)}</time></div></li>)}{m.sent_at?<li><span><Mail size={14}/></span><div><strong>Mail gönderildi</strong><time dateTime={m.sent_at}>{date(m.sent_at)}</time></div></li>:null}</ol>{!m.sent_at&&!data.openings.length?<p className="message-drawer-note">Henüz doğrulanmış bir gönderim veya açılma hareketi yok.</p>:null}{data.openings.length>=10?<p className="message-drawer-note">En son 10 açılma grubu gösteriliyor.</p>:null}</section>
 <section className="message-drawer-section"><h3><FileText size={17}/>Takipli dosya hareketleri</h3>{data.fileEvents.length?<><p className="message-drawer-note">Paylaşım bağlantısının hareketleridir. Bağlantı başka maillerde de kullanılmış veya iletilmiş olabilir; bu mailin belirli alıcısına bağlanamaz.</p><ol className="message-drawer-file-events">{data.fileEvents.map(event=><li key={event.id}><strong>{event.name}</strong><span>{fileEventLabels[event.kind]||'Dosya hareketi'}{event.page?' · Sayfa '+event.page:''}{event.seconds?' · '+event.seconds+' sn':''}</span><small>{event.source==='suspected_automated'?'Şüpheli otomatik erişim':'Kimliği doğrulanmamış tarayıcı'} · {date(event.created_at)}</small></li>)}</ol></>:<p className="message-drawer-note">Bu maille ilişkilendirilmiş, paketiniz kapsamında görüntülenebilen bir dosya hareketi yok.</p>}</section></>;
}
