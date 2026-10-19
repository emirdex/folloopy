import {redirect} from 'next/navigation';
import {currentAccount} from '../account-api';
import {AuthScreen} from '../onboarding';
import '../onboarding.css';
export const metadata={title:'Giriş yap · Folloopy'};
export default async function Login({searchParams}:{searchParams:Promise<{plan?:string}>}){const {plan}=await searchParams;const preferredPlan=['individual','team','business'].includes(plan||'')?plan!:'';const user=await currentAccount();if(user)redirect(user.role==='owner'?'/admin':preferredPlan?'/paketler?plan='+preferredPlan:user.plan?'/panel':'/paketler');return <AuthScreen mode="login" preferredPlan={preferredPlan}/> }
