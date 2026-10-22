import {LiveClock} from '../live-clock';
import {ServiceConnection} from './service-connection';
import {AccountDetails} from './account-details';
import {GmailConnection} from './gmail-connection';
import {Drafts} from './drafts';
import {NewMailButton} from './new-mail-button';
import {DraftEditor} from './draft-editor';
import {BulkPage} from './bulk';
import type {MailDraft,MailDraftList} from '../../../../packages/domain/mail-drafts';
import {accountApi} from '../account-api';
import {ExtensionHub} from './extension-hub';
import {ActivityStream} from './activity-stream';
import {RecentMessages} from './recent-messages';
import {internalApiFetch,internalApiUrl,internalApiKey} from '../internal-api';
import {FolloopyLogo,FolloopyMark} from '../folloopy-brand';
import {randomUUID} from 'node:crypto';
import {cookies} from 'next/headers';
import {MemberGuide} from './guide';
import {currentAccount,requireAccount,requirePanel} from '../account-api';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {Icon} from '../icons';
import {Refresh,Search,MailForm,StopButton,Counter} from '../controls';
import Link from '../destination-link';
import type {ReactNode} from 'react';

export const dynamic='force-dynamic';
type Message={id:string;subject:string;state:string;provider:string;sent_at:string|null;created_at:string;tracking_enabled:boolean;raw_count:number;unknown_count:number;activity_count:number;first_activity_at:string|null;last_activity_at:string|null};
type Observation={id:string;occurred_at:string;kind:string;source:string|null;classifier_version:string|null};
type Detail={message:Pick<Message,'id'|'subject'|'state'|'provider'|'sent_at'|'tracking_enabled'|'activity_count'|'first_activity_at'|'last_activity_at'>;events:Observation[];openings:{first_at:string;last_at:string}[]};
type Params={q?:string;id?:string;filter?:string;view?:string;mode?:string;reason?:string;welcome?:string;draft?:string;campaign?:string;offset?:string;pair?:string};
const states:Record<string,string>={sent:'Gönderim onaylandı',sending:'Gönderim kontrol ediliyor',unknown:'Gönderim kontrol ediliyor',failed:'Gönderilemedi',prepared:'Hazırlanıyor'};
async function api(path:string,init?:RequestInit){
 await requirePanel();
 const session=(await cookies()).get('mt_session')?.value;
 const res=await internalApiFetch(`${internalApiUrl()}${path}`,{...init,headers:{Authorization:`Bearer ${internalApiKey()}`,...(session?{'x-user-session':session}:{}),...(init?.body?{'Content-Type':'application/json'}:{}),...init?.headers},cache:'no-store',signal:AbortSignal.timeout(25000)});
 if(!res.ok)throw new Error(res.status===429?'Çok sık gönderim denemesi yaptınız. Bir dakika bekleyip yeniden deneyin.':res.status===402?'Kullanım limitinize ulaştınız.':res.status===400?'Konu ve mesaj alanlarını kontrol edin.':'Servise ulaşılamadı. Yeniden deneyin.');
 return res.json();
}
async function submit(_previous:{error:string}|null,form:FormData):Promise<{error:string}|null>{
 'use server';
 await requirePanel();
 if(/\{\{|\}\}/.test(String(form.get('subject'))+String(form.get('text'))))return {error:'Göndermeden önce değişkenleri alıcınızın bilgileriyle doldurun veya taslağı Toplu Gönderim ekranında kullanın.'};
 let id:string;
 try{
  const result=await api(process.env.NODE_ENV==='production'?'/api/messages/send':'/api/test-submissions',{method:'POST',headers:{'idempotency-key':String(form.get('key'))},body:JSON.stringify({subject:String(form.get('subject')),to:process.env.NODE_ENV==='production'?String(form.get('to')||''):'recipient@example.invalid',text:String(form.get('text')),tracking:form.get('tracking')==='on'})});
  id=result.id;
 }catch(e){return {error:e instanceof Error?e.message:'Kayıt oluşturulamadı.'}}
 revalidatePath('/panel');redirect(`/panel?id=${encodeURIComponent(id)}`);
}
async function connectGmail(){'use server';await requirePanel();const result=await api('/api/gmail/start',{method:'POST'});redirect(result.url)}
async function disconnectGmail(){'use server';await requirePanel();await api('/api/gmail/disconnect',{method:'POST'});revalidatePath('/panel');}
async function stop(_previous:{error:string}|null,form:FormData):Promise<{error:string}|null>{
 'use server';
 await requirePanel();
 const id=String(form.get('id'));
 if(!/^[a-f0-9-]{36}$/.test(id))return {error:'Geçersiz kayıt.'};
 try{await api(`/api/messages/${id}/stop`,{method:'POST'})}catch{return {error:'Takip durdurulamadı. Yeniden deneyin.'}}
 revalidatePath('/panel');return null;
}
function date(value:string,long=false){return new Intl.DateTimeFormat('tr-TR',{...(long?{day:'numeric' as const,month:'long' as const}:{}),hour:'2-digit',minute:'2-digit',timeZone:'Europe/Istanbul'}).format(new Date(value))}
function url(values:Params){const p=new URLSearchParams();Object.entries(values).forEach(([k,v])=>{if(v)p.set(k,v)});return '/panel'+(p.size?'?'+p.toString():'')}
const nav=[{id:'overview',label:'Genel Bakış',icon:'overview'},{id:'messages',label:'Takip Edilen Mailler',icon:'mail'},{id:'drafts',label:'Taslaklar',icon:'drafts'},{id:'bulk',label:'Toplu Gönderim',icon:'send'},{id:'activity',label:'Etkinlik Akışı',icon:'pulse'},{id:'setup',label:'Bağlı Hesaplar',icon:'link'},{id:'extensions',label:'Eklentiler',icon:'sparkles'},{id:'guide',label:'Kullanım Kılavuzu',icon:'book'},{id:'account',label:'Hesap Detayları',icon:'user'}] as const;
async function Shell({active,children,online=true}:{active:string;children:ReactNode;online?:boolean}){
 const user=await currentAccount();
 return <div className="product-shell"><header className="product-header"><Link className="brand" href="/panel"><FolloopyLogo/></Link><span className="header-separator"/><span className="workspace-name">Çalışma alanınız</span><div className="header-actions"><Search/><span className="environment"><span className="status-dot"/>Çalışma alanı</span><NewMailButton/></div></header><div className="app-layout"><aside className="sidebar"><div className="sidebar-label">ÇALIŞMA ALANI</div><nav aria-label="Ana gezinme">{nav.map(item=><Link key={item.id} href={item.id==='overview'?'/panel':`/panel?view=${item.id}`} className={`nav-item ${active===item.id?'active':''}`} aria-current={active===item.id?'page':undefined} title={item.label}><Icon name={item.icon} size={19}/><span>{item.label}</span>{active===item.id?<span className="nav-current-dot"/>:null}</Link>)}</nav><div className="sidebar-bottom"><div className="workspace-badge"><span><FolloopyMark size={28}/></span><div><strong title={user?.name}>{user?.name||'Hesabım'}</strong><small title={user?.email}>{user?.email||'Çalışma alanınız'}</small></div></div><ServiceConnection/></div></aside><main className="workspace-content" key={active}><div className="workspace-body">{!online?<div className="alert error" role="alert"><Icon name="info" size={18}/>Servis bağlantısı kurulamadı. Kayıtlar şu anda yüklenemiyor.<Refresh/></div>:null}{children}</div><footer className="workspace-footer"><span><Icon name="shield" size={13}/>E-posta etkileşimleriniz, tek çalışma alanında.</span><span>Folloopy / 0.1</span></footer></main></div></div>
}
function PageHeading({title,description,crumb,action}:{title:string;description:string;crumb?:string;action?:ReactNode}){return <><div className="breadcrumb">Çalışma alanı<Icon name="chevron" size={12}/><span>{crumb||title}</span></div><div className="page-heading"><div><h1>{title}</h1><p>{description}</p></div>{action}</div></>}
function Chip({children,color='neutral'}:{children:ReactNode;color?:string}){return <span className={`chip chip-${color}`}><i/>{children}</span>}
function MessageTable({messages,compact=false}:{messages:Message[];compact?:boolean}){return <div className="table-scroll"><table className="message-table"><thead><tr><th>Mail konusu</th><th>Gönderim</th><th>Açılma</th>{!compact?<th>Takip</th>:null}<th><span className="sr-only">Ayrıntı</span></th></tr></thead><tbody>{messages.map((m,i)=><tr key={m.id}><td><div className="mail-cell"><span className={`small-icon tint-${i%3}`}><Icon name="mail" size={17}/></span><div><Link className="subject-link" href={`/panel?id=${m.id}`}>{m.subject}</Link><small>{date(m.created_at,true)}</small></div></div></td><td><Chip color={m.state==='sent'?'green':'amber'}>{m.state==='sent'?'Gönderildi':states[m.state]}</Chip></td><td><span className="open-status">{m.activity_count?'Açılma Algılandı':'Henüz Açılma Algılanmadı'}</span>{m.last_activity_at?<small>Son hareket: {date(m.last_activity_at,true)}</small>:null}</td>{!compact?<td><span className={`tracking-label ${m.tracking_enabled?'tracking-on':''}`}><i/>{m.tracking_enabled?'Takip açık':'Durduruldu'}</span></td>:null}<td><Link href={`/panel?id=${m.id}`} className="row-action" aria-label={`${m.subject} ayrıntısı`}><Icon name="chevron" size={17}/></Link></td></tr>)}</tbody></table>{!messages.length?<div className="empty-state"><span className="empty-icon"><Icon name="mail" size={25}/></span><h3>Gösterilecek Mail Yok</h3><p>Arama veya filtreyi değiştirebilir, yeni bir mail kaydı oluşturabilirsiniz.</p><Link className="text-link" href="/panel?view=compose">Mail oluştur<Icon name="arrow" size={15}/></Link></div>:null}</div>}
function Metrics({messages}:{messages:Message[]}){const items=[{label:'Gönderimler',value:messages.filter(m=>m.state==='sent').length,note:'Başarıyla gönderilen mailler',icon:'send',tint:'blue'},{label:'Takip Açık',value:messages.filter(m=>m.tracking_enabled).length,note:'Takibi devam eden mailler',icon:'pulse',tint:'mint'},{label:'Açılma Algılanan',value:messages.filter(m=>m.activity_count>0).length,note:'Açılma bilgisi gelen mailler',icon:'chart',tint:'peach'},{label:'Açılma Bekleyen',value:messages.filter(m=>m.state==='sent'&&!m.activity_count).length,note:'Henüz açılma bilgisi gelmeyen mailler',icon:'reply',tint:'lilac'}] as const;return <div className="metric-strip">{items.map(item=><section className={`metric metric-${item.tint}`} key={item.label}><div className="metric-top"><span>{item.label}</span><Icon name={item.icon} size={17}/></div><strong>{item.value===null?<span className="metric-inactive">Etkin değil</span>:<Counter value={item.value}/>}</strong><small>{item.note}</small></section>)}</div>}
function Chart({messages}:{messages:Message[]}){const now=new Date();const days=Array.from({length:7},(_,i)=>{const d=new Date(now.getTime()-(6-i)*86400000);return {key:new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul'}).format(d),label:new Intl.DateTimeFormat('tr-TR',{weekday:'short',timeZone:'Europe/Istanbul'}).format(d)}});const counts=days.map(day=>messages.filter(m=>m.state==='sent'&&m.sent_at&&new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul'}).format(new Date(m.sent_at))===day.key).length);const max=Math.max(4,...counts);return <section className="surface chart-surface"><div className="surface-heading"><div><h2>Gönderim Hareketi</h2><p>Son 7 gün kayıtları</p></div><span className="chart-legend"><i/>Gönderilen mail</span></div><div className="chart" role="img" aria-label={days.map((d,i)=>`${d.label}: ${counts[i]} gönderim`).join(', ')}><div className="chart-scale">{[max,Math.round(max/2),0].map((v,i)=><span key={i}>{v}</span>)}</div><div className="chart-plot"><div className="chart-grid"><i/><i/><i/></div><div className="chart-columns">{days.map((d,i)=><div className="chart-column" key={d.key}><div className="bar-slot"><span className={`chart-bar ${counts[i]?'has-data':''}`} style={{height:counts[i]?`${counts[i]/max*100}%`:'3px','--bar-index':i} as React.CSSProperties}><span>{counts[i]}</span></span></div><span>{d.label}</span></div>)}</div></div></div><div className="chart-footer"><Icon name="info" size={13}/>Grafik son 50 kaydın içindeki gönderimleri gösterir.</div></section>}
function ConnectionCard(){return <section className="connection-card"><span className="eyebrow"><Icon name="sparkles" size={13}/>E-POSTA HESABINIZ</span><h2>Gönderim Ve Takip,<br/>Kendi Hesabınızdan.</h2><p>Gmail bağlantınızı ve gönderim için verdiğiniz izinleri yönetin.</p><Link href="/panel?view=setup" className="button button-white">Bağlı Hesapları Aç<Icon name="external" size={15}/></Link></section>}

