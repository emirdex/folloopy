import {randomUUID} from 'node:crypto';
import {redirect} from 'next/navigation';
import {accountApi,requireAccount} from '../account-api';
import {CheckoutScreen} from './checkout-screen';
import '../onboarding.css';
export const metadata={title:'Fatura ve ödeme · Folloopy'};
export default async function Checkout({searchParams}:{searchParams:Promise<{plan?:string;billing?:string}>}){const user=await requireAccount();if(process.env.NODE_ENV==='production'&&!user.email_verified_at)redirect('/hesap/dogrula');const{plan,billing}=await searchParams;if(!['individual','team'].includes(plan||''))redirect('/paketler');const {profile}=await accountApi('/api/account/billing');return <CheckoutScreen profile={profile} user={user} planId={plan!} purchaseKey={randomUUID()} billing={billing} complimentary={process.env.NODE_ENV==='production'&&process.env.BILLING_MODE==='complimentary'}/>}
