'use server';
import {createHash} from 'node:crypto';
import {headers} from 'next/headers';
import {deliverContact,validateContact} from '../../lib/contact-mail';
export type ContactState={ok:boolean;error:string}|null;
const attempts=new Map<string,{count:number;expires:number}>();
export async function sendContact(_previous:ContactState,form:FormData):Promise<ContactState>{
 const read=(key:string)=>typeof form.get(key)==='string'?String(form.get(key)).trim():'';
 if(read('website'))return {ok:false,error:'Mesajınız gönderilemedi. Lütfen tekrar deneyin.'};
 const input={name:read('name'),email:read('email'),subject:read('subject'),message:read('message')};
 const error=validateContact(input);if(error)return {ok:false,error};
 const apiKey=process.env.RESEND_API_KEY||'',from=process.env.MAIL_FROM||'';
 if(!apiKey||!from)return {ok:false,error:'Mesajınız şu anda gönderilemiyor. Lütfen info@folloopy.com adresine e-posta gönderin.'};
 const requestHeaders=await headers();
 const ip=requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim()||requestHeaders.get('x-real-ip')||'unknown';
 const key=createHash('sha256').update(ip).digest('hex'),now=Date.now();
 for(const [id,value] of attempts)if(value.expires<=now)attempts.delete(id);
 const current=attempts.get(key)||{count:0,expires:now+15*60*1000};
 if(current.count>=5||(!attempts.has(key)&&attempts.size>=10000))return {ok:false,error:'Çok fazla mesaj denemesi yapıldı. Lütfen 15 dakika sonra tekrar deneyin.'};
 current.count++;attempts.set(key,current);
 try{await deliverContact(input,{apiKey,from});return {ok:true,error:''}}
 catch{return {ok:false,error:'Gönderim onayı alınamadı. Lütfen daha sonra tekrar deneyin veya info@folloopy.com adresine yazın.'}}
}