export default async function Page({searchParams}:{searchParams:Promise<Params>}){
 await requirePanel();
 const p=await searchParams;
 if(p.view==='bulk')return <Shell active="bulk"><PageHeading title="Toplu Gönderim" description="Alıcı listenize ayrı ayrı gönderin. Her mailin takibi sizde kalsın."/><BulkPage campaign={p.campaign} offset={p.offset} draft={p.draft}/></Shell>;
 if(p.view==='draft-editor'){
  let draft:MailDraft|undefined;
  try{if(p.draft){if(!/^[a-f0-9-]{36}$/.test(p.draft))throw Error('NOT_FOUND');draft=await accountApi('/api/drafts/'+p.draft)}}catch{return <Shell active="drafts"><PageHeading title="Taslak Açılamadı" description="Taslak silinmiş veya paketinizin sınırı dışında olabilir."/><Link className="button button-outline" href="/panel?view=drafts">Taslaklara dön</Link></Shell>}
  const user=await currentAccount();
  return <Shell active="drafts"><PageHeading title={draft?'Taslağı Düzenle':'Yeni Taslak'} description="Yeniden kullanabileceğiniz, kişiselleştirilmiş mail içerikleri hazırlayın."/><DraftEditor key={p.draft||'new'} draft={draft} bulkAllowed={user?.plan==='team'||user?.plan==='business'}/></Shell>;
 }
 if(p.view==='drafts')return <Shell active="drafts"><PageHeading title="Mail Taslakları" description="Kaydettiğiniz mail içeriklerini düzenleyin ve yeniden kullanın."/><Drafts/></Shell>;
 if(p.view==='account'){await requireAccount();return <Shell active="account"><PageHeading title="Hesap Detayları" description={p.mode==='plan-already-active'?'Bu paket hesabınızda zaten etkin. Yeniden ödeme veya etkinleştirme yapmanız gerekmiyor.':'Profilinizi, paket kullanımınızı ve ödeme geçmişinizi yönetin.'}/><AccountDetails/></Shell>}
 if(p.view==='extensions'){const user=await currentAccount();return <Shell active="extensions"><PageHeading title="Eklentiler" description="Gmail ve Outlook eklentilerinin durumunu inceleyin, kurulum ve hesap bağlantılarınızı yönetin."/><ExtensionHub plan={user?.plan||null} pair={p.pair} mode={p.mode}/></Shell>}
 if(p.view==='guide'){await requireAccount();return <Shell active="guide"><MemberGuide/></Shell>}
 let messages:Message[]=[],online=true;
 try{messages=(await api('/api/messages')).messages}catch{online=false}
 const view=p.id?'detail':p.view==='compose'?'compose':p.view==='setup'?'setup':p.view==='activity'?'activity':p.view==='messages'||p.q||p.mode||p.filter?'messages':'overview';
 const active=['compose','detail'].includes(view)?'messages':view;
 if(view==='compose'){
  let draft:MailDraft|undefined,quota:{used:number;limit:number}|undefined;
  if(p.draft){try{if(!/^[a-f0-9-]{36}$/.test(p.draft))throw Error('NOT_FOUND');draft=await accountApi('/api/drafts/'+p.draft)}catch{return <Shell active="drafts"><PageHeading title="Taslak Açılamadı" description="Taslak silinmiş veya mevcut paketinizin sınırı dışında olabilir."/><Link className="button button-outline" href="/panel?view=drafts">Taslaklara Dön</Link></Shell>}}
  try{const data=await accountApi('/api/drafts') as MailDraftList;quota={used:data.used,limit:data.limit}}catch{}
  return <Shell active={p.draft?'drafts':active} online={online}><PageHeading title={draft?'Mail Taslağı':'Yeni Mail'} description="Mailinizi gönderin veya daha sonra kullanmak için taslak olarak kaydedin." action={<Link className="button button-outline" href={p.draft?'/panel?view=drafts':'/panel?view=messages'}>Vazgeç</Link>}/><MailForm key={p.draft||'new'} action={submit} idempotencyKey={randomUUID()} draft={draft} quota={quota}/></Shell>;
 }
 if(view==='detail'){
  let detail:Detail|null=null;try{if(p.id&&/^[a-f0-9-]{36}$/.test(p.id))detail=await api(`/api/messages/${p.id}`)}catch{}
  if(!detail)return <Shell active={active} online={online}><PageHeading title="Kayda Ulaşılamadı" description="Mail kaydını veya servis bağlantısını kontrol edin."/><Link className="button button-dark" href="/panel?view=messages">Maillere dön<Icon name="arrow" size={15}/></Link></Shell>;
  const m=detail.message;
  return <Shell active={active} online={online}>
   <div className="breadcrumb"><Link href="/panel?view=messages">Takip Edilen Mailler</Link><Icon name="chevron" size={12}/><span>Mail Ayrıntısı</span></div>
   <div className="record-heading"><Link className="back-circle" href="/panel?view=messages" aria-label="Maillere dön"><Icon name="arrow" size={19}/></Link><div><h1>{m.subject}</h1><p>{m.sent_at?date(m.sent_at,true):'Gönderim onayı bekleniyor'}</p></div><Chip color={m.tracking_enabled?'tracking-on':'tracking-off'}>{m.tracking_enabled?'Takip Açık':'Takip Durduruldu'}</Chip></div>
   <div className="record-layout"><aside className="surface record-info"><h2>Mail Özeti</h2><dl>
    <div><dt>Gönderim Kanalı</dt><dd>{m.provider==='gmail'?<span role="img" aria-label="Gmail" style={{fontWeight:500,whiteSpace:'nowrap'}}><span aria-hidden="true"><span style={{color:'#4285F4'}}>G</span><span style={{color:'#EA4335'}}>m</span><span style={{color:'#FBBC05'}}>a</span><span style={{color:'#4285F4'}}>i</span><span style={{color:'#34A853'}}>l</span></span></span>:m.provider==='fake'?'Gönderim yapılmadı':'Folloopy'}</dd></div>
    <div><dt>Gönderim</dt><dd><Chip color={m.state==='sent'?'green':'amber'}>{states[m.state]}</Chip></dd></div>
    <div><dt>Açılma Durumu</dt><dd><Chip color={m.activity_count?'green':'neutral'}>{m.activity_count?'Açılma Algılandı':'Açılma Bekleniyor'}</Chip></dd></div>
   </dl><div className="record-tracking"><Icon name="shield" size={20}/><h3>{m.tracking_enabled?'Aktif Takip':'Takip Durduruldu'}</h3><p>{m.tracking_enabled?'Yeni açılma bilgileri bu mailde güncellenir.':'Yeni açılma bilgisi toplanmıyor. Geçmişiniz korunuyor.'}</p>{m.tracking_enabled?<StopButton action={stop} id={m.id}/>:null}</div></aside>
   <section className="surface record-events"><div className="surface-heading"><div><h2>Mailin Yolculuğu</h2><p>Gönderim ve açılma durumu</p></div><Refresh/></div>
    {m.first_activity_at?<div className="opening-summary"><div><span>İlk Açılma</span><strong>{date(m.first_activity_at,true)}</strong></div><div><span>Son Hareket</span><strong>{date(m.last_activity_at!,true)}</strong></div></div>:null}
    <div className="event-timeline"><div className="event-item"><span className="event-icon tint-mint"><Icon name="check" size={17}/></span><div><strong>{m.state==='sent'?'Mail Gönderildi':states[m.state]}</strong><p>{m.state==='sent'?'E-postanız başarıyla gönderildi.':'Gönderim sonucu kontrol ediliyor.'}</p></div><time>{m.sent_at?date(m.sent_at,true):'Bekliyor'}</time></div>
     {detail.openings.length?detail.openings.map((opening,index)=><div className="event-item" key={opening.first_at}><span className="event-icon tint-blue"><Icon name="eye" size={17}/></span><div><strong>{index===0?'Açılma Algılandı':`${index+1}. Açılma Algılandı`}</strong><p>{index===0?'E-postanız için ilk açılma bilgisi alındı.':'E-postanız için yeni bir açılma bilgisi alındı.'}</p></div><time>{date(opening.first_at,true)}</time></div>):<div className="event-item event-waiting"><span className="event-icon"><Icon name={m.tracking_enabled?'clock':'pause'} size={17}/></span><div><strong>{m.tracking_enabled?'Açılma Bekleniyor':'Takip Durduruldu'}</strong><p>{m.tracking_enabled?'Açılma bilgisi geldiğinde burada göreceksiniz.':'Bu mail için takip kapalı.'}</p></div></div>}
    </div></section></div></Shell>;

 }
 if(view==='setup'){const status=await api('/api/status').catch(()=>({gmailConfigured:false,gmailConnected:false,gmailEmail:null}));return <Shell active={active} online={online}><PageHeading title="Bağlı Hesaplar" description="E-posta hesabınızın bağlantısını ve izinlerini yönetin."/><Link className="button button-outline" href="/panel?view=extensions" style={{marginBottom:20}}>Gmail Ve Outlook Eklentileri<Icon name="arrow" size={15}/></Link><GmailConnection connected={status.gmailConnected} configured={status.gmailConfigured} email={status.gmailEmail} mode={p.mode} reason={p.reason} connect={connectGmail} disconnect={disconnectGmail}/></Shell>}

 if(view==='activity'){
  const selected=messages.slice(0,12);
  const results=await Promise.allSettled(selected.map(m=>api(`/api/messages/${m.id}`) as Promise<Detail>));
  const events=selected.flatMap((m,i)=>{const result=results[i];const openings=result.status==='fulfilled'?result.value.openings:[];return [...(m.sent_at?[{id:`send-${m.id}`,message:m,at:m.sent_at,type:'send',label:'Mail Gönderildi',description:'E-postanız başarıyla gönderildi.'}]:[]),...openings.map((opening,index)=>({id:`open-${m.id}-${opening.first_at}`,message:m,at:opening.first_at,type:'load',label:index===0?'Açılma Algılandı':`${index+1}. Açılma Algılandı`,description:index===0?'E-postanız için ilk açılma bilgisi alındı.':'E-postanız için yeni bir açılma bilgisi alındı.'}))]}).sort((a,b)=>new Date(b.at).getTime()-new Date(a.at).getTime());
  return <Shell active={active} online={online}><PageHeading title="Etkinlik Akışı" description="İletişiminizin her adımı, tek bir zaman çizelgesinde." action={<Refresh/>}/><ActivityStream events={events} filter={p.filter} messageCount={selected.length} incomplete={results.some(r=>r.status==='rejected')}/></Shell>;
 }
 if(view==='messages'){
  const filter=['active','stopped','observed'].includes(p.filter||'')?p.filter:'all';
  const visible=messages.filter(m=>(!p.q||m.subject.toLocaleLowerCase('tr').includes(p.q.toLocaleLowerCase('tr')))&&(filter==='all'||(filter==='active'?m.tracking_enabled:filter==='stopped'?!m.tracking_enabled:m.activity_count>0)));
  return <Shell active={active} online={online}><PageHeading title="Takip Edilen Mailler" description="Gönderim, açılma ve takip durumunu mail bazında inceleyin."/><section className="surface mail-list-surface"><nav className="section-tabs" aria-label="Mail filtreleri">{[{id:'all',label:'Tüm mailler'},{id:'active',label:'Takip Açık'},{id:'observed',label:'Açılma Algılanan'},{id:'stopped',label:'Durdurulan'}].map(f=><Link key={f.id} href={url({view:'messages',filter:f.id,q:p.q})} className={filter===f.id?'active':''} aria-current={filter===f.id?'page':undefined}>{f.label}{f.id==='all'?<span>{messages.length}</span>:null}</Link>)}</nav><div className="table-toolbar"><form action="/panel" method="get" className="inline-search"><Icon name="search" size={17}/><input type="hidden" name="view" value="messages"/><input type="hidden" name="filter" value={filter}/><input name="q" aria-label="Mail konusu ara" placeholder="Mail konusu ara…" defaultValue={p.q} maxLength={200}/><button aria-label="Aramayı uygula"><Icon name="arrow" size={16}/></button></form><span>{visible.length} mail</span><Refresh/></div>{p.q?<div className="search-context">“{p.q}” için sonuçlar<Link href={url({view:'messages',filter})}>Temizle<Icon name="close" size={13}/></Link></div>:null}<MessageTable messages={visible}/><div className="table-footer"><span>Son 50 kayıt gösterilir.</span><span><LiveClock initialAt={new Date().toISOString()}/></span></div></section></Shell>;
 }
 return <Shell active="overview" online={online}><PageHeading title={p.welcome==='1'?'Çalışma Alanınız Hazır.':'Genel Bakış'} description={p.welcome==='1'?'Paketiniz etkinleştirildi. Çalışma alanınızı kullanmaya başlayabilirsiniz.':'E-posta takibinizin güncel durumu, bir bakışta.'} action={<span className="date-label"><Icon name="clock" size={15}/>Son 50 kayıt<Refresh/></span>}/><Metrics messages={messages}/><div className="overview-grid"><Chart messages={messages}/><ConnectionCard/></div><RecentMessages messages={messages}/></Shell>;
}
