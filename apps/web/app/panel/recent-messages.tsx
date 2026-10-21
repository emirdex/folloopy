import Link from 'next/link';
import {Mail,ArrowUpRight,ArrowRight,Eye,Clock3,Pause,Check} from 'lucide-react';
import './recent-messages.css';

type RecentMessage={id:string;subject:string;state:string;created_at:string;sent_at:string|null;tracking_enabled:boolean;activity_count:number;last_activity_at:string|null};
const date=(value:string)=>new Intl.DateTimeFormat('tr-TR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Istanbul'}).format(new Date(value));
export function RecentMessages({messages}:{messages:RecentMessage[]}){
 const recent=messages.slice(0,10);
 return <section className="recent-message-hub" aria-labelledby="recent-message-title"><header className="recent-message-heading"><div><span className="recent-message-eyebrow"><Mail size={13}/>YAZIŞMALARINIZA HIZLI BAKIŞ</span><h2 id="recent-message-title">Son Gönderimler</h2><p>Son mailleriniz, en güncel hareketleriyle.</p></div><Link className="recent-message-view-all" href="/panel?view=messages">Tümünü Gör<ArrowUpRight size={15}/></Link></header>
  {recent.length?<ol className="recent-message-list">{recent.map(message=>{
   const opened=message.state==='sent'&&message.activity_count>0;
   const pending=message.state==='sending'||message.state==='unknown'||message.state==='prepared';
   const label=opened?'Açılma Algılandı':message.state==='failed'?'Gönderilemedi':pending?'Gönderim Kontrol Ediliyor':!message.tracking_enabled?'Takip Kapalı':'Açılma Bekleniyor';
   const StatusIcon=message.state==='failed'?Mail:opened?Eye:pending?Clock3:message.tracking_enabled?Clock3:Pause;
   return <li key={message.id}><Link className={'recent-message-row '+(opened?'has-opening':message.state==='failed'?'has-error':'')} href={'/panel?id='+message.id} aria-label={message.subject+' · '+label+' · Ayrıntıyı aç'}><span className="recent-message-icon"><Mail size={21}/></span><div className="recent-message-main"><strong>{message.subject}</strong><span><time dateTime={message.sent_at||message.created_at}>{date(message.sent_at||message.created_at)}</time><i/>{message.state==='sent'?<><Check size={11}/>Gönderildi</>:message.state==='failed'?'Gönderim Başarısız':'İşlem Devam Ediyor'}</span></div><div className="recent-message-status"><span className="recent-message-status-pill"><StatusIcon size={13}/>{label}</span><small>{opened&&message.last_activity_at?<>Son hareket <time dateTime={message.last_activity_at}>{date(message.last_activity_at)}</time></>:message.state==='failed'?'Ayrıntıları kontrol edin':pending?'Sonuç kontrol ediliyor':message.tracking_enabled?'Yeni hareketler burada görünecek':'Yeni hareketler kaydedilmiyor'}{opened&&!message.tracking_enabled?' · Takip kapalı':''}</small></div><span className="recent-message-open" aria-hidden="true"><ArrowUpRight size={16}/></span></Link></li>
  })}</ol>:<div className="recent-message-empty"><span className="recent-message-icon"><Mail size={25}/></span><h3>İlk Mailinizle Başlayın</h3><p>Gönderdiğiniz mailler ve güncel durumları burada görünecek.</p><Link href="/panel?view=compose">Mail Oluştur<ArrowRight size={15}/></Link></div>}
  {recent.length?<footer><span className="recent-message-footer-dot"/><span>{messages.length>10?'En yeni 10 mail gösteriliyor. Diğer mailleriniz için tüm listeyi açın.':`${recent.length} mail gösteriliyor.`}</span><span className="recent-message-timezone">İstanbul Saati</span></footer>:null}
 </section>
}
