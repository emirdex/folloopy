import {packagePolicies} from './plan-policy';
// Commercial product definition. Provider, billing and feature enforcement are
// implemented separately; local prototype safety quotas are not plan features.
export const freePlan={id:'free',name:'Free',dailyMessageLimit:3,draftLimit:1} as const;
export const commercialPlans=[
 {id:'individual',name:'Essential',messageLimit:100,draftLimit:packagePolicies.individual.drafts,bulkMail:false,gmailExtension:false,monthlyPrice:249,annualMonthlyPrice:199,eyebrow:'E-POSTA AÇILMA TAKİBİ',headline:'Mail takibinizin günlük çalışma alanı.',description:'Soğuk satış e-postalarınızın ve tekliflerinizin açılma hareketlerini takip edin.',groups:[{title:'10 kayıtlı mail taslağı',text:'Mail içeriklerinizi kaydedin, düzenleyin ve yeniden kullanın.'},{title:'Açılma takibi',text:'İlk açılma, tekrar açılma, zaman çizelgesi ve açılma bildirimleri.'},{title:'Bağlantı takibi ve raporlar',text:'Ayda 100 mailde bağlantı takibi, CSV raporları ve 90 günlük geçmiş.'},{title:'Hatırlatmalar',text:'10 aktif hatırlatma ve isteğe bağlı haftalık özet. Zamanlama Signature paketindedir.'}],capabilities:['mail_opens','open_notifications','mail_timeline','search_filters','stop_tracking','document_views','document_downloads']},
 {id:'team',name:'Signature',messageLimit:500,draftLimit:packagePolicies.team.drafts,bulkMail:true,gmailExtension:true,monthlyPrice:499,annualMonthlyPrice:399,eyebrow:'BELGE VE SATIŞ ANALİZİ',headline:'Mailin ötesinde, teklifinizin takibi.',description:'Essential’daki mail takibine belge, link ve müşteri etkileşimi analizini ekleyin.',groups:[{title:'Gmail için Chrome eklentisi',text:'Gmail’den takipli gönderim yapın; kayıtlı şablonları ve takip panelini kullanın.'},{title:'Toplu mail gönderimi',text:'Ayda 5.000, günde 500 alıcı gönderimi. Kampanya başına 500 alıcı; zamanlama ve duraklatma.'},{title:'50 kayıtlı mail taslağı',text:'Farklı yazışmalarınız için taslaklar oluşturun ve yeniden kullanın.'},{title:'Takipli dosya paylaşımı',text:'100 dosya, dosya başına 25 MB. Görüntüleme, indirme hareketleri, PDF sayfaları, yaklaşık aktif süre ve şifreli paylaşım.'},{title:'Müşteri etkileşimi analizi',text:'365 günlük geçmiş, 100 hatırlatma ve özel tarih aralıklı raporlar.'}],capabilities:['mail_opens','open_notifications','mail_timeline','search_filters','stop_tracking','bulk_mail','gmail_extension','document_views','document_downloads','link_clicks','engagement_reports','followup_reminders']}
] as const;
export const planBillingUnit='e-posta hesabı başına / ay';
export type CommercialPlan=typeof commercialPlans[number];
export type BillingPeriod='monthly'|'yearly';
export function billingPeriod(value:unknown):BillingPeriod{return value==='yearly'?'yearly':'monthly'}
export function formatPrice(value:number){return new Intl.NumberFormat('tr-TR',{maximumFractionDigits:0}).format(value)}
export function planPricing(plan:CommercialPlan,period:BillingPeriod='monthly'){
 const monthly=period==='yearly'?plan.annualMonthlyPrice:plan.monthlyPrice;
 return {monthly,total:monthly*(period==='yearly'?12:1),annualSavings:(plan.monthlyPrice-plan.annualMonthlyPrice)*12};
}
export function planPriceLabel(plan:CommercialPlan,period:BillingPeriod='monthly'){return `${formatPrice(planPricing(plan,period).monthly)} TL / ay${period==='yearly'?' · 12 ay peşin':''}`}

export function mailDraftLimit(plan:string|null|undefined){return typeof plan==='string'&&Object.hasOwn(packagePolicies,plan)?packagePolicies[plan as keyof typeof packagePolicies].drafts:0}
