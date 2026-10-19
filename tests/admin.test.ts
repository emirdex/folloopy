import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ArticleBody} from '../apps/web/app/blog-content';
import {openDatabase,migrate} from '../packages/database/index';
import {FakeProvider} from '../packages/provider-adapters/index';
import {buildServer} from '../apps/api/server';
const key='admin-test-key-with-more-than-32-characters';
const config={email:'owner@example.invalid',token:'one-time-owner-bootstrap-key-at-least-32-characters'};
const password='Only-synthetic-test-password-2026';
async function setup(){const db=await openDatabase();await migrate(db);const server=buildServer(db,new FakeProvider(),key,'http://localhost:4000',config);const call=(url:string,payload?:Record<string,unknown>,token?:string)=>server.app.inject({method:payload===undefined?'GET':'POST',url,headers:{authorization:'Bearer '+key,...(token?{'x-user-session':token}:{})},...(payload===undefined?{}:{payload})});return {db,...server,call}}
async function owner(call:Awaited<ReturnType<typeof setup>>['call']){const result=await call('/api/admin/setup',{name:'Site sahibi',token:config.token,password});assert.equal(result.statusCode,200,result.body);return result.json().token as string}
test('Admin e-postasıyla normal kayıt yetki vermez; kurulum token ve mevcut şifre gerektirir',async()=>{
 const{db,app,call}=await setup();try{
  const normal=await call('/api/auth/register',{name:'Üye',email:config.email,password});const token=normal.json().token;
  assert.equal((await call('/api/auth/me',undefined,token)).json().user.role,'member');
  assert.equal((await call('/api/admin/members',undefined,token)).statusCode,403);
  assert.equal((await call('/api/admin/setup',{name:'Site sahibi',token:'x'.repeat(43),password})).statusCode,403);
  assert.equal((await call('/api/admin/setup',{name:'Site sahibi',token:config.token,password:'Wrong-long-password-2026'})).statusCode,401);
  const setupResult=await call('/api/admin/setup',{name:'Site sahibi',token:config.token,password});assert.equal(setupResult.statusCode,200,setupResult.body);
  assert.equal((await call('/api/auth/me',undefined,setupResult.json().token)).json().user.role,'owner');
  assert.equal((await call('/api/auth/me',undefined,token)).statusCode,401);
  assert.equal((await call('/api/admin/setup',{name:'Site sahibi',token:config.token,password})).statusCode,409);
  assert.equal((await db.query("SELECT id FROM users WHERE role='owner'")).rows.length,1);
  assert.equal((await call('/api/admin/setup-status')).json().available,false);
 }finally{await app.close();await db.close()}
});
test('Üye ve anonim erişim bütün admin veri ve mutasyon uçlarında reddedilir',async()=>{
 const{db,app,call}=await setup();try{
  const admin=await owner(call);const member=(await call('/api/auth/register',{name:'Normal üye',email:'member@example.invalid',password})).json().token;
  const id=randomUUID();const endpoints=[['/api/admin/overview',undefined],['/api/admin/members',undefined],['/api/admin/members/'+id,undefined],['/api/admin/purchases',undefined],['/api/admin/purchases/'+id,undefined],['/api/admin/enterprise',undefined],['/api/admin/blog',undefined],['/api/admin/blog/'+id,undefined],['/api/admin/blog',{}],['/api/admin/enterprise/'+id,{status:'closed'}]] as const;
  for(const[url,body]of endpoints){assert.equal((await call(url,body,member)).statusCode,403,url);assert.equal((await call(url,body)).statusCode,401,url)}
  const members=await call('/api/admin/members',undefined,admin);assert.equal(members.statusCode,200);assert.equal(members.json().total,2);assert.ok(!members.body.includes('password_hash'));assert.ok(!members.body.includes('token_hash'));
  assert.equal((await call('/api/auth/register',{name:'Hile',email:'other@example.invalid',password,role:'owner'})).statusCode,400);
 }finally{await app.close();await db.close()}
});
test('Satın alma defteri kalıcı, tekrar güvenli ve simülasyon olarak kayıtlıdır',async()=>{
 const{db,app,call}=await setup();try{
  const admin=await owner(call);const member=(await call('/api/auth/register',{name:'Müşteri',email:'customer@example.invalid',password})).json().token;
  const idempotencyKey=randomUUID();
  assert.equal((await call('/api/purchase-preview',{plan:'team',idempotencyKey},member)).statusCode,200);
  assert.equal((await call('/api/purchase-preview',{plan:'team',idempotencyKey},member)).statusCode,200);
  assert.equal((await call('/api/purchase-preview',{plan:'individual',idempotencyKey},member)).statusCode,409);
  const ledger=(await call('/api/admin/purchases',undefined,admin)).json();assert.equal(ledger.total,1);const purchase=ledger.rows[0];assert.equal(purchase.mode,'simulation');assert.equal(purchase.status,'simulated');assert.equal(Number(purchase.amount_minor),0);assert.equal(purchase.provider_reference,null);assert.equal(purchase.message_limit,500);
  const detail=(await call('/api/admin/purchases/'+purchase.id,undefined,admin)).json();assert.equal(detail.email,'customer@example.invalid');assert.equal(detail.idempotency_key,idempotencyKey);
  const user=(await call('/api/admin/members/'+purchase.user_id,undefined,admin)).json();assert.equal(user.purchases.length,1);assert.equal(user.user.plan,'team');assert.equal(user.user.password_hash,undefined);
 }finally{await app.close();await db.close()}
});
test('Blog taslak/yayın/arşiv sınırı, sürüm çakışması ve güvenli içerik',async()=>{
 const{db,app,call}=await setup();try{
  const admin=await owner(call);const input={slug:'ornek-blog-yazisi',title:'Örnek blog yazısı',excerpt:'Güvenli bir yazı için kısa açıklama.',body:'## İlk bölüm\n\n<script>alert("x")</script> Bu içerik HTML olarak çalıştırılmamalıdır.',category:'Ürün rehberi',status:'draft'};
  const first=await call('/api/admin/blog',input,admin);assert.equal(first.statusCode,200,first.body);const id=first.json().id;
  assert.equal((await app.inject({url:'/public/blog/'+input.slug})).statusCode,404);
  assert.equal((await app.inject({url:'/public/blog'})).json().total,0);
  assert.equal((await call('/api/admin/blog',{...input,id,version:1,status:'published'},admin)).statusCode,200);
  const publicPost=await app.inject({url:'/public/blog/'+input.slug});assert.equal(publicPost.statusCode,200);assert.equal(publicPost.json().author_id,undefined);
  assert.equal((await call('/api/admin/blog',{...input,id,version:1,status:'published'},admin)).statusCode,409);
  assert.equal((await call('/api/admin/blog',input,admin)).statusCode,409);
  const html=renderToStaticMarkup(createElement(ArticleBody,{body:input.body}));assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));
  assert.equal((await call('/api/admin/blog',{...input,id,version:2,status:'archived'},admin)).statusCode,200);
  assert.equal((await app.inject({url:'/public/blog/'+input.slug})).statusCode,404);
  assert.equal((await app.inject({url:'/public/blog'})).json().total,0);
  assert.equal((await db.query("SELECT * FROM admin_audit WHERE action LIKE 'blog_%'")).rows.length,3);
 }finally{await app.close();await db.close()}
});
test('Enterprise talebi yalnızca admin tarafından durumlandırılır',async()=>{
 const{db,app,call}=await setup();try{
  const admin=await owner(call);await call('/api/enterprise-requests',{email:'sales@example.invalid',company:'Örnek şirket'});
  const lead=(await call('/api/admin/enterprise',undefined,admin)).json().rows[0];assert.equal(lead.status,'new');
  assert.equal((await call('/api/admin/enterprise/'+lead.id,{status:'contacted'},admin)).statusCode,200);
  assert.equal((await call('/api/admin/enterprise',undefined,admin)).json().rows[0].status,'contacted');
 }finally{await app.close();await db.close()}
});

