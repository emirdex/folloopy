'use server';
import {revalidatePath} from 'next/cache';
import {accountApi,requirePanel} from '../account-api';
import type {MailDraft,DraftFormState} from '../../../../packages/domain/mail-drafts';
const errors:Record<string,string>={DRAFT_LIMIT_REACHED:'Taslak sınırınıza ulaştınız. Mevcut taslağınızı düzenleyin veya yer açmak için bir taslağı silin.',DRAFT_PLAN_LIMIT:'Bu taslak mevcut paketinizin sınırı dışında. Kullanmak için paketinizi yükseltebilirsiniz.',STALE_DRAFT:'Taslak başka bir ekranda değiştirildi. Güncel halini açıp yeniden deneyin.',NOT_FOUND:'Taslak bulunamadı. Silinmiş olabilir.',INVALID_DRAFT:'Taslak adı, konu ve alıcı bilgilerini kontrol edin.',TOO_MANY_ATTEMPTS:'Çok sık işlem yaptınız. Biraz bekleyip yeniden deneyin.'};
function errorMessage(error:unknown){return errors[error instanceof Error?error.message:'']||'Taslak işlemi tamamlanamadı. Yeniden deneyin.'}
export async function saveMailDraft(_state:DraftFormState,form:FormData):Promise<DraftFormState>{
 await requirePanel();
 const id=String(form.get('draftId')||''),version=Number(form.get('draftVersion'));
 if(id&&!/^[a-f0-9-]{36}$/.test(id))return {error:'Taslak bilgisi geçersiz.'};
 const draftTitle=String(form.get('draftTitle')||'').trim()||String(form.get('subject')||'').trim().slice(0,80)||'Adsız taslak';
 const input={title:draftTitle,subject:String(form.get('subject')||''),to:String(form.get('to')||'').trim(),text:String(form.get('text')||''),tracking:form.get('tracking')==='on'};
 try{const saved=await accountApi('/api/drafts'+(id?'/'+id:''),{...input,...(id?{version}:{})}) as MailDraft;revalidatePath('/panel');return {success:'Taslağınız kaydedildi.',id:saved.id,version:saved.version}}catch(error){return {error:errorMessage(error),...(id?{id,version}:{})}}
}
export async function deleteMailDraft(_state:DraftFormState,form:FormData):Promise<DraftFormState>{
 await requirePanel();const id=String(form.get('id')||''),version=Number(form.get('version'));
 if(!/^[a-f0-9-]{36}$/.test(id))return {error:'Taslak bilgisi geçersiz.'};
 try{await accountApi('/api/drafts/'+id+'/delete',{version});revalidatePath('/panel');return {success:'Taslak silindi.'}}catch(error){return {error:errorMessage(error)}}
}
