'use client';
import {useActionState,useState} from 'react';
import type {Account} from '../account-api';
import type {BillingProfile} from '../../../../packages/domain/billing-profile';
import {completePurchase} from '../account-actions';
import {FlowHeader} from '../onboarding';
import {CheckoutView} from './checkout-view';
export function CheckoutScreen({user,profile,...props}:{user:Account;profile:BillingProfile|null;planId:string;purchaseKey:string;billing?:string;complimentary:boolean}){
 const [kind,setKind]=useState<'individual'|'company'>(profile?.kind||'individual'),[defer,setDefer]=useState(false);
 const [state,action,pending]=useActionState(completePurchase,null);
 return <div className="onboarding-page"><FlowHeader user={user} step={3}/><CheckoutView {...props} profile={profile} name={user.name} email={user.email} kind={kind} onKind={setKind} defer={defer} onDefer={setDefer} action={action} pending={pending} error={state?.error}/></div>;
}
