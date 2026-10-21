import {redirect} from 'next/navigation';
import {requireAccount,accountApi} from '../../account-api';
import {VerificationScreen} from '../../verification-screen';
import '../../onboarding.css';
export const metadata={title:'E-posta doğrulama · Folloopy',robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<{plan?:string}>}){
 const user=await requireAccount();if(user.email_verified_at)redirect(user.plan?'/panel':'/paketler');
 const {plan}=await searchParams;
 const status=await accountApi('/api/auth/verify/code/status').catch(()=>({hasCode:true,resendAfter:0}));
 if(!status.hasCode&&status.resendAfter===0){try{await accountApi('/api/auth/verify/code/request',{});status.resendAfter=60}catch{/* Resend remains available for a retry. */}}
 return <VerificationScreen email={user.email} preferredPlan={['individual','team'].includes(plan||'')?plan:undefined} resendAfter={status.resendAfter}/>;
}
