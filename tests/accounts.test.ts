import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase,migrate} from '../packages/database/index';
import {FakeProvider} from '../packages/provider-adapters/index';
import {buildServer} from '../apps/api/server';
import {seedLocal} from '../apps/api/service';
const key='account-test-at-least-32-characters-long';
const credentials={name:'Test Kullanıcı',email:'account@example.invalid',password:'Test-synthetic-password-2026'};
async function setup(){const db=await openDatabase();await migrate(db);await migrate(db);await seedLocal(db);return {db,...buildServer(db,new FakeProvider(),key,'http://127.0.0.1:4000')}}
test('Kalıcı hesap, hash, doğrulama, paket kapısı, oturum iptali ve süre',async()=>{
 const{db,app}=await setup();const base={authorization:'Bearer '+key};
 const call=(url:string,payload?:Record<string,unknown>,token?:string)=>app.inject({method:payload===undefined?'GET':'POST',url,headers:{...base,...(token?{'x-user-session':token}:{})},...(payload===undefined?{}:{payload})});
 try{
  assert.equal((await call('/api/auth/register',{...credentials,password:'short'})).statusCode,400);
  assert.equal((await call('/api/auth/register',{...credentials,email:'bad email'})).statusCode,400);
  const registration=await call('/api/auth/register',credentials);assert.equal(registration.statusCode,200);const token=registration.json().token;
  const row=(await db.query<{password_hash:string}>('SELECT password_hash FROM users')).rows[0];assert.ok(!row.password_hash.includes(credentials.password));
  assert.equal((await call('/api/auth/register',credentials)).statusCode,409);
  assert.equal((await call('/api/auth/login',{email:credentials.email,password:'wrong-but-long-password'})).statusCode,401);
  assert.equal((await call('/api/auth/me',undefined,'x'.repeat(43))).statusCode,401);
  const me=(await call('/api/auth/me',undefined,token)).json().user;assert.equal(me.plan,null);assert.equal(me.password_hash,undefined);
  assert.equal((await call('/api/messages',undefined,token)).statusCode,402);
  assert.equal((await call('/api/purchase-preview',{plan:'untrusted'},token)).statusCode,400);
  assert.equal((await call('/api/purchase-preview',{plan:'team'},token)).statusCode,200);
  assert.equal((await call('/api/auth/me',undefined,token)).json().user.plan,'team');
  assert.equal((await call('/api/purchase-preview',{plan:'team'},token)).statusCode,200);
  assert.equal((await db.query('SELECT * FROM preview_purchases')).rows.length,1);
  const login=await call('/api/auth/login',{email:credentials.email.toUpperCase(),password:credentials.password});assert.equal(login.statusCode,200);
  await call('/api/auth/logout',{},token);assert.equal((await call('/api/auth/me',undefined,token)).statusCode,401);
  await db.query("UPDATE sessions SET expires_at=now()-interval '1 day'");assert.equal((await call('/api/auth/me',undefined,login.json().token)).statusCode,401);
 }finally{await app.close();await db.close()}
});
test('İki kayıtlı hesabın mail listesi, ayrıntısı ve stop erişimi ayrıdır',async()=>{
 const{db,app}=await setup();const base={authorization:'Bearer '+key};
 const call=(token:string,url:string,payload?:Record<string,unknown>)=>app.inject({method:payload===undefined?'GET':'POST',url,headers:{...base,'x-user-session':token,'idempotency-key':'account-submission-0001'},...(payload===undefined?{}:{payload})});
 try{
  const a=(await app.inject({method:'POST',url:'/api/auth/register',headers:base,payload:credentials})).json().token;
  const b=(await app.inject({method:'POST',url:'/api/auth/register',headers:base,payload:{...credentials,email:'other@example.invalid'}})).json().token;
  for(const t of [a,b])await call(t,'/api/purchase-preview',{plan:'individual'});
  const sent=await call(a,'/api/test-submissions',{subject:'Özel test',text:'Sadece A',to:'recipient@example.invalid',tracking:true});assert.equal(sent.statusCode,200);const id=sent.json().id;
  assert.equal((await call(a,'/api/messages')).json().messages.length,1);
  assert.equal((await call(b,'/api/messages')).json().messages.length,0);
  assert.equal((await call(b,'/api/messages/'+id)).statusCode,404);
  assert.equal((await call(b,'/api/messages/'+id+'/stop',{})).statusCode,404);
  assert.equal((await call(a,'/api/messages/'+id)).json().message.tracking_enabled,true);
  assert.equal((await call('invalid','/api/messages')).statusCode,401);
 }finally{await app.close();await db.close()}
});
test('Giriş denemeleri sınırlandırılır',async()=>{
 const{db,app}=await setup();try{for(let i=0;i<15;i++)await app.inject({method:'POST',url:'/api/auth/login',headers:{authorization:'Bearer '+key},payload:{email:'rate@example.invalid',password:'wrong-but-long-password'}});assert.equal((await app.inject({method:'POST',url:'/api/auth/login',headers:{authorization:'Bearer '+key},payload:{email:'rate@example.invalid',password:'wrong-but-long-password'}})).statusCode,429)}finally{await app.close();await db.close()}
});
