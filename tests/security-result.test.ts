import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {SecurityResult} from '../apps/web/app/security-result';
test('Completed password reset replaces the edit heading with success and one clear login action',()=>{
 const html=renderToStaticMarkup(createElement(SecurityResult,{mode:'reset',message:'Yeni şifrenizle hesabınıza güvenle giriş yapabilirsiniz.'}));
 assert.ok(html.includes('Şifreniz Değiştirildi.'));assert.ok(!html.includes('Yeni şifrenizi belirleyin.'));assert.ok(!html.includes('Giriş Ekranına Dön'));assert.equal((html.match(/href="\/giris"/g)||[]).length,1);assert.ok(html.includes('role="status"'));assert.ok(html.includes('security-complete-action'));
});
test('Security request and verification completion keep their own destination and success heading',()=>{
 const request=renderToStaticMarkup(createElement(SecurityResult,{mode:'request',message:'Adresiniz kayıtlıysa bağlantı gönderildi.'}));const verify=renderToStaticMarkup(createElement(SecurityResult,{mode:'verify',message:'Adresiniz doğrulandı.'}));
 assert.ok(request.includes('Bağlantınız Hazır.'));assert.ok(request.includes('href="/giris"'));assert.ok(verify.includes('E-Postanız Doğrulandı.'));assert.ok(verify.includes('href="/paketler"'));
});
