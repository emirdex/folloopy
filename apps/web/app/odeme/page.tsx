import {randomUUID} from 'node:crypto';
import {redirect} from 'next/navigation';
import {requireAccount} from '../account-api';
import {CheckoutScreen} from '../onboarding';
import '../onboarding.css';
export const metadata={title:'Paket onayı · Folloopy'};
export default async function Checkout({searchParams}:{searchParams:Promise<{plan?:string;billing?:string}>}){const user=await requireAccount();if(process.env.NODE_ENV==='production'&&!user.email_verified_at&&user.role!=='owner')redirect('/hesap/dogrula');const{plan,billing}=await searchParams;if(!['individual','team','business'].includes(plan||''))redirect('/paketler');return <CheckoutScreen user={user} planId={plan!} purchaseKey={randomUUID()} billing={billing} complimentary={process.env.NODE_ENV==='production'&&process.env.BILLING_MODE==='complimentary'}/>}
