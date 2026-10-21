'use server';
import {revalidatePath} from 'next/cache';
import {accountApi,requireAccount} from './account-api';
import {randomUUID} from 'node:crypto';
export type VerificationResult={ok:boolean;message:string;next?:string};
export async function verifyRegistrationCode(form:FormData):Promise<VerificationResult>{
 const user=await requireAccount();
 if(!user.email_verified_at){
  try{
   const token=String(form.get('legacyToken')||'');
   if(token)await accountApi('/api/auth/verify/confirm',{token});
   else await accountApi('/api/auth/verify/code/confirm',{code:String(form.get('code')||'')});
  }catch(error){const code=error instanceof Error?error.message:'';return {ok:false,message:code==='VERIFICATION_LOCKED'?'Çok fazla hatalı kod girildi. Yeni bir kod isteyin.':code==='TOO_MANY_ATTEMPTS'?'Çok fazla deneme yapıldı. Biraz sonra yeniden deneyin.':'Kod geçersiz veya süresi dolmuş. E-postanızdaki son kodu kontrol edin.'}}
 }
 let next='/panel';
 if(!user.plan){
  const preferred=String(form.get('preferredPlan')||''),plan=['individual','team'].includes(preferred)?preferred:'individual';
  try{
   if(process.env.NODE_ENV==='production'){
    if(process.env.BILLING_MODE==='complimentary')await accountApi('/api/access/activate',{plan});
    else next='/paketler';
   }else await accountApi('/api/purchase-preview',{plan,idempotencyKey:randomUUID()});
  }catch{next='/paketler'}
 }
 revalidatePath('/panel');return {ok:true,message:'Hesabınız başarıyla onaylanmıştır.',next};
}
export async function resendRegistrationCode(){
 await requireAccount();
 try{await accountApi('/api/auth/verify/code/request',{});return {ok:true,message:'Yeni doğrulama kodu kayıtlı e-posta adresinize gönderildi.',resendAfter:60}}
 catch(error){const code=error instanceof Error?error.message:'';return {ok:false,message:code==='VERIFICATION_COOLDOWN'?'Yeni bir kod istemeden önce bir dakika bekleyin.':'Kod gönderilemedi. Biraz sonra yeniden deneyin.',resendAfter:code==='VERIFICATION_COOLDOWN'?60:0}}
}
