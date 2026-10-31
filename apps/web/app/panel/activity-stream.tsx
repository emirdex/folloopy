import {MessageInspectLink} from './message-drawer';
import {activityHref,type ActivityFeed,type StreamEvent} from '../../../../packages/domain/activity-feed';
import {ActivitySearch,ActivityPageJump} from './activity-search';
import {ActivityFilterLink} from './activity-filter-link';
import {LiveClock} from '../live-clock';
import Link from '../destination-link';
import {ActivityRhythm} from './activity-rhythm';
import {Activity,Send,Eye,ArrowUpRight,Clock3,Mail,ArrowRight} from 'lucide-react';
import './activity-stream.css';

export type {StreamEvent} from '../../../../packages/domain/activity-feed';
const day=(value:string)=>new Intl.DateTimeFormat('tr-TR',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Istanbul'}).format(new Date(value));
const hour=(value:string)=>new Intl.DateTimeFormat('tr-TR',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Istanbul'}).format(new Date(value));
function Pagination({feed,query,range,filter}:{feed:ActivityFeed;query:string;range:string;filter:string}){
 const page=Math.floor(feed.offset/feed.pageSize)+1,pages=Math.max(1,Math.ceil(feed.total/feed.pageSize));
 const target=(offset:number)=>activityHref({q:query,range,filter,offset});
 return <nav className="stream-pagination" aria-label="Etkinlik sayfaları"><span>{feed.total?`${feed.offset+1}–${feed.offset+feed.events.length} / ${feed.total} etkinlik`:'0 etkinlik'}</span><div>{page>1?<Link href={target(feed.offset-feed.pageSize)} scroll={false} aria-label="Önceki etkinlik sayfası">← Önceki</Link>:<span className="is-disabled" aria-disabled="true">← Önceki</span>}<ActivityPageJump key={page+'-'+pages} page={page} pages={pages} query={query} range={range} filter={filter}/>{page<pages?<Link href={target(feed.offset+feed.pageSize)} scroll={false} aria-label="Sonraki etkinlik sayfası">Sonraki →</Link>:<span className="is-disabled" aria-disabled="true">Sonraki →</span>}</div></nav>;
}
export function ActivityStream({feed,filter='all',query='',range='all'}:{feed:ActivityFeed;filter?:string;query?:string;range?:string}){
 const selected=['send','load'].includes(filter)?filter:'all';
 const visible=feed.events;
 const groups=new Map<string,StreamEvent[]>();for(const event of visible){const key=day(event.at);groups.set(key,[...(groups.get(key)||[]),event]);}
 const {sent,opens,openedMessages,latest,messageCount}=feed;
 const href=(filter:string)=>activityHref({filter,q:query,range});
 const pager=<Pagination feed={feed} query={query} range={range} filter={selected}/>;
 return <div className="premium-stream">
  <section className="stream-overview" aria-label="Etkinlik özeti"><div className="stream-overview-intro"><span className="stream-kicker"><Activity size={14}/>MAİLLERİNİZİN HİKÂYESİ</span><h2>Her Hareket,<br/>Daha Net Bir Bakış.</h2><p>Gönderimden tekrar açılmaya, {messageCount} mailinizdeki hareketler. Arama ve tarih seçiminize göre güncellenir.</p></div><div className="stream-stat"><span className="stream-stat-icon"><Send size={19}/></span><strong>{sent.toLocaleString('tr-TR')}</strong><span>Gönderim</span></div><div className="stream-stat is-opening"><span className="stream-stat-icon"><Eye size={19}/></span><strong>{opens.toLocaleString('tr-TR')}</strong><span>Açılma Hareketi</span></div><div className="stream-stat"><span className="stream-stat-icon"><Mail size={19}/></span><strong>{openedMessages.toLocaleString('tr-TR')}</strong><span>Açılma Algılanan Mail</span></div></section>
  <div className="stream-layout"><section className="stream-timeline-panel" aria-labelledby="stream-timeline-title"><header className="stream-panel-header"><div><span className="stream-kicker">ZAMAN ÇİZELGESİ</span><h2 id="stream-timeline-title">İletişiminizin Akışı</h2></div><span className="stream-record-count">{feed.total} etkinlik</span></header>
   <nav className="stream-filters" aria-label="Etkinlik filtreleri">{[{id:'all',label:'Tüm Etkinlikler',count:sent+opens,icon:Activity},{id:'send',label:'Gönderimler',count:sent,icon:Send},{id:'load',label:'Açılmalar',count:opens,icon:Eye}].map(({icon:Icon,...item})=><ActivityFilterLink key={item.id} href={href(item.id)} filter={item.id} selected={selected===item.id}><span className="stream-filter-icon"><Icon size={16} aria-hidden="true"/></span><span className="stream-filter-label">{item.label}</span><span className="stream-filter-count">{item.count}</span></ActivityFilterLink>)}</nav>
   <ActivitySearch key={query+'-'+range+'-'+selected} query={query} range={range} filter={selected}/>
   {query||range!=='all'?<div className="stream-search-context"><span>{query?`“${query}” için sonuçlar`:'Tarih filtresi uygulandı'}</span><Link href={activityHref({filter:selected})} scroll={false}>Filtreleri temizle ×</Link></div>:null}
   {pager}
   {visible.length?<div className="stream-days">{[...groups].map(([date,items])=><section className="stream-day" key={date} aria-label={date}><div className="stream-day-label"><span>{date}</span><i/><small>{items.length} hareket bu sayfada</small></div><ol>{items.map(event=><li className={'stream-event '+(event.type==='send'?'is-send':'is-open')} key={event.id}><span className="stream-event-mark">{event.type==='send'?<Send size={17}/>:<Eye size={17}/>}</span><div className="stream-event-card"><div className="stream-event-top"><span className="stream-event-label">{event.label}</span><time dateTime={event.at}>{hour(event.at)}</time></div><MessageInspectLink className="stream-event-subject" id={event.message.id}>{event.message.subject}<ArrowUpRight size={15}/></MessageInspectLink><p>{event.description}</p></div></li>)}</ol></section>)}</div>:<div className="stream-empty"><Activity size={27}/><h3>{query||range!=='all'?'Eşleşen Etkinlik Yok':'Akışınız Burada Başlayacak'}</h3><p>{query||range!=='all'?'Aramayı veya tarih aralığını değiştirerek yeniden deneyin.':selected==='all'?'İlk mailinizi gönderdiğinizde etkinliklerinizi burada göreceksiniz.':'Bu filtreye uygun bir etkinlik henüz bulunmuyor.'}</p><Link href={query||range!=='all'?'/panel?view=activity':selected==='all'?'/panel?view=compose':'/panel?view=activity'}>{query||range!=='all'?'Filtreleri Temizle':selected==='all'?'Mail Oluştur':'Tüm Etkinlikleri Gör'}<ArrowRight size={14}/></Link></div>}
   {feed.total>feed.pageSize?pager:null}
   <footer className="stream-timeline-footer"><Clock3 size={12}/><LiveClock initialAt={new Date().toISOString()}/> · Sayfa başına 10 etkinlik · En yeniden eskiye</footer>
  </section><aside className="stream-sidebar"><section className="stream-latest"><ActivityRhythm/><span className="stream-kicker">SON HAREKET</span><h2>{latest?latest.label:'Yeni Bir Başlangıç'}</h2><p>{latest?latest.message.subject:'İlk gönderiminizle iletişiminizin yolculuğu başlasın.'}</p>{latest?<div className="stream-latest-date"><Clock3 size={13}/>{day(latest.at)} · {hour(latest.at)}</div>:null}{latest?<MessageInspectLink id={latest.message.id}>Hareketleri göster<ArrowUpRight size={16}/></MessageInspectLink>:<Link href="/panel?view=compose">Mail Oluştur<ArrowUpRight size={16}/></Link>}</section>
   <section className="stream-legend"><span className="stream-kicker">AKIŞTA NELER VAR?</span><div><span className="stream-legend-icon"><Send size={16}/></span><div><h3>Gönderim</h3><p>Başarıyla gönderilen mailleriniz.</p></div></div><div><span className="stream-legend-icon is-opening"><Eye size={16}/></span><div><h3>Açılma Ve Tekrar Açılma</h3><p>Farklı zamanlarda gelen açılma hareketleri.</p></div></div><Link href="/panel?view=messages">Tüm Maillere Git<ArrowRight size={14}/></Link></section>
  </aside></div>
 </div>
}
