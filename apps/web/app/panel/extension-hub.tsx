import Link from '../destination-link';
import {ArrowUpRight,Download,ChevronDown,Clock3,ShieldCheck,Check,ArrowRight} from 'lucide-react';
import {accountApi} from '../account-api';
import {approveExtension} from './extension-actions';
import {ExtensionGuide} from './extension-guide';
import {ExtensionPairingDialog,ExtensionApprovalButton} from './extension-pairing-dialog';
import {ExtensionAccessCard} from './extension-access-card';
import {ExtensionWorkspace,ProviderMark} from './extension-workspace';
import './extension-hub.css';
import './extension-workspace.css';
type Device={id:string;sender:string;created_at:string;last_seen_at:string|null;expires_at:string};
export async function ExtensionHub({plan,pair,mode}:{plan:string|null;pair?:string;mode?:string}){
 const premium=['team','business'].includes(plan||'');
 const status=await accountApi('/api/extension/status') as {devices:Device[];allowed:boolean};
 const enabled=premium&&status.allowed;
 const connection=pair||mode==='extension-approved'?await accountApi('/api/status').catch(()=>null):null;
 const sender=connection?.gmailConnected?connection.gmailEmail:null;
 return <div className="extension-hub">
  {mode==='extension-approved'&&enabled&&status.devices.length>0&&<ExtensionPairingDialog state="success" sender={sender}/>}
  {mode==='approval-failed'&&<ExtensionPairingDialog state="error"/>}
  {pair&&mode!=='extension-approved'&&mode!=='approval-failed'&&<ExtensionPairingDialog state="request" sender={sender}>{!enabled?<Link className="extension-approval-primary" href="/paketler">Paketini kontrol et<ArrowUpRight size={18}/></Link>:!sender?<><p className="extension-approval-missing">Önce bir Gmail hesabı bağlayın; ardından eklentiden bağlantıyı yeniden başlatın.</p><Link className="extension-approval-primary" href="/panel?view=setup">Gmail hesabımı bağla<ArrowUpRight size={18}/></Link></>:<form action={approveExtension}><input type="hidden" name="pair" value={pair}/><ExtensionApprovalButton/></form>}</ExtensionPairingDialog>}
  <ExtensionWorkspace gmail={<>
   <section className="ext-product ext-product-gmail">
    <div className="ext-product-main"><span className="ext-kicker">GMAIL · GOOGLE WORKSPACE</span><h2>Gmail’den gönderin.<br/>Folloopy’den takip edin.</h2><p>Yeni mesaj pencerenize eklenen Folloopy düğmesiyle e-postalarınızı gönderin. Açılma kayıtlarına ve gönderim geçmişine panelinizden ulaşın.</p><div className="ext-product-points"><span><Check size={15}/>Kendi Gmail hesabınızdan gönderim</span><span><Check size={15}/>Panelinizde e-posta takibi</span></div><div className="ext-product-actions">{enabled?<a className="ext-primary" href="#extension-manual"><Download size={17}/>Kuruluma başlayın<ArrowRight size={17}/></a>:<Link className="ext-primary" href="/paketler">Paketini kontrol et<ArrowUpRight size={17}/></Link>}<span className="ext-plan-note">{enabled?'Gmail eklentisi erişiminiz açık':'Signature paketine dahildir'}</span></div></div>
    <div className="ext-visual" aria-hidden="true"><div className="ext-mail-window"><div className="ext-window-top"><span/><span/><span/><b>Yeni mesaj</b></div><div className="ext-mail-lines"><span>Kime <i/></span><strong>Bir sonraki görüşmemiz</strong><i/><i/><i/></div><div className="ext-mail-footer"><span>Folloopy ile gönder <ArrowUpRight size={13}/></span><ShieldCheck size={17}/></div></div><div className="ext-event"><span className="ext-event-dot"/><div><strong>Açılma kaydı</strong><small>Folloopy panelinizde</small></div><ArrowUpRight size={16}/></div></div>
   </section>
   <div className="ext-availability"><span className="ext-availability-icon"><Clock3 size={18}/></span><div><strong>Chrome Web Store yayını bekleniyor</strong><p>{enabled?'Mağaza yayını tamamlanana kadar aşağıdaki manuel kurulum rehberini kullanabilirsiniz.':'Manuel kurulum için aktif Signature üyeliği gerekir.'}</p></div><span className="ext-soon">Mağaza yayını bekleniyor</span></div>
   <ExtensionAccessCard devices={enabled?status.devices:[]} allowed={enabled}/>
   {enabled&&<details open id="extension-manual" className="extension-alternative-install"><summary><span className="extension-alternative-icon"><Download size={18} aria-hidden="true"/></span><span><strong>Manuel kurulum rehberi</strong><small>Kurulumdan ilk gönderime kadar tüm adımları izleyin.</small></span><ChevronDown size={17} aria-hidden="true"/></summary><div className="extension-alternative-content"><a className="extension-next" href="/eklentiler/indir"><Download size={15}/>Kurulum paketini indirin</a><ExtensionGuide/></div></details>}
  </>} outlook={<>
   <section className="ext-product ext-product-outlook"><div className="ext-product-main"><span className="ext-kicker">OUTLOOK · MICROSOFT 365</span><h2>Outlook için Folloopy.</h2><p>Outlook desteği planlanıyor. Eklenti kullanıma açıldığında kurulum, hesap eşleştirme ve bağlantı yönetimi işlemlerinizi bu alandan yapabileceksiniz.</p><div className="ext-outlook-state"><Clock3 size={18}/><span>Henüz kullanıma açık değil</span></div></div><div className="ext-outlook-visual" aria-hidden="true"><div className="ext-outlook-orbit"/><div className="ext-outlook-logo"><ProviderMark provider="outlook"/></div><span>Microsoft 365</span></div></section>
   <section className="ext-outlook-info"><span className="ext-availability-icon"><ShieldCheck size={22}/></span><div><h3>Kurulum durumu</h3><p>Outlook için henüz indirilebilir bir kurulum paketi veya hesap bağlantısı sunulmuyor. Gmail eklentisi Outlook hesaplarında çalışmaz.</p></div><span className="ext-soon">Planlanıyor</span></section>
  </>}/>
 </div>
}
