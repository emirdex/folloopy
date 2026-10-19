// Commercial product definition. Provider, billing and feature enforcement are
// implemented separately; local prototype safety quotas are not plan features.
export const commercialPlans=[
 {id:'individual',name:'Essential',monthlyPrice:229,eyebrow:'E-POSTA AÇILMA TAKİBİ',headline:'Mail takibinizin günlük çalışma alanı.',description:'Soğuk satış e-postalarınızın ve tekliflerinizin açılma hareketlerini takip edin.',groups:[{title:'Açılma takibi',text:'İlk açılma, tekrar açılma, zaman çizelgesi ve açılma bildirimleri.'},{title:'Günlük çalışma alanı',text:'Mail arama, filtreleme, etkinlik geçmişi ve mail bazında takip kontrolü.'}],capabilities:['mail_opens','open_notifications','mail_timeline','search_filters','stop_tracking']},
 {id:'team',name:'Signature',monthlyPrice:389,eyebrow:'BELGE VE SATIŞ ANALİZİ',headline:'Mailin ötesinde, teklifinizin takibi.',description:'Essential’daki mail takibine belge, link ve müşteri etkileşimi analizini ekleyin.',groups:[{title:'Belge ve link takibi',text:'Paylaşılan belgelerin görüntülenmesi, teklif indirmeleri ve link tıklamaları.'},{title:'Müşteri etkileşimi analizi',text:'Etkileşim raporları, ilgili müşterileri önceliklendirme ve takip hatırlatmaları.'}],capabilities:['mail_opens','open_notifications','mail_timeline','search_filters','stop_tracking','document_views','document_downloads','link_clicks','engagement_reports','followup_reminders']}
] as const;
export const planBillingUnit='e-posta hesabı başına / ay';
export type CommercialPlan=typeof commercialPlans[number];
export function planPriceLabel(plan:CommercialPlan){return `${plan.monthlyPrice} TL / ay`}
