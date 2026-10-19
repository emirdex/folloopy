import test from 'node:test';
import assert from 'node:assert/strict';
import {deliverContact,validateContact} from '../apps/web/lib/contact-mail';
const message={name:'Örnek Kullanıcı',email:'visitor@example.com',subject:'Paket bilgisi',message:'Paketler hakkında bilgi almak istiyorum.'};
test('İletişim formu geçersiz adres, başlık enjeksiyonu ve aşırı uzun mesajı reddeder',()=>{
 assert.equal(validateContact(message),null);
 for(const value of [{...message,email:'a@b.com\nBcc: hidden@example.com'},{...message,subject:'Başlık\r\nBcc: hidden@example.com'},{...message,name:'A'},{...message,message:'x'.repeat(5001)}])assert.ok(validateContact(value));
});
test('İletişim e-postası sabit kurumsal alıcıya gider; ziyaretçi yalnızca yanıt adresidir',async()=>{
 let calls=0;
 const request:typeof fetch=async(url,options)=>{calls++;assert.equal(url,'https://api.resend.com/emails');const payload=JSON.parse(String(options?.body));assert.deepEqual(payload.to,['info@folloopy.com']);assert.equal(payload.reply_to,message.email);assert.equal(payload.from,'Folloopy <info@folloopy.com>');assert.ok(payload.text.includes(message.message));assert.equal(payload.html,undefined);assert.ok(new Headers(options?.headers).get('Idempotency-Key'));return new Response(JSON.stringify({id:'message-id'}),{status:200})};
 await deliverContact(message,{apiKey:'test-key',from:'Folloopy <info@folloopy.com>'},request);assert.equal(calls,1);
});
test('Yapılandırma eksikse iletişim gönderimi dış servise ulaşmaz',async()=>{
 let calls=0;const request:typeof fetch=async()=>{calls++;throw Error('Unexpected request')};
 await assert.rejects(deliverContact(message,{apiKey:'',from:''},request),/NOT_CONFIGURED/);assert.equal(calls,0);
});
test('Sağlayıcı ret veya eksik onay döndürürse başarı bildirilmez',async()=>{
 for(const response of [new Response('{}',{status:429}),new Response('{}',{status:200})]){
  await assert.rejects(deliverContact(message,{apiKey:'test',from:'info@folloopy.com'},async()=>response),/MAIL_FAILED/);
 }
});