test('Blog kapak ve SEO alanları kaydolur; güvenli olmayan görseller reddedilir',async()=>{
 const{db,app,call}=await setup();try{
  const admin=await owner(call),image='/blog/media/'+randomUUID()+'.png';
  const input={slug:'gorselli-blog',title:'E-posta takip rehberi',excerpt:'Mail açılmaları için detaylı rehber.',body:'## E-posta takibi\n\nE-posta açılmaları ve içerik hareketlerini inceleyin.',category:'Ürün rehberi',status:'published',coverImage:image,coverAlt:'Mail takibi ekranı',seoTitle:'E-posta takip rehberi ve kullanım önerileri',metaDescription:'E-postalarınızın açılma zamanlarını ve tekrar açılma hareketlerini takip etmeyi öğrenin.',focusKeyword:'e-posta takibi'};
  const saved=await call('/api/admin/blog',input,admin);assert.equal(saved.statusCode,200,saved.body);
  const row=(await app.inject({url:'/public/blog/gorselli-blog'})).json();assert.equal(row.cover_image,image);assert.equal(row.meta_description,input.metaDescription);assert.equal(row.seo_title,input.seoTitle);assert.equal(row.focus_keyword,input.focusKeyword);
  assert.equal((await call('/api/admin/blog',{...input,slug:'unsafe-cover',coverImage:'https://example.invalid/image.svg'},admin)).statusCode,400);
  const markup=renderToStaticMarkup(createElement(ArticleBody,{body:'!['+input.coverAlt+']('+image+')\n\n**Kalın metin** ve [bağlantı](https://example.com)\n\n![sakıncalı](javascript:alert(1))'}));
  assert.ok(markup.includes('alt="Mail takibi ekranı"'));assert.ok(markup.includes('<figure>'));assert.ok(markup.includes('<strong>Kalın metin</strong>'));assert.ok(!markup.includes('src="javascript:'));
 }finally{await app.close();await db.close()}
});
