'use server';
import {accountApi} from '../../account-api';
export type EmailConfirmationState={ok:boolean;completed?:boolean;message:string}|null;
export async function confirmEmailChange(_state:EmailConfirmationState,form:FormData):Promise<EmailConfirmationState>{
 try{const result=await accountApi('/api/account/email/confirm',{token:String(form.get('token')||'')});return {ok:true,completed:result.completed,message:result.completed?'E-posta adresiniz güncellendi. Yeni e-posta adresinizle giriş yapabilirsiniz.':'Bu adresin onayı alındı. Değişikliği tamamlamak için diğer e-posta adresinize gelen bağlantıyı da onaylayın.'}}
 catch(e){return {ok:false,message:e instanceof Error&&e.message==='EMAIL_IN_USE'?'Yeni e-posta adresi artık kullanılıyor. Hesap Detayları sayfasından başka bir adresle yeniden deneyin.':'Bağlantı geçersiz, daha önce kullanılmış veya süresi dolmuş. Hesap Detayları sayfasından yeniden talep oluşturabilirsiniz.'}}
}
