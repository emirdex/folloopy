'use server';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {accountApi,adminApi,requireAdmin} from '../account-api';
import {validNewPassword,PASSWORD_HELP} from '../../../../packages/domain/password-policy';
export type AdminFormState={error:string;ok?:boolean}|null;
export async function setupOwner(_state:AdminFormState,form:FormData):Promise<AdminFormState>{
 const token=String(form.get('token')||''),name=String(form.get('name')||'').trim(),password=String(form.get('password')||'');
 if(name.length<2||name.length>80)return {error:'Adınızı 2–80 karakter olarak girin.'};
 if(!validNewPassword(password))return {error:PASSWORD_HELP};
 if(password!==String(form.get('confirmation')||''))return {error:'Şifreler eşleşmiyor.'};
 if(token.length<32||token.length>128)return {error:'Geçerli kurulum anahtarı gerekli.'};
 try{const result=await accountApi('/api/admin/setup',{token,name,password});const store=await cookies();store.set('mt_session',result.token,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:7*86400});store.delete('mail_tracking_preview')}
 catch(e){const code=e instanceof Error?e.message:'';return {error:code==='SETUP_CLOSED'?'İlk kurulum zaten tamamlandı. Giriş yapabilirsiniz.':code==='EXISTING_ACCOUNT_PASSWORD_REQUIRED'?'Bu e-posta ile mevcut hesabınız var. Mevcut hesap şifrenizi kullanın.':code==='TOO_MANY_ATTEMPTS'?'Çok fazla deneme. 15 dakika sonra tekrar deneyin.':'Kurulum tamamlanamadı. Kurulum anahtarını ve bilgilerinizi kontrol edin.'}}
 redirect('/admin');
}
export async function savePost(_state:AdminFormState,form:FormData):Promise<AdminFormState>{
 await requireAdmin();
 const id=String(form.get('id')||''),slug=String(form.get('slug')||'').trim();
 const input={coverImage:String(form.get('coverImage')||''),coverAlt:String(form.get('coverAlt')||''),seoTitle:String(form.get('seoTitle')||''),metaDescription:String(form.get('metaDescription')||''),focusKeyword:String(form.get('focusKeyword')||''),...(id?{id,version:Number(form.get('version'))}:{}),slug,title:String(form.get('title')||''),excerpt:String(form.get('excerpt')||''),body:String(form.get('body')||''),category:String(form.get('category')||''),status:String(form.get('status')||'draft')};
 let result:{id:string};
 try{result=await adminApi('/blog',input)}catch(e){const code=e instanceof Error?e.message:'';return {error:code==='SLUG_EXISTS'?'Bu bağlantı adresi başka bir yazıda kullanılıyor.':code==='STALE_POST'?'Bu yazı başka bir sekmede değişti. Sayfayı yenileyip değişiklikleri kontrol edin.':'Yazı kaydedilemedi. Alanları ve bağlantı biçimini kontrol edin.'}}
 revalidatePath('/blog');revalidatePath('/blog/'+slug);revalidatePath('/admin');redirect('/admin?view=blog&id='+result.id+'&saved=1');
}
export async function updateLead(form:FormData){await requireAdmin();await adminApi('/enterprise/'+encodeURIComponent(String(form.get('id'))),{status:String(form.get('status'))});revalidatePath('/admin')}
