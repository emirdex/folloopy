'use client';
import {useActionState,useState} from 'react';
import {Check,ReceiptText} from 'lucide-react';
import type {BillingProfile} from '../../../../packages/domain/billing-profile';
import {BillingFields} from '../odeme/checkout-view';
import {saveBilling} from './billing-actions';
export function BillingEditor({profile,name,email}:{profile:BillingProfile|null;name:string;email:string}){
 const[kind,setKind]=useState<'individual'|'company'>(profile?.kind||'individual'),[state,action,pending]=useActionState(saveBilling,null);
 return <section id="billing" className="surface account-settings-card account-billing-editor"><header><ReceiptText size={21}/><div><h2>Fatura Bilgileri</h2><p>Bireysel veya kurumsal fatura profilinizi düzenleyin.</p></div></header><details><summary>{profile?'Fatura Profilini Düzenle':'Fatura Bilgilerini Tamamla'}</summary><form action={action}><fieldset className="account-billing-kind"><legend>Fatura Türü</legend><label><input type="radio" name="kind" value="individual" checked={kind==='individual'} onChange={()=>setKind('individual')}/>Bireysel</label><label><input type="radio" name="kind" value="company" checked={kind==='company'} onChange={()=>setKind('company')}/>Kurumsal</label></fieldset><BillingFields profile={profile} name={name} email={email} kind={kind}/><button className="button button-outline" disabled={pending}>{pending?'Kaydediliyor…':'Fatura Bilgilerini Kaydet'}<Check size={15}/></button>{state?<p className={'account-edit-result '+(state.ok?'is-success':'is-error')} role={state.ok?'status':'alert'}>{state.message}</p>:null}</form></details></section>
}
