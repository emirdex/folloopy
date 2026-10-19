import {billingPeriod} from '../../../../packages/domain/commercial-plans';
import {redirect} from 'next/navigation';
import {currentAccount} from '../account-api';
import {AuthScreen} from '../onboarding';
import '../onboarding.css';
export const metadata={title:'Hesap oluştur · Folloopy'};
export default async function Register({searchParams}:{searchParams:Promise<{plan?:string;billing?:string}>}){const {plan,billing}=await searchParams;const preferredPlan=['individual','team','business'].includes(plan||'')?plan!:'';const user=await currentAccount();if(user)redirect(user.role==='owner'?'/admin':preferredPlan?'/paketler?plan='+preferredPlan+'&billing='+billingPeriod(billing):user.plan?'/panel':'/paketler');return <AuthScreen mode="register" preferredPlan={preferredPlan} preferredBilling={billingPeriod(billing)}/> }
