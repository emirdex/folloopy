import {billingPeriod} from '../../../../packages/domain/commercial-plans';
import {redirect} from 'next/navigation';
import {currentAccount} from '../account-api';
import {SignedInEntry} from '../signed-in-entry';
import {AuthScreen} from '../onboarding';
import '../onboarding.css';
export const metadata={title:'Hesap oluştur · Folloopy'};
export default async function Register({searchParams}:{searchParams:Promise<{plan?:string;billing?:string}>}){const {plan,billing}=await searchParams;const preferredPlan=['individual','team'].includes(plan||'')?plan!:'';const user=await currentAccount();if(user&&process.env.NODE_ENV==='production'&&!user.email_verified_at)redirect('/hesap/dogrula');if(user)return <SignedInEntry user={user} mode="register" preferredPlan={preferredPlan} period={billingPeriod(billing)}/>;return <AuthScreen mode="register" preferredPlan={preferredPlan} preferredBilling={billingPeriod(billing)}/> }
