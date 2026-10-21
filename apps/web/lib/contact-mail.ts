import {serviceEmailHtml} from '../../../packages/domain/security-email';
import {randomUUID} from 'node:crypto';

export type ContactMessage={name:string;email:string;subject:string;message:string};
export function validateContact(input:ContactMessage):string|null{
 if(input.name.length<2||input.name.length>100||/[\r\n]/.test(input.name))return 'Adınızı 2–100 karakter olarak girin.';
 if(input.email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email))return 'Geçerli bir e-posta adresi girin.';
 if(input.subject.length<3||input.subject.length>160||/[\r\n]/.test(input.subject))return 'Konuyu 3–160 karakter olarak girin.';
 if(input.message.length<10||input.message.length>5000)return 'Mesajınızı 10–5000 karakter olarak girin.';
 return null;
}
export async function deliverContact(input:ContactMessage,options:{apiKey:string;from:string},request:typeof fetch=fetch){
 const error=validateContact(input);if(error)throw new Error('INVALID_CONTACT');
 if(!options.apiKey||!options.from||/[\r\n]/.test(options.from))throw new Error('CONTACT_MAIL_NOT_CONFIGURED');
 const response=await request('https://api.resend.com/emails',{
  method:'POST',signal:AbortSignal.timeout(15000),
  headers:{Authorization:'Bearer '+options.apiKey,'Content-Type':'application/json','Idempotency-Key':randomUUID()},
  body:JSON.stringify({from:options.from,to:['info@folloopy.com'],reply_to:input.email,subject:'Folloopy iletişim · '+input.subject,html:serviceEmailHtml({title:'Yeni Bir Mesajınız Var.',description:'Folloopy iletişim formundan yeni bir talep alındı.',category:'İLETİŞİM MERKEZİ',preheader:'İletişim formundan yeni bir mesajınız var.',details:[{label:'GÖNDEREN',value:input.name},{label:'E-POSTA',value:input.email},{label:'KONU',value:input.subject}],body:input.message,actionUrl:'https://folloopy.com/iletisim',actionLabel:'',validity:'',hideAction:true,notice:'Bu e-postayı yanıtlayarak doğrudan gönderene ulaşabilirsiniz.'}),text:`Ad soyad: ${input.name}\nE-posta: ${input.email}\nKonu: ${input.subject}\n\n${input.message}`})
 });
 if(!response.ok)throw new Error('CONTACT_MAIL_FAILED');
 const result=await response.json();if(!result?.id)throw new Error('CONTACT_MAIL_FAILED');
}
