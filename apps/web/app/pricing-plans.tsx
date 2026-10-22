'use client';
import {useState} from 'react';
import {SignatureBadge} from './signature-badge';
import {BillingToggle} from './billing-toggle';
import Link from './destination-link';
import {ArrowUpRight,Mail,Check,Minus,Users,Info} from 'lucide-react';
import {commercialPlans,planPricing,formatPrice,type BillingPeriod} from '../../../packages/domain/commercial-plans';
import {BULK_MAX_RECIPIENTS} from '../../../packages/domain/bulk-mail';
import './pricing-plans.css';
const features=[
 {label:'Panelden tekli mail gönderimi',detail:'Bağlı Gmail hesabınızdan kendi adınıza gönderin.',values:[true,true]},
 {label:'Açılma ve tekrar açılma takibi',detail:'İlk açılmayı ve sonraki hareketleri inceleyin.',values:[true,true]},
 {label:'Mail arama ve etkinlik geçmişi',detail:'Yazışmalarınızı bulun, takip geçmişini görüntüleyin.',values:[true,true]},
 {label:'Kayıtlı mail taslağı',detail:'İçeriklerinizi kaydedin ve yeniden kullanın.',values:[commercialPlans[0].draftLimit+' taslak',commercialPlans[1].draftLimit+' taslak'],difference:true},
 {label:'Gmail için Chrome eklentisi',detail:'Gmail’den tek alıcılı metin gönderimi. Manuel kurulum.',values:[false,true],difference:true},
 {label:'CSV ile alıcı içe aktarma',detail:'Adresleri ve tekrar eden kayıtları kontrol edin.',values:[false,true],difference:true},
 {label:'Kişiselleştirilmiş toplu gönderim',detail:'Ad ve şirket bilgileriyle alıcıya özel mesajlar hazırlayın.',values:[false,true],difference:true},
 {label:'Toplu gönderim yönetimi',detail:'Gönderimleri duraklatın, sonuçları indirin.',values:[false,true],difference:true}
];
export function PricingPlans({hasAccount,marketing=false}:{hasAccount:boolean;marketing?:boolean}){
 const[period,setPeriod]=useState<BillingPeriod>('monthly');
 return <div className="pricing-section-content pricing-redesign" data-reveal><BillingToggle period={period} onChange={setPeriod}/><div className="pricing-choice-grid">{commercialPlans.map((plan,index)=>{
  const signature=plan.bulkMail,price=planPricing(plan,period);
  return <article className={'pricing-choice '+(signature?'pricing-choice-signature':'')} key={plan.id} aria-labelledby={'pricing-plan-'+plan.id}>
   <header><span className="pricing-choice-audience">{signature?'ALICI LİSTESİYLE ÇALIŞANLARA':'BİREBİR YAZIŞMALAR İÇİN'}</span>{signature?<SignatureBadge/>:<span className="pricing-choice-icon"><Mail size={19}/></span>}</header>
   <h3 id={'pricing-plan-'+plan.id}>{plan.name}</h3><p className="pricing-choice-description">{signature?'Bir listeye ulaşın. Her alıcıya özel gönderin.':'Mailinizi gönderin. Sonrasını takip edin.'}</p>
   <div className="pricing-choice-price" aria-live="polite" aria-atomic="true"><strong>{formatPrice(price.monthly)}</strong><span>TL<small>/ ay{period==='yearly'?' karşılığı':''}</small></span></div>
   <p className="pricing-choice-billing">{period==='yearly'?`${formatPrice(price.total)} TL / yıl · 12 ay peşin`:`Her ay ${formatPrice(price.total)} TL`}<span>E-posta hesabı başına</span></p>
   <Link href={(marketing?'/iletisim':hasAccount?'/paketler':'/kayit')+'?plan='+plan.id+'&billing='+period} className={'pricing-choice-cta '+(signature?'is-primary':'')}>{marketing?plan.name+' Hakkında Bilgi Al':plan.name+' ile Başla'}<ArrowUpRight size={17}/></Link>
   <div className="pricing-choice-use"><span>{signature?<Users size={15}/>:<Mail size={15}/>}</span><p>{signature?'Alıcı listeleri ve kişiselleştirilmiş gönderimler için.':'Teklifler ve birebir müşteri yazışmaları için.'}</p></div>
   <div className="pricing-choice-features"><span>KAPSAM VE PAKET FARKLARI</span><ul aria-label={plan.name+' özellikleri'}>{features.map(feature=>{
    const value=feature.values[index],included=value!==false;
    return <li key={feature.label} className={(feature.difference?'is-difference ':'')+(included?'is-included':'is-excluded')}><span className="pricing-feature-icon" aria-hidden="true">{included?<Check size={15}/>:<Minus size={15}/>}</span><div><div className="pricing-feature-title"><h4>{feature.label}</h4><span className="pricing-feature-value">{typeof value==='string'?value:value?'Dahil':'Dahil değil'}</span></div><p>{feature.detail}</p></div></li>
   })}</ul></div>
   <footer className="pricing-choice-footer"><Info size={15} aria-hidden="true"/><p>{signature?<>İşlem başına en fazla <strong>{BULK_MAX_RECIPIENTS} alıcı</strong>. Her alıcı 1 gönderim hakkı kullanır; toplam kullanım paketinizdeki haklarla sınırlıdır.</>:<>Tekli gönderimler paketinizdeki kullanım hakkından düşer. Taslağınızı kaydetmek gönderim hakkı kullanmaz.</>}</p></footer>
  </article>
 })}</div></div>;
}
