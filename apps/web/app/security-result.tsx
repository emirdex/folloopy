import Link from './destination-link';
import {ArrowUpRight,MailCheck,ShieldCheck} from 'lucide-react';
export function SecurityResult({mode,message}:{mode:'verify'|'request'|'reset';message:string}){
 const isReset=mode==='reset',isRequest=mode==='request';
 return <section className="security-complete" role="status" aria-labelledby="security-complete-title">
  <span className="security-complete-icon" aria-hidden="true">{isRequest?<MailCheck size={30}/>:<ShieldCheck size={30}/>}</span>
  <span className="security-complete-kicker">{isRequest?'E-POSTANIZI KONTROL EDİN':'İŞLEM TAMAMLANDI'}</span>
  <h1 id="security-complete-title">{isReset?'Şifreniz Değiştirildi.':isRequest?'Bağlantınız Hazır.':'E-Postanız Doğrulandı.'}</h1>
  <p>{message}</p>
  <Link className="security-complete-action" href={mode==='verify'?'/paketler':'/giris'}><span>{mode==='verify'?'Paketlere Devam Et':'Giriş Yap'}</span><ArrowUpRight size={19}/></Link>
 </section>;
}
