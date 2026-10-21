import Link from '../../destination-link';
import {redirect} from 'next/navigation';
import {Check,ArrowUpRight} from 'lucide-react';
import {requireVerifiedAccount,accountApi} from '../../account-api';
import {FlowHeader} from '../../onboarding';
import {commercialPlans} from '../../../../../packages/domain/commercial-plans';
import '../../onboarding.css';
import '../checkout.css';
export const metadata={title:'Paketiniz hazır · Folloopy'};
export default async function Completed(){
 const user=await requireVerifiedAccount();if(!user.plan)redirect('/paketler');
 if(process.env.NODE_ENV==='production'&&process.env.BILLING_MODE!=='complimentary')redirect('/panel');
 const {profile}=await accountApi('/api/account/billing');
 const plan=commercialPlans.find(plan=>plan.id===user.plan)?.name||'Enterprise';
 return <div className="onboarding-page"><FlowHeader user={user} step={4}/><main className="billing-checkout"><section className="billing-success"><span className="billing-success-icon"><Check size={31}/></span><span className="flow-kicker">ÇALIŞMA ALANINIZ HAZIR</span><h1>{plan} Paketiniz Etkin.</h1><p>{user.name}, artık e-postalarınızı gönderebilir ve açılma hareketlerini kendi panelinizden takip edebilirsiniz.</p><dl className="billing-success-summary"><div><dt>Etkin Paket</dt><dd>{plan}</dd></div><div><dt>Tahsil Edilen</dt><dd>0 TL · Ücretsiz Erişim</dd></div></dl><small>{profile?'Fatura profiliniz hesabınıza kaydedildi.':'Fatura bilgilerinizi daha sonra tamamlayabilirsiniz.'} Bu etkinleştirmede ödeme alınmadı ve fatura oluşturulmadı.</small><Link className="billing-submit" href="/panel?welcome=1">Çalışma Alanıma Git<ArrowUpRight size={17}/></Link><Link className="billing-order-change" href="/panel?view=setup">Gmail Hesabımı Bağla</Link></section></main></div>
}
