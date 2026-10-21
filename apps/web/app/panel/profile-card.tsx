import type {ReactNode} from 'react';
import {Mail,CalendarDays,ShieldCheck,Clock3,UserRound} from 'lucide-react';

export function ProfileCard({name,email,registeredAt,verified,children}:{name:string;email:string;registeredAt:string;verified:boolean;children:ReactNode}){
 const initials=name.trim().split(/\s+/).filter(Boolean).slice(0,2).map(part=>Array.from(part)[0]).join('').toLocaleUpperCase('tr-TR');
 return <section className="surface account-settings-card member-profile-card" aria-labelledby="profile-card-title">
  <header><span className="profile-heading-icon"><UserRound size={20}/></span><div><span className="profile-eyebrow">KİŞİSEL HESABINIZ</span><h2 id="profile-card-title">Profil Bilgileri</h2><p>Çalışma alanınızdaki kimliğinizi yönetin.</p></div></header>
  <div className="profile-identity"><span className="profile-avatar" aria-hidden="true">{initials||<UserRound size={25}/>}</span><div><strong>{name}</strong><span>{email}</span></div><span className="profile-identity-label">Hesap Sahibi</span></div>
  <div className="profile-edit-area">{children}</div>
  <dl className="profile-detail-grid"><div className="profile-email-detail"><dt><Mail size={15}/>Kayıtlı E-Posta</dt><dd>{email}</dd></div><div><dt><CalendarDays size={15}/>Kayıt Tarihi</dt><dd>{registeredAt}</dd></div><div><dt><ShieldCheck size={15}/>E-Posta Durumu</dt><dd><span className={'profile-verification '+(verified?'is-verified':'is-pending')}>{verified?<ShieldCheck size={13}/>:<Clock3 size={13}/>} {verified?'Doğrulandı':'Doğrulama Bekliyor'}</span></dd></div></dl>
 </section>
}
