'use client';
import type {ReactNode} from 'react';
import type {BillingPeriod} from '../../../packages/domain/commercial-plans';
import './billing-toggle.css';
export function BillingToggle({period,onChange,caption}:{period:BillingPeriod;onChange:(value:BillingPeriod)=>void;caption?:ReactNode}){
 return <div className="billing-choice"><div className="billing-toggle" role="group" aria-label="Ödeme dönemi"><button type="button" aria-pressed={period==='monthly'} onClick={()=>onChange('monthly')}>Aylık</button><button type="button" aria-pressed={period==='yearly'} onClick={()=>onChange('yearly')}>Yıllık<span>Avantajlı</span></button></div><p role="status">{caption??(period==='yearly'?'12 aylık tutar tek seferde ödenir. Fiyatlar aylık karşılığıyla gösterilir.':'Aylık ödeyin veya 12 ay peşin ödeme avantajından yararlanın.')}</p></div>
}
