'use server';
import {billingProfile} from '../../../packages/domain/billing-profile';
import {billingPeriod} from '../../../packages/domain/commercial-plans';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {accountApi,requireAccount,requireVerifiedAccount} from './account-api';
import {validNewPassword,PASSWORD_HELP} from '../../../packages/domain/password-policy';
export type FormState={error:string}|null;
const errors:Record<string,string>={ACCOUNT_EXISTS:'Bu e-posta ile bir hesap zaten var. Giriş yapabilirsiniz.',INVALID_LOGIN:'E-posta veya şifre hatalı.',TOO_MANY_ATTEMPTS:'Çok fazla deneme yapıldı. Lütfen 15 dakika sonra yeniden deneyin.'};
async function authenticate(form:FormData,register:boolean):Promise<FormState>{
 const email=String(form.get('email')||'').trim(),password=String(form.get('password')||''),name=String(form.get('name')||'').trim();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return {error:'Geçerli bir e-posta adresi girin.'};
 if(register&&!validNewPassword(password))return {error:PASSWORD_HELP};
 if(!password||password.length>128)return {error:'Şifrenizi girin (en fazla 128 karakter).'};
 if(register&&(name.length<2||name.length>80))return {error:'Adınızı 2–80 karakter olarak girin.'};
 try{
  const result=await accountApi(register?'/api/auth/register':'/api/auth/login',{email,password,...(register?{name}:{})});
  const store=await cookies();store.set('mt_session',result.token,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:7*24*60*60});store.delete('mail_tracking_preview');
 }catch(e){return {error:errors[e instanceof Error?e.message:'']||'Şu anda işlem tamamlanamadı. Lütfen tekrar deneyin.'}}
 const preferredPlan=String(form.get('preferredPlan')||'');
 const user=await requireAccount();if(process.env.NODE_ENV==='production'&&!user.email_verified_at)redirect('/hesap/dogrula'+(['individual','team'].includes(preferredPlan)?'?plan='+preferredPlan:''));redirect(user.role==='owner'?'/admin':['individual','team','business'].includes(preferredPlan)?'/paketler?plan='+preferredPlan+'&billing='+billingPeriod(form.get('billing')):user.plan?'/panel':'/paketler');
}
export async function registerAccount(_state:FormState,form:FormData){return authenticate(form,true)}
export async function loginAccount(_state:FormState,form:FormData){return authenticate(form,false)}
async function closeAccountSession(){await accountApi('/api/auth/logout',{});const store=await cookies();store.delete('mt_session');store.delete('mail_tracking_preview')}
export async function logoutAccount(){await closeAccountSession();redirect('/')}
export async function leaveVerification(){await closeAccountSession();redirect('/giris')}
export async function completePurchase(_state:FormState,form:FormData):Promise<FormState>{
 await requireVerifiedAccount();
 const production=process.env.NODE_ENV==='production';
 if(production&&process.env.BILLING_MODE!=='complimentary')return {error:'Paket aktivasyonu şu anda kullanılamıyor. Lütfen info@folloopy.com ile iletişime geçin.'};
 const plan=String(form.get('plan'));
 if(!['individual','team'].includes(plan))return {error:'Geçerli bir paket seçin.'};
 if(form.get('deferInvoice')!=='on'){
  try{const profile=billingProfile(Object.fromEntries(['kind','name','email','city','district','address','postalCode','companyName','taxOffice','taxNumber'].map(key=>[key,String(form.get(key)||'')])));await accountApi('/api/account/billing',profile)}catch{return {error:'Fatura bilgilerinizi kontrol edin. Şirket için 10 haneli vergi numarası, adres ve iletişim bilgileri gereklidir.'}}
 }
 try{await accountApi(production?'/api/access/activate':'/api/purchase-preview',production?{plan}:{plan,idempotencyKey:String(form.get('purchaseKey')||'')})}catch{return {error:'Paketiniz etkinleştirilemedi. Tekrar deneyin.'}}
 redirect('/odeme/tamamlandi');
}
