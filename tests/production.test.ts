import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {openDatabase,migrate} from '../packages/database/index';
import {buildServer} from '../apps/api/server';
import {UnavailableProvider} from '../packages/provider-adapters/index';
import {productionConfig} from '../packages/runtime/config';
import {seal,unseal} from '../packages/runtime/vault';
import {Accounts} from '../apps/api/accounts';
import {AccountSecurity} from '../apps/api/account-security';
import {allowRequest} from '../apps/api/rate-limit';
import {gmailConnectionReason} from '../packages/domain/gmail-errors';
const secret=randomBytes(32).toString('base64'),apiKey='production-unit-test-only-key-32-characters',password='Only-test-Password-2026!';
test('OAuth redirect only exposes allowlisted failure reasons',()=>{
 assert.equal(gmailConnectionReason(Error('invalid_client: confidential response')),'GMAIL_CONNECTION_FAILED');
 assert.equal(gmailConnectionReason(Error('GMAIL_SCOPE_REQUIRED')),'GMAIL_SCOPE_REQUIRED');
 assert.equal(gmailConnectionReason(new DOMException('sensitive URL','TimeoutError')),'GMAIL_CONNECTION_TIMEOUT');
 assert.equal(gmailConnectionReason(Error('toString')),'GMAIL_CONNECTION_FAILED');
});
async function setup(billing='complimentary'){
 const db=await openDatabase();await migrate(db);
 const {app}=buildServer(db,new UnavailableProvider(),apiKey,'https://folloopy.example',undefined,{production:true,site:'https://folloopy.example',encryptionKey:secret,billing});
 const call=(url:string,payload?:Record<string,unknown>,token?:string)=>app.inject({method:payload===undefined?'GET':'POST',url,headers:{authorization:'Bearer '+apiKey,...(token?{'x-user-session':token}:{})},...(payload===undefined?{}:{payload})});
 const accounts=new Accounts(db);async function user(email='member@example.invalid'){const{token}=await accounts.register('Test member',email,password);return {token,...(await accounts.current(token))!}}
 return {db,app,call,accounts,user};
}
test('Production startup fails closed for missing secrets, non-HTTPS site and embedded DB',()=>{
 assert.throws(()=>productionConfig({NODE_ENV:'production'}),/CONFIG_/);
 const env:NodeJS.ProcessEnv={NODE_ENV:'production',SITE_URL:'https://folloopy.example',DATABASE_URL:'postgresql://localhost/folloopy',INTERNAL_API_KEY:apiKey,DATA_ENCRYPTION_KEY:secret,ADMIN_OWNER_EMAIL:'owner@example.invalid',RESEND_API_KEY:'synthetic',MAIL_FROM:'Folloopy <noreply@example.invalid>',NEXT_SERVER_ACTIONS_ENCRYPTION_KEY:secret};
 assert.equal(productionConfig(env).production,true);
 const panel=productionConfig({...env,APP_URL:'https://panel.folloopy.example',PUBLIC_TRACKING_ORIGIN:'https://folloopy.example'});
 assert.equal(panel.appSite,'https://panel.folloopy.example');assert.equal(panel.trackingSite,'https://folloopy.example');
 assert.throws(()=>productionConfig({...env,DEPLOYMENT_ROLE:'public'}),/WORKERS/);
 assert.equal(productionConfig({...env,DEPLOYMENT_ROLE:'public',RUN_BACKGROUND_WORKERS:'false'}).backgroundWorkers,false);
 assert.throws(()=>productionConfig({...env,APP_URL:'http://panel.folloopy.example'}),/URL_INVALID/);
 assert.throws(()=>productionConfig({...env,SITE_URL:'http://folloopy.example'}),/HTTPS/);
 assert.throws(()=>productionConfig({...env,DATABASE_URL:'file:local.db'}),/DATABASE/);
 assert.throws(()=>productionConfig({...env,INTERNAL_API_KEY:''}),/INTERNAL_API_KEY/);
 assert.throws(()=>productionConfig({...env,DATA_ENCRYPTION_KEY:'short'}),/ENCRYPTION/);
});
test('Vault authenticates ciphertext and rejects tampering/wrong keys',()=>{const value=seal('sensitive-value',secret);assert.ok(!value.includes('sensitive-value'));assert.equal(unseal(value,secret),'sensitive-value');assert.throws(()=>unseal(value,randomBytes(32).toString('base64')));const [a,b,c]=value.split('.');const changed=Buffer.from(c,'base64url');changed[0]^=1;assert.throws(()=>unseal([a,b,changed.toString('base64url')].join('.'),secret))});
test('Production forbids anonymous workspace, fake sends, preview entitlement and unverified access',async()=>{
 const{db,app,call,user}=await setup();try{const u=await user();assert.equal((await call('/api/messages')).statusCode,401);assert.equal((await call('/api/messages',undefined,u.token)).statusCode,403);assert.equal((await call('/api/access/activate',{plan:'team'},u.token)).statusCode,403);assert.equal((await call('/api/purchase-preview',{plan:'team'},u.token)).statusCode,403);
 await db.query('UPDATE users SET email_verified_at=now() WHERE id=$1',[u.id]);assert.equal((await call('/api/access/activate',{plan:'individual'},u.token)).statusCode,200);assert.equal((await call('/api/auth/me',undefined,u.token)).json().user.plan,'individual');assert.equal((await db.query('SELECT * FROM purchases')).rows.length,0);assert.equal((await call('/api/messages',undefined,u.token)).statusCode,200);
 const fake=await app.inject({method:'POST',url:'/api/test-submissions',headers:{authorization:'Bearer '+apiKey,'x-user-session':u.token,'idempotency-key':'synthetic-test-001'},payload:{subject:'Hello',to:'recipient@example.invalid',text:'Example',tracking:true}});assert.equal(fake.statusCode,403);
 }finally{await app.close();await db.close()}
});
test('Complimentary activation is explicitly disabled without configuration',async()=>{const{db,app,call,user}=await setup('disabled');try{const u=await user();await db.query('UPDATE users SET email_verified_at=now() WHERE id=$1',[u.id]);assert.equal((await call('/api/access/activate',{plan:'individual'},u.token)).statusCode,403);assert.equal((await db.query('SELECT * FROM access_grants')).rows.length,0)}finally{await app.close();await db.close()}});
test('Account links are encrypted, single use, purpose-bound, expire; reset revokes sessions',async()=>{
 const{db,app,accounts,user}=await setup();try{const u=await user();const security=new AccountSecurity(db,'https://folloopy.example',secret);
 const getToken=async()=>{const r=(await db.query<{payload:string}>("SELECT payload FROM mail_outbox ORDER BY created_at DESC LIMIT 1")).rows[0];return JSON.parse(unseal(r.payload,secret)).text.match(/#token=([A-Za-z0-9_-]{43})/)[1] as string};
 await security.issue(u.id,'verify');let token=await getToken();await assert.rejects(()=>security.consume(token,'reset',password),/INVALID_ACCOUNT_TOKEN/);await security.consume(token,'verify');assert.ok((await accounts.current(u.token))?.email_verified_at);await assert.rejects(()=>security.consume(token,'verify'),/INVALID_ACCOUNT_TOKEN/);
 await security.issue(u.id,'reset');token=await getToken();await db.query("UPDATE account_tokens SET expires_at=now()-interval '1 minute'");await assert.rejects(()=>security.consume(token,'reset',password),/INVALID_ACCOUNT_TOKEN/);
 await security.issue(u.id,'reset');token=await getToken();await security.consume(token,'reset','New-Password-2026!');assert.equal(await accounts.current(u.token),null);await assert.rejects(()=>accounts.login(u.email,password),/INVALID_LOGIN/);assert.ok((await accounts.login(u.email,'New-Password-2026!')).token);
 }finally{await app.close();await db.close()}
});
test('Persistent rate limiting survives a new service instance',async()=>{const{db,app}=await setup();try{assert.equal(await allowRequest(db,'unit','account',2),true);assert.equal(await allowRequest(db,'unit','account',2),true);assert.equal(await allowRequest(db,'unit','account',2),false);assert.equal(await allowRequest(db,'unit','different',2),true)}finally{await app.close();await db.close()}});
test('Only owner can upload raster media; bytes persist in database and can be read publicly',async()=>{
 const{db,app,user}=await setup();try{const u=await user();const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP2cAAAAASUVORK5CYII=','base64');
 const upload=(token:string,body:Buffer)=>app.inject({method:'POST',url:'/api/admin/media',headers:{authorization:'Bearer '+apiKey,'x-user-session':token,'Content-Type':'application/octet-stream'},payload:body});
 assert.equal((await upload(u.token,png)).statusCode,403);await db.query("UPDATE users SET role='owner',email_verified_at=now() WHERE id=$1",[u.id]);assert.equal((await upload(u.token,Buffer.from('<svg/>'))).statusCode,415);const result=await upload(u.token,png);assert.equal(result.statusCode,201,result.body);const path=result.json().url.replace('/blog/media/','/public/media/');const res=await app.inject({method:'GET',url:path});assert.equal(res.statusCode,200);assert.equal(res.headers['x-content-type-options'],'nosniff');assert.deepEqual(res.rawPayload,png);assert.equal((await db.query('SELECT name FROM blog_media')).rows.length,1);
 }finally{await app.close();await db.close()}
});
test('Gmail OAuth binds state to user/session; encrypted refresh token sends once per idempotency key',async()=>{
 const oldId=process.env.GOOGLE_CLIENT_ID,oldSecret=process.env.GOOGLE_CLIENT_SECRET,originalFetch=globalThis.fetch;process.env.GOOGLE_CLIENT_ID='test-client';process.env.GOOGLE_CLIENT_SECRET='test-secret';let sends=0;
 globalThis.fetch=async(input,init)=>{const url=String(input);if(url==='https://oauth2.googleapis.com/token')return Response.json({access_token:'synthetic-access-token',refresh_token:'synthetic-refresh-token',scope:'openid email https://www.googleapis.com/auth/gmail.send'});if(url.includes('/userinfo'))return Response.json({email:'sender@example.invalid',email_verified:true});if(url.includes('/messages/send')){sends++;return Response.json({id:'gmail-message',threadId:'gmail-thread'})}throw Error('Unexpected external call')};
 const{db,app,user,call}=await setup();try{const u=await user(),other=await user('other@example.invalid');await db.query('UPDATE users SET email_verified_at=now()');await call('/api/access/activate',{plan:'individual'},u.token);await call('/api/access/activate',{plan:'individual'},other.token);
 const start=await call('/api/gmail/start',{},u.token);assert.equal(start.statusCode,200,start.body);const url=new URL(start.json().url);assert.equal(url.searchParams.get('redirect_uri'),'https://folloopy.example/baglantilar/google/callback');assert.equal(url.searchParams.get('code_challenge_method'),'S256');const state=url.searchParams.get('state');
 assert.equal((await call('/api/gmail/callback',{state,code:'code'},other.token)).statusCode,400);assert.equal((await call('/api/gmail/callback',{state,code:'code'},u.token)).statusCode,200);assert.equal((await call('/api/gmail/callback',{state,code:'code'},u.token)).statusCode,400);
 const row=(await db.query<{refresh_token:string}>('SELECT refresh_token FROM mail_connections')).rows[0];assert.ok(!row.refresh_token.includes('synthetic-refresh-token'));
 const send=()=>app.inject({method:'POST',url:'/api/messages/send',headers:{authorization:'Bearer '+apiKey,'x-user-session':u.token,'idempotency-key':'production-send-once-0001'},payload:{subject:'Tracked message',to:'recipient@example.invalid',text:'Hello',tracking:true}});const a=await send(),b=await send();assert.equal(a.statusCode,200,a.body);assert.equal(a.json().id,b.json().id);assert.equal(sends,1);
 }finally{globalThis.fetch=originalFetch;if(oldId===undefined)delete process.env.GOOGLE_CLIENT_ID;else process.env.GOOGLE_CLIENT_ID=oldId;if(oldSecret===undefined)delete process.env.GOOGLE_CLIENT_SECRET;else process.env.GOOGLE_CLIENT_SECRET=oldSecret;await app.close();await db.close()}
});

test('OAuth failures identify the failed stage without storing incomplete connections or leaking provider responses',async()=>{
 const oldId=process.env.GOOGLE_CLIENT_ID,oldSecret=process.env.GOOGLE_CLIENT_SECRET,originalFetch=globalThis.fetch;
 process.env.GOOGLE_CLIENT_ID='synthetic-client';process.env.GOOGLE_CLIENT_SECRET='synthetic-secret';
 let mode='invalid_client';
 globalThis.fetch=async input=>{
  if(String(input).includes('/token')){
   if(['invalid_client','invalid_grant','unknown_error'].includes(mode))return Response.json({error:mode,error_description:'PRIVATE_PROVIDER_RESPONSE'},{status:400});
   return Response.json({access_token:'synthetic-access',...(mode==='refresh'?{}:{refresh_token:'synthetic-refresh'}),scope:mode==='scope'?'openid email':'openid email https://www.googleapis.com/auth/gmail.send'});
  }
  return Response.json({email:'sender@example.invalid',email_verified:false});
 };
 const{db,app,call,user}=await setup();
 try{
  const u=await user();await db.query('UPDATE users SET email_verified_at=now()');await call('/api/access/activate',{plan:'individual'},u.token);
  for(const [scenario,expected] of [['invalid_client','GMAIL_CLIENT_INVALID'],['invalid_grant','GMAIL_CODE_INVALID'],['unknown_error','GMAIL_AUTH_FAILED'],['scope','GMAIL_SCOPE_REQUIRED'],['refresh','GMAIL_REFRESH_REQUIRED'],['identity','GMAIL_IDENTITY_FAILED']]){
   mode=scenario;const start=await call('/api/gmail/start',{},u.token);const state=new URL(start.json().url).searchParams.get('state');
   const result=await call('/api/gmail/callback',{state,code:'synthetic-code'},u.token);
   assert.equal(result.statusCode,400,result.body);assert.equal(result.json().code,expected);assert.ok(!result.body.includes('PRIVATE_PROVIDER_RESPONSE'));
   assert.equal((await db.query('SELECT * FROM mail_connections')).rows.length,0);
  }
 }finally{
  globalThis.fetch=originalFetch;if(oldId===undefined)delete process.env.GOOGLE_CLIENT_ID;else process.env.GOOGLE_CLIENT_ID=oldId;if(oldSecret===undefined)delete process.env.GOOGLE_CLIENT_SECRET;else process.env.GOOGLE_CLIENT_SECRET=oldSecret;await app.close();await db.close();
 }
});
