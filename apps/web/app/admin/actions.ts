'use server';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {accountApi,adminApi,requireAdmin} from '../account-api';
import {ownerSetupIssue} from '../../../../packages/domain/owner-setup';
import {PASSWORD_HELP,validNewPassword} from '../../../../packages/domain/password-policy';
export type AdminFormState={error:string;ok?:boolean}|null;
export async function createMember(_state:AdminFormState,form:FormData):Promise<AdminFormState>{
 await requireAdmin();
 const password=String(form.get('password')||'');
 if(!validNewPassword(password))return {error:PASSWORD_HELP};
 if(password!==String(form.get('passwordConfirmation')||''))return {error:'Şifreler eşleşmiyor.'};
 let result:{id:string};
 try{result=await adminApi('/members',{name:String(form.get('name')||'').trim(),email:String(form.get('email')||'').trim(),password,plan:String(form.get('plan')||'')})}
 catch(error){return {error:error instanceof Error&&error.message==='ACCOUNT_EXISTS'?'Bu e-posta adresi zaten kayıtlı. Mevcut hesap değiştirilmedi.':'Üye oluşturulamadı. Bilgileri kontrol edip yeniden deneyin.'}}
 revalidatePath('/admin');
 redirect('/admin?view=members&id='+result.id);
}
export async function setupOwner(_state:AdminFormState,form:FormData):Promise<AdminFormState>{
 const issue=ownerSetupIssue(form);if(issue)return {error:issue.error};
 const token=String(form.get('token')||'').trim(),name=String(form.get('name')||'').trim(),password=String(form.get('password')||'');
 try{const result=await accountApi('/api/admin/setup',{token,name,password});const store=await cookies();store.set('mt_session',result.token,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:7*86400});store.delete('mail_tracking_preview')}
 catch(e){const code=e instanceof Error?e.message:'';return {error:code==='SETUP_CLOSED'?'İlk kurulum zaten tamamlandı. Giriş yapabilirsiniz.':code==='EXISTING_ACCOUNT_PASSWORD_REQUIRED'?'Bu e-posta ile mevcut hesabınız var. Mevcut hesap şifrenizi kullanın.':code==='TOO_MANY_ATTEMPTS'?'Çok fazla deneme. 15 dakika sonra tekrar deneyin.':code==='INVALID_SETUP_TOKEN'?'Kurulum anahtarı doğrulanamadı. Size özel anahtarı kontrol edin.':['PRIVATE_API_UNAVAILABLE','PRIVATE_API_REQUEST_FAILED','TimeoutError','AbortError','fetch failed'].includes(code)?'Sunucuya ulaşılamadı. Kısa süre sonra tekrar deneyin.':'Kurulum tamamlanamadı. Kurulum anahtarını ve bilgilerinizi kontrol edin.'}}
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

export async function loadMemberRecords(id:string,section:'activity'|'messages',offset:number){
 await requireAdmin();
 if(!/^[a-f0-9-]{36}$/.test(id)||!['activity','messages'].includes(section)||!Number.isInteger(offset)||offset<0||offset>100000)throw Error('INVALID_REQUEST');
 return adminApi('/members/'+id+'/'+section+'?offset='+offset);
}
