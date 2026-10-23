import test from 'node:test';
import assert from 'node:assert/strict';
import {deliverContact,validateContact} from '../apps/web/lib/contact-mail';
const message={kvkkAcknowledged:true,firstName:'Örnek',lastName:'Kullanıcı',phone:'5321234567',email:'visitor@example.com',subject:'Paket bilgisi',message:'Paketler hakkında bilgi almak istiyorum.'};
test('İletişim formu geçersiz adres, başlık enjeksiyonu ve aşırı uzun mesajı reddeder',()=>{
 assert.equal(validateContact(message),null);
 for(const value of [{...message,email:'a@b.com\nBcc: hidden@example.com'},{...message,subject:'Başlık\r\nBcc: hidden@example.com'},{...message,firstName:''},{...message,lastName:'\r\nBcc: hidden@example.com'},{...message,message:'x'.repeat(5001)}])assert.ok(validateContact(value));
});
test('İletişim e-postası sabit kurumsal alıcıya gider; ziyaretçi yalnızca yanıt adresidir',async()=>{
 let calls=0;
 const request:typeof fetch=async(url,options)=>{calls++;assert.equal(url,'https://api.resend.com/emails');const payload=JSON.parse(String(options?.body));assert.deepEqual(payload.to,['info@folloopy.com']);assert.equal(payload.reply_to,message.email);assert.equal(payload.from,'Folloopy <info@folloopy.com>');assert.ok(payload.text.includes(message.message));assert.ok(payload.text.includes('Örnek Kullanıcı'));assert.ok(payload.text.includes('Telefon: +90 5321234567'));assert.ok(payload.text.includes('KVKK aydınlatma: Okudum ve bilgilendirildim'));assert.ok(payload.html.includes('KVKK AYDINLATMA'));assert.ok(payload.html.includes('+90 5321234567'));assert.ok(payload.html.includes('İLETİŞİM MERKEZİ'));assert.ok(payload.html.includes(message.message));assert.ok(!payload.html.includes('bu güvenli bağlantıyı'));assert.ok(new Headers(options?.headers).get('Idempotency-Key'));return new Response(JSON.stringify({id:'message-id'}),{status:200})};
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

test('İletişim telefonu sunucuda sıfırla başlayan, eksik, uzun ve rakam dışı numaraları reddeder',async()=>{
 let calls=0;const request:typeof fetch=async()=>{calls++;throw Error('Unexpected request')};
 for(const phone of ['', '0321234567','05321234567','532123456','53212345678','+905321234567','532 1234567','532123456a','5321234567\nBcc: x@example.com']){
  const invalid={...message,phone};assert.ok(validateContact(invalid),phone);
  await assert.rejects(deliverContact(invalid,{apiKey:'test',from:'info@folloopy.com'},request),/INVALID_CONTACT/);
 }
 assert.equal(calls,0);
 for(const invalid of [{...message,lastName:''},{...message,firstName:'x'.repeat(51)},{...message,lastName:'x'.repeat(51)}])assert.ok(validateContact(invalid));
});

test('KVKK acknowledgement is explicit and required before any contact mail is delivered',async()=>{
 let calls=0;const request:typeof fetch=async()=>{calls++;throw Error('Unexpected request')};
 for(const value of [undefined,null,false,'true','on',1]){
  const invalid={...message,kvkkAcknowledged:value} as unknown as Parameters<typeof validateContact>[0];
  assert.match(validateContact(invalid)||'',/KVKK/);
  await assert.rejects(deliverContact(invalid,{apiKey:'test',from:'info@folloopy.com'},request),/INVALID_CONTACT/);
 }
 assert.equal(calls,0);
});
