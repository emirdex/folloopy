import {CircleDot,Sparkles,Building2,Minus} from 'lucide-react';
const plans={individual:{name:'Essential',Icon:CircleDot},team:{name:'Signature',Icon:Sparkles},business:{name:'Enterprise',Icon:Building2}} as const;
export function PlanBadge({plan}:{plan?:string|null}){
 const key=plan==='Essential'?'individual':plan==='Signature'?'team':plan==='Enterprise'?'business':plan;
 const definition=key&&Object.hasOwn(plans,key)?plans[key as keyof typeof plans]:null;
 const Icon=definition?.Icon||Minus;
 return <span className={'admin-plan-badge admin-plan-'+(definition?key:'none')}><span aria-hidden="true"><Icon size={14}/></span>{definition?.name||'Paket Seçilmedi'}</span>;
}
