import Link from '../destination-link';
import {ArrowUpRight,Check,Clock3,KeyRound,LogOut,Mail,Monitor,ShieldCheck} from 'lucide-react';
import {revokeExtension} from './extension-actions';
import './extension-access-card.css';

type Device={id:string;sender:string;created_at:string;last_seen_at:string|null;expires_at:string};
const protections=[
 {icon:ShieldCheck,title:'Üyeliğe bağlı erişim',copy:'Her gönderimde aktif paket ve oturum kontrol edilir.'},
 {icon:Monitor,title:'Tek tarayıcı bağlantısı',copy:'Yeni eşleştirme, önceki tarayıcının erişimini kaldırır.'},
 {icon:LogOut,title:'Oturumla birlikte kapanır',copy:'Hesabınızdan çıkış yaptığınızda eklenti erişimi sona erer.'},
 {icon:KeyRound,title:'Hesabınıza özel yetki',copy:'Kurulum dosyası, hesabınıza ait erişim anahtarlarını içermez.'},
];
export function ExtensionAccessCard({devices,allowed=true}:{devices:Device[];allowed?:boolean}){
 return <section className="extension-access-card" aria-labelledby="extension-access-title">
  <header className="extension-access-heading">
   <span className="extension-access-emblem"><ShieldCheck size={22} aria-hidden="true"/></span>
   <div><h2 id="extension-access-title">Tarayıcı bağlantınız</h2><p>Eşleştirilen hesabı ve eklentinin erişimini yönetin.</p></div>
   <span className="extension-access-count">{devices.length?`${devices.length} tarayıcı bağlı`:'Bağlantı kurulmadı'}</span>
  </header>
  <div className="extension-access-connections">
   {devices.length?devices.map(device=><article className="extension-connection" key={device.id}>
    <div className="extension-connection-summary">
     <span className="extension-connection-mail"><Mail size={21} aria-hidden="true"/></span>
     <div className="extension-connection-account"><span>BAĞLI GMAIL HESABI</span><strong>{device.sender}</strong></div>
     <span className="extension-connection-status"><Check size={13} aria-hidden="true"/>Eşleştirildi</span>
    </div>
    <dl className="extension-connection-meta">
     <div><dt><Monitor size={15} aria-hidden="true"/>Tarayıcı</dt><dd>Google Chrome</dd></div>
     <div><dt><Clock3 size={15} aria-hidden="true"/>Son kontrol</dt><dd>{device.last_seen_at?<time dateTime={device.last_seen_at}>{new Intl.DateTimeFormat('tr-TR',{timeZone:'Europe/Istanbul',dateStyle:'medium',timeStyle:'short'}).format(new Date(device.last_seen_at))}</time>:'İlk bağlantı kontrolü bekleniyor'}</dd></div>
    </dl>
    <div className="extension-connection-actions">
     <Link className="extension-account-manage" href="/panel?view=setup">Gmail hesabını yönet<ArrowUpRight size={16} aria-hidden="true"/></Link>
     <form action={revokeExtension}><button className="extension-account-disconnect"><LogOut size={15} aria-hidden="true"/>Tarayıcı bağlantısını kaldır</button></form>
    </div>
   </article>):<div className="extension-connection-empty"><span className="extension-connection-mail"><Monitor size={23} aria-hidden="true"/></span><div><h3>Henüz bir tarayıcı eşleştirilmedi</h3><p>{allowed?'Gmail hesabınızı bağladıktan sonra eklentideki “Hesabımı bağla” seçeneğiyle eşleştirmeyi tamamlayın.':'Chrome eklentisini kullanmak için Signature paketine geçin.'}</p><Link className="extension-account-manage" href="/panel?view=setup">Gmail hesabını yönet<ArrowUpRight size={16} aria-hidden="true"/></Link></div></div>}
  </div>
  <div className="extension-access-protections" aria-label="Eklenti erişim koşulları">{protections.map(({icon:Icon,title,copy})=><div key={title}><Icon size={16} aria-hidden="true"/><span><strong>{title}</strong><small>{copy}</small></span></div>)}</div>
 </section>;
}
