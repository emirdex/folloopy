import {isMarketingMode} from '../../../packages/runtime/app-mode';
import {internalApiFetch,internalApiUrl,internalApiKey} from './internal-api';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
export type Account={id:string;workspace_id:string;name:string;email:string;plan:'individual'|'team'|'business'|null;role:'member'|'owner';email_verified_at?:string|null};
export async function accountApi(path:string,body?:unknown){
 const publicDeployment=process.env.DEPLOYMENT_ROLE==='public';
 if(publicDeployment&&path!=='/api/enterprise-requests')throw Error('ACCOUNT_HOST_REQUIRED');
 const token=publicDeployment?undefined:(await cookies()).get('mt_session')?.value;
 if(isMarketingMode())throw new Error('APPLICATION_UNAVAILABLE');
 const response=await internalApiFetch(internalApiUrl()+path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+internalApiKey(),...(token?{'x-user-session':token}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),cache:'no-store',signal:AbortSignal.timeout(20000)});
 const data=await response.json();
 if(!response.ok)throw new Error(data.code||'SERVICE_ERROR');
 return data;
}
export async function currentAccount():Promise<Account|null>{
 const store=await cookies();
 if(isMarketingMode()||process.env.DEPLOYMENT_ROLE==='public')return null;
 if(!store.has('mt_session'))return null;
 try{return (await accountApi('/api/auth/me')).user}catch(e){if(e instanceof Error&&e.message==='UNAUTHORIZED')return null;throw e}
}
export async function requireAccount(){const user=await currentAccount();if(!user)redirect('/giris');return user}
export async function requireVerifiedAccount(){const user=await requireAccount();if(process.env.NODE_ENV==='production'&&!user.email_verified_at)redirect('/hesap/dogrula');return user}
export async function requirePanel(){
 const user=await currentAccount();
 if(user){if(process.env.NODE_ENV==='production'&&!user.email_verified_at)redirect('/hesap/dogrula');if(!user.plan)redirect('/paketler');return user}
 if(process.env.NODE_ENV!=='production'&&(await cookies()).get('mail_tracking_preview')?.value==='active')return null;
 redirect('/giris');
}

export async function requireAdmin(){const user=await requireVerifiedAccount();if(user.role!=='owner')redirect('/admin/erisim');return user}
export async function adminApi(path:string,body?:unknown){await requireAdmin();return accountApi('/api/admin'+path,body)}
