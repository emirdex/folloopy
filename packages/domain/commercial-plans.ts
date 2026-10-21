// Commercial product definition. Provider, billing and feature enforcement are
// implemented separately; local prototype safety quotas are not plan features.
export const commercialPlans=[
 {id:'individual',name:'Essential',draftLimit:1,monthlyPrice:319,annualMonthlyPrice:259,eyebrow:'E-POSTA AÇILMA TAKİBİ',headline:'Mail takibinizin günlük çalışma alanı.',description:'Soğuk satış e-postalarınızın ve tekliflerinizin açılma hareketlerini takip edin.',groups:[{title:'1 kayıtlı mail taslağı',text:'Mail içeriklerinizi kaydedin, düzenleyin ve yeniden kullanın.'},{title:'Açılma takibi',text:'İlk açılma, tekrar açılma, zaman çizelgesi ve açılma bildirimleri.'},{title:'Günlük çalışma alanı',text:'Mail arama, filtreleme, etkinlik geçmişi ve mail bazında takip kontrolü.'}],capabilities:['mail_opens','open_notifications','mail_timeline','search_filters','stop_tracking']},
 {id:'team',name:'Signature',draftLimit:10,monthlyPrice:549,annualMonthlyPrice:400,eyebrow:'BELGE VE SATIŞ ANALİZİ',headline:'Mailin ötesinde, teklifinizin takibi.',description:'Essential’daki mail takibine belge, link ve müşteri etkileşimi analizini ekleyin.',groups:[{title:'10 kayıtlı mail taslağı',text:'Farklı yazışmalarınız için taslaklar oluşturun ve yeniden kullanın.'},{title:'Belge ve link takibi',text:'Paylaşılan belgelerin görüntülenmesi, teklif indirmeleri ve link tıklamaları.'},{title:'Müşteri etkileşimi analizi',text:'Etkileşim raporları, ilgili müşterileri önceliklendirme ve takip hatırlatmaları.'}],capabilities:['mail_opens','open_notifications','mail_timeline','search_filters','stop_tracking','document_views','document_downloads','link_clicks','engagement_reports','followup_reminders']}
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

export function mailDraftLimit(plan:string|null|undefined){return commercialPlans.find(item=>item.id===plan)?.draftLimit||(plan==='business'?10:0)}
