'use server';
import {ContactThrottle} from '../../lib/contact-throttle';
import {isMarketingMode} from '../../../../packages/runtime/app-mode';
import {internalApiFetch,internalApiUrl,internalApiKey} from '../internal-api';
import {headers} from 'next/headers';
import {deliverContact,validateContact} from '../../lib/contact-mail';
export type ContactState={ok:boolean;error:string}|null;
const throttle=new ContactThrottle();
export async function sendContact(_previous:ContactState,form:FormData):Promise<ContactState>{
 const read=(key:string)=>typeof form.get(key)==='string'?String(form.get(key)).trim():'';
 if(read('website'))return {ok:false,error:'Mesajınız gönderilemedi. Lütfen tekrar deneyin.'};
 const input={firstName:read('firstName'),lastName:read('lastName'),email:read('email'),phone:read('phone'),subject:read('subject'),message:read('message')};
 const error=validateContact(input);if(error)return {ok:false,error};
 const apiKey=process.env.RESEND_API_KEY||'',from=process.env.MAIL_FROM||'';
 if(!apiKey||!from)return {ok:false,error:'Mesajınız şu anda gönderilemiyor. Lütfen info@folloopy.com adresine e-posta gönderin.'};
 const requestHeaders=await headers();
 const ip=requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim()||requestHeaders.get('x-real-ip')||'unknown';
 if(!throttle.allow(input.email,ip))return {ok:false,error:'Çok fazla mesaj denemesi yapıldı. Lütfen 15 dakika sonra tekrar deneyin.'};
 if(process.env.NODE_ENV==='production'&&!isMarketingMode()){
  try{
   const limit=await internalApiFetch(internalApiUrl()+'/api/contact/limit',{method:'POST',headers:{Authorization:'Bearer '+internalApiKey(),'Content-Type':'application/json'},body:JSON.stringify({email:input.email}),cache:'no-store',signal:AbortSignal.timeout(10000)});
   if(limit.status===429)return {ok:false,error:'Çok fazla mesaj denemesi yapıldı. Lütfen 15 dakika sonra tekrar deneyin.'};
   if(!limit.ok)throw Error('CONTACT_LIMIT_UNAVAILABLE');
  }catch{return {ok:false,error:'Mesajınız şu anda gönderilemiyor. Lütfen biraz sonra tekrar deneyin.'}}
 }
 try{await deliverContact(input,{apiKey,from});return {ok:true,error:''}}
 catch{return {ok:false,error:'Gönderim onayı alınamadı. Lütfen daha sonra tekrar deneyin veya info@folloopy.com adresine yazın.'}}
}
