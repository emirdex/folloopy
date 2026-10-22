import {ArrowUpRight,Check,UserRound,ShieldCheck,LogOut} from 'lucide-react';
import Link from './destination-link';
import {FlowHeader} from './onboarding';
import type {Account} from './account-api';
import type {BillingPeriod} from '../../../packages/domain/commercial-plans';
import {switchToLogin,switchToRegistration} from './account-actions';
import {EntrySwitchButton} from './signed-in-entry-button';
import './signed-in-entry.css';
export function SignedInEntry({user,mode,preferredPlan,period}:{user:Account;mode:'login'|'register';preferredPlan:string;period:BillingPeriod}){
 const href=preferredPlan?'/paketler?plan='+preferredPlan+'&billing='+period:user.plan?'/panel':'/paketler';
 return <div className="onboarding-page"><FlowHeader user={user} step={0}/><main className="session-entry"><span className="session-entry-icon"><UserRound size={28}/><i><Check size={11}/></i></span><span className="session-entry-kicker">OTURUMUNUZ AÇIK</span><h1>Yeniden hoş geldiniz,<br/>{user.name.split(' ')[0]}.</h1><p>{mode==='register'?'Zaten bir hesabınızla giriş yaptınız. Mevcut hesabınızla devam edebilir veya yeni bir hesap oluşturabilirsiniz.':'Hesabınız açık. Çalışma alanınıza devam edebilir veya farklı bir hesapla giriş yapabilirsiniz.'}</p><div className="session-entry-identity"><UserRound size={17}/><span>{user.email}</span><small>Giriş yapıldı</small></div><Link className="session-entry-primary" href={href}>{preferredPlan?'Seçtiğim Pakete Devam Et':user.plan?'Çalışma Alanıma Git':'Paketimi Seç'}<ArrowUpRight size={17}/></Link>{user.role==='owner'?<Link className="session-entry-admin" href="/admin"><ShieldCheck size={16}/>Site Yönetimini Aç<ArrowUpRight size={14}/></Link>:null}<div className="session-entry-divider"><span>{mode==='register'?'Yeni bir hesap mı oluşturacaksınız?':'Başka bir hesap mı kullanacaksınız?'}</span></div><form action={mode==='register'?switchToRegistration:switchToLogin}><input type="hidden" name="preferredPlan" value={preferredPlan}/><input type="hidden" name="billing" value={period}/><EntrySwitchButton register={mode==='register'}/></form><small className="session-entry-note"><LogOut size={12}/>Bu seçenek yalnızca mevcut oturumunuzu kapatır.</small></main></div>;
}
