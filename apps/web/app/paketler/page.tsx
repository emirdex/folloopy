import {redirect} from 'next/navigation';
import {requireAccount} from '../account-api';
import {PlansScreen} from '../onboarding';
import '../onboarding.css';
export const metadata={title:'Paket seçimi · Folloopy'};
export default async function Plans({searchParams}:{searchParams:Promise<{plan?:string}>}){const {plan}=await searchParams;const user=await requireAccount();if(process.env.NODE_ENV==='production'&&!user.email_verified_at&&user.role!=='owner')redirect('/hesap/dogrula');return <PlansScreen user={user} initialPlan={plan}/>}
