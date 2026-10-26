import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {openDatabase,migrate} from '../packages/database';
import {Accounts} from '../apps/api/accounts';
import {AccountSecurity} from '../apps/api/account-security';
import {buildServer} from '../apps/api/server';
import {FakeProvider} from '../packages/provider-adapters';
import {TrackingService} from '../apps/api/service';
import {seal,unseal} from '../packages/runtime/vault';
const apiKey='security-flow-synthetic-internal-key-2026',key=randomBytes(32).toString('base64'),password='Synthetic-security-password-2026!';
async function setup(billing='complimentary'){
 const db=await openDatabase();await migrate(db);const provider=new FakeProvider();
 const {app}=buildServer(db,provider,apiKey,'https://folloopy.example',undefined,{production:true,encryptionKey:key,billing});
 const accounts=new Accounts(db,true),security=new AccountSecurity(db,'https://folloopy.example',key);
 const create=async(email:string,verified=false,owner=false)=>{const {token}=await accounts.register('Security Test',email,password);if(verified)await db.query('UPDATE users SET email_verified_at=now() WHERE email=$1',[email]);if(owner)await db.query("UPDATE users SET role='owner' WHERE email=$1",[email]);return {token,user:(await accounts.current(token))!}};
 const call=(url:string,body?:Record<string,unknown>,token?:string)=>app.inject({method:body===undefined?'GET':'POST',url,headers:{authorization:'Bearer '+apiKey,...(token?{'x-user-session':token}:{})},...(body===undefined?{}:{payload:body})});
 return {db,app,accounts,security,create,call,provider};
}
test('Production: unverified members AND owners cannot use private data, activation or Gmail endpoints',async()=>{
 const s=await setup();try{
  const routes:[string,Record<string,unknown>?][]=[['/api/messages'],['/api/messages/'+randomUUID()],['/api/messages/'+randomUUID()+'/stop',{}],['/api/status'],['/api/account/details'],['/api/account/billing'],['/api/account/billing',{}],['/api/account/profile',{name:'Updated name'}],['/api/account/email/request',{email:'new@example.invalid',password}],['/api/account/email/cancel',{}],['/api/access/activate',{plan:'individual'}],['/api/access/activate',{plan:'team'}],['/api/gmail/start',{}],['/api/gmail/callback',{state:'unused',code:'unused'}],['/api/gmail/disconnect',{}]];
  for(const owner of [false,true]){
   const u=await s.create(`unverified-${owner}@example.invalid`,false,owner);
   // Even previously granted access must not bypass verification.
   await s.db.query("INSERT INTO access_grants(workspace_id,plan,mode) VALUES($1,'team','complimentary')",[u.user.workspace_id]);
   await s.db.query("INSERT INTO entitlements(workspace_id,status,message_limit) VALUES($1,'active',500)",[u.user.workspace_id]);
   for(const [path,body]of routes){const res=await s.call(path,body,u.token);assert.equal(res.statusCode,403,path);assert.equal(res.json().code,'EMAIL_NOT_VERIFIED',path)}
   if(owner){const res=await s.call('/api/admin/members',undefined,u.token);assert.equal(res.statusCode,403);assert.equal(res.json().code,'EMAIL_NOT_VERIFIED')}
   assert.equal((await s.call('/api/auth/me',undefined,u.token)).statusCode,200);
   assert.equal((await s.call('/api/auth/verify/code/request',{},u.token)).statusCode,200);
   assert.equal((await s.call('/api/auth/logout',{},u.token)).statusCode,200);
   assert.equal((await s.call('/api/auth/me',undefined,u.token)).statusCode,401);
  }
  assert.equal((await s.db.query('SELECT * FROM mail_connections')).rows.length,0);
 }finally{await s.app.close();await s.db.close()}
});
test('Verified account needs a package for workspace/OAuth; commercial plans cannot forge Enterprise, quota or payment',async()=>{
 const s=await setup();try{
  const a=await s.create('plan-a@example.invalid',true),b=await s.create('plan-b@example.invalid',true);
  for(const path of ['/api/messages','/api/gmail/start','/api/gmail/disconnect']){const res=await s.call(path,path.includes('gmail')?{}:undefined,a.token);assert.equal(res.statusCode,402,path)}
  assert.equal((await s.call('/api/account/details',undefined,a.token)).statusCode,200);
  for(const plan of ['business','owner','__proto__','free',''])assert.equal((await s.call('/api/access/activate',{plan},a.token)).statusCode,400);
  assert.equal((await s.call('/api/access/activate',{plan:'team',workspace_id:b.user.workspace_id,used:0,amount_minor:0},a.token)).statusCode,400);
  for(const plan of ['individual','team','individual','team']){
   assert.equal((await s.call('/api/access/activate',{plan},a.token)).statusCode,200);
   assert.equal((await s.accounts.current(a.token))!.plan,plan);
   assert.equal((await s.accounts.current(b.token))!.plan,null);
   const e=(await s.db.query<{message_limit:number;used:number}>('SELECT * FROM entitlements WHERE workspace_id=$1',[a.user.workspace_id])).rows[0];assert.equal(e.message_limit,plan==='team'?500:100);
  }
  assert.equal((await s.db.query('SELECT * FROM purchases')).rows.length,0);
  assert.equal((await s.call('/api/purchase-preview',{plan:'team'},a.token)).statusCode,403);
  await assert.rejects(()=>s.accounts.purchase(a.user,'team'),/FORBIDDEN/);
  await assert.rejects(()=>s.accounts.grant(a.user,'business'),/INVALID_PLAN/);
 }finally{await s.app.close();await s.db.close()}
});
test('Package changes preserve consumption, downgrade enforces lower quota and suspended accounts cannot self-reactivate',async()=>{
 const s=await setup();try{
  const a=await s.create('quota@example.invalid',true);await s.call('/api/access/activate',{plan:'individual'},a.token);
  await s.db.query('UPDATE entitlements SET used=99 WHERE workspace_id=$1',[a.user.workspace_id]);
  const sender=new TrackingService(s.db,s.provider,'https://folloopy.example');const input={subject:'Synthetic quota test',to:'test@example.invalid',text:'Test',tracking:true};
  const first=await sender.send(a.user.workspace_id,'synthetic-quota-key-001',input);
  assert.equal((await sender.send(a.user.workspace_id,'synthetic-quota-key-001',input)).id,first.id);
  assert.equal((await sender.send(a.user.workspace_id,'synthetic-quota-key-002',input)).state,'sent');
  await s.call('/api/access/activate',{plan:'individual'},a.token);
  assert.equal((await sender.send(a.user.workspace_id,'synthetic-quota-key-002',input)).state,'sent');
  await s.call('/api/access/activate',{plan:'team'},a.token);await sender.send(a.user.workspace_id,'synthetic-quota-key-002',input);
  await s.call('/api/access/activate',{plan:'individual'},a.token);
  assert.equal((await s.db.query<{used:number}>('SELECT used FROM entitlements WHERE workspace_id=$1',[a.user.workspace_id])).rows[0].used,101);
  assert.equal((await sender.send(a.user.workspace_id,'synthetic-quota-key-003',input)).state,'sent');
  await s.db.query("UPDATE entitlements SET status='suspended' WHERE workspace_id=$1",[a.user.workspace_id]);
  for(const plan of ['individual','team'])assert.equal((await s.call('/api/access/activate',{plan},a.token)).statusCode,403);
  assert.equal((await s.call('/api/messages',undefined,a.token)).statusCode,403);
  assert.equal((await s.call('/api/gmail/start',{},a.token)).statusCode,403);
  assert.equal((await s.db.query<{status:string}>('SELECT status FROM entitlements WHERE workspace_id=$1',[a.user.workspace_id])).rows[0].status,'suspended');
 }finally{await s.app.close();await s.db.close()}
});
test('Legacy verification cannot verify another account; password reset revokes every session and pending OAuth',async()=>{
 const s=await setup();try{
  const a=await s.create('verify-a@example.invalid'),b=await s.create('verify-b@example.invalid');
  await s.security.issue(a.user.id,'verify');
  const readToken=async()=>{const r=(await s.db.query<{payload:string}>("SELECT payload FROM mail_outbox ORDER BY created_at DESC LIMIT 1")).rows[0];return JSON.parse(unseal(r.payload,key)).text.match(/#token=([\w-]{43})/)[1] as string};
  const token=await readToken();
  assert.equal((await s.call('/api/auth/verify/confirm',{token})).statusCode,401);
  assert.equal((await s.call('/api/auth/verify/confirm',{token},b.token)).statusCode,400);
  assert.equal((await s.accounts.current(a.token))!.email_verified_at,null);
  assert.equal((await s.call('/api/auth/verify/confirm',{token},a.token)).statusCode,200);
  assert.equal((await s.accounts.current(b.token))!.email_verified_at,null);
  const second=await s.accounts.login(a.user.email,password);
  await s.db.query("INSERT INTO oauth_states(token_hash,user_id,session_hash,verifier,expires_at) VALUES($1,$2,$3,$4,now()+interval '10 minutes')",['synthetic-state',a.user.id,'synthetic-session','synthetic-encrypted-verifier']);
  await s.security.issue(a.user.id,'reset');const reset=await readToken();await s.security.consume(reset,'reset','Replacement-security-password-2026!');
  for(const t of [a.token,second.token])assert.equal((await s.call('/api/auth/me',undefined,t)).statusCode,401);
  assert.equal((await s.db.query('SELECT * FROM oauth_states WHERE user_id=$1',[a.user.id])).rows.length,0);
  assert.equal((await s.call('/api/auth/login',{email:a.user.email,password})).statusCode,401);
  assert.equal((await s.call('/api/auth/login',{email:a.user.email,password:'Replacement-security-password-2026!'})).statusCode,200);
 }finally{await s.app.close();await s.db.close()}
});
test('Every package isolates messages, billing and admin access; forged/expired sessions fail closed',async()=>{
 const s=await setup();try{
  const a=await s.create('tenant-a@example.invalid',true),b=await s.create('tenant-b@example.invalid',true);
  const sender=new TrackingService(s.db,s.provider,'https://folloopy.example');
  for(const plan of ['individual','team','business'] as const){
   if(plan==='business')for(const u of [a,b]){await s.db.query("UPDATE access_grants SET plan='business' WHERE workspace_id=$1",[u.user.workspace_id]);await s.db.query('UPDATE entitlements SET message_limit=1000 WHERE workspace_id=$1',[u.user.workspace_id])}
   else{await s.call('/api/access/activate',{plan},a.token);await s.call('/api/access/activate',{plan},b.token)}
   const message=await sender.send(a.user.workspace_id,'isolation-key-'+plan,{subject:'Private '+plan,to:'recipient@example.invalid',text:'Private text',tracking:true});
   assert.equal((await s.call('/api/messages/'+message.id,undefined,b.token)).statusCode,404);
   assert.equal((await s.call('/api/messages/'+message.id+'/stop',{},b.token)).statusCode,404);
   assert.equal((await s.call('/api/messages',undefined,b.token)).json().messages.length,0);
   assert.equal((await s.call('/api/account/billing',undefined,b.token)).json().profile,null);
   assert.equal((await s.call('/api/admin/members',undefined,a.token)).statusCode,403);
   assert.equal((await s.call('/api/admin/purchases',undefined,b.token)).statusCode,403);
  }
  for(const t of [undefined,'active','owner',a.user.id,randomBytes(32).toString('base64url')])assert.equal((await s.call('/api/messages',undefined,t)).statusCode,401);
  await s.db.query("UPDATE sessions SET expires_at=now()-interval '1 second' WHERE user_id=$1",[a.user.id]);assert.equal((await s.call('/api/messages',undefined,a.token)).statusCode,401);
  const noKey=await s.app.inject({url:'/api/auth/me',headers:{'x-user-session':b.token}});assert.equal(noKey.statusCode,401);
 }finally{await s.app.close();await s.db.close()}
});
test('Cancelled or logged-out OAuth cannot finish after Google responds; concurrent callbacks store one connection',async()=>{
 const {GmailConnections}=await import('../apps/api/gmail');const s=await setup();
 const oldId=process.env.GOOGLE_CLIENT_ID,oldSecret=process.env.GOOGLE_CLIENT_SECRET,originalFetch=globalThis.fetch;
 process.env.GOOGLE_CLIENT_ID='synthetic-client';process.env.GOOGLE_CLIENT_SECRET='synthetic-secret';
 let reached!:()=>void,release!:()=>void;let entered=new Promise<void>(resolve=>{reached=resolve});let waiting=new Promise<void>(resolve=>{release=resolve});
 globalThis.fetch=async input=>{if(String(input).includes('/token')){reached();await waiting;return Response.json({access_token:'synthetic-access',refresh_token:'synthetic-refresh',scope:'openid email https://www.googleapis.com/auth/gmail.send'})}return Response.json({email:'sender@example.invalid',email_verified:true})};
 try{
  const a=await s.create('oauth-race@example.invalid',true);await s.accounts.grant(a.user,'team');const gmail=new GmailConnections(s.db,'https://folloopy.example',key);
  let state=new URL(await gmail.begin(a.user,a.token)).searchParams.get('state')!;
  let finish=gmail.finish(a.user,a.token,state,'synthetic-code');const cancelled=assert.rejects(finish,/INVALID_OAUTH_STATE/);await entered;await gmail.disconnect(a.user.workspace_id);release();await cancelled;
  assert.equal((await s.db.query('SELECT * FROM mail_connections')).rows.length,0);
  entered=new Promise<void>(resolve=>{reached=resolve});waiting=new Promise<void>(resolve=>{release=resolve});
  state=new URL(await gmail.begin(a.user,a.token)).searchParams.get('state')!;
  finish=gmail.finish(a.user,a.token,state,'synthetic-code');const loggedOut=assert.rejects(finish,/UNAUTHORIZED/);await entered;await s.accounts.logout(a.token);release();await loggedOut;
  assert.equal((await s.db.query('SELECT * FROM mail_connections')).rows.length,0);
  const login=await s.accounts.login(a.user.email,password);state=new URL(await gmail.begin(a.user,login.token)).searchParams.get('state')!;
  const results=await Promise.allSettled([gmail.finish(a.user,login.token,state,'synthetic-code'),gmail.finish(a.user,login.token,state,'synthetic-code')]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal((await s.db.query('SELECT * FROM mail_connections')).rows.length,1);
 }finally{globalThis.fetch=originalFetch;if(oldId===undefined)delete process.env.GOOGLE_CLIENT_ID;else process.env.GOOGLE_CLIENT_ID=oldId;if(oldSecret===undefined)delete process.env.GOOGLE_CLIENT_SECRET;else process.env.GOOGLE_CLIENT_SECRET=oldSecret;await s.app.close();await s.db.close()}
});
test('Concurrent reset and old-password login never leave an old-password session usable',async()=>{
 const s=await setup();try{
  const a=await s.create('reset-race@example.invalid',true);await s.security.issue(a.user.id,'reset');
  const row=(await s.db.query<{payload:string}>('SELECT payload FROM mail_outbox ORDER BY created_at DESC LIMIT 1')).rows[0];const token=JSON.parse(unseal(row.payload,key)).text.match(/#token=([\w-]{43})/)[1];
  const results=await Promise.allSettled([s.accounts.login(a.user.email,password),s.security.consume(token,'reset','New-concurrent-password-2026!')]);
  assert.equal(results[1].status,'fulfilled');if(results[0].status==='fulfilled')assert.equal(await s.accounts.current(results[0].value.token),null);
  assert.equal(await s.accounts.current(a.token),null);await assert.rejects(()=>s.accounts.login(a.user.email,password),/INVALID_LOGIN/);
 }finally{await s.app.close();await s.db.close()}
});
test('Single-mail rate limits run before OAuth token refresh and are scoped to the workspace',async()=>{
 const s=await setup();try{const a=await s.create('send-rate@example.invalid',true),b=await s.create('send-rate-other@example.invalid',true);await s.accounts.grant(a.user,'team');await s.accounts.grant(b.user,'team');
 const call=(token:string)=>s.app.inject({method:'POST',url:'/api/messages/send',headers:{authorization:'Bearer '+apiKey,'x-user-session':token,'idempotency-key':'synthetic-send-rate-key-2026'},payload:{subject:'Rate check',to:'nobody@example.invalid',text:'No real delivery',tracking:false}});
 // No connection exists, so accepted attempts stop before any network or mail delivery.
 for(let i=0;i<20;i++)assert.equal((await call(a.token)).json().code,'GMAIL_NOT_CONNECTED');assert.equal((await call(a.token)).statusCode,429);assert.equal((await call(b.token)).json().code,'GMAIL_NOT_CONNECTED');assert.equal(s.provider.submissions.length,0);
 }finally{await s.app.close();await s.db.close()}
});

test('Panel sends recheck session, verification, package and Gmail identity after OAuth refresh',async()=>{
 const s=await setup();const originalFetch=globalThis.fetch,oldId=process.env.GOOGLE_CLIENT_ID,oldSecret=process.env.GOOGLE_CLIENT_SECRET;
 process.env.GOOGLE_CLIENT_ID='synthetic-client';process.env.GOOGLE_CLIENT_SECRET='synthetic-secret';
 let release=()=>{};
 try{
  for(const change of ['logout','reset','unverified','no-plan','disconnected','sender-changed','unchanged']){
   const a=await s.create('send-race-'+change+'@example.invalid',true);await s.accounts.grant(a.user,'team');
   await s.db.query('INSERT INTO mail_connections(workspace_id,email,refresh_token,scopes) VALUES($1,$2,$3,$4)',[a.user.workspace_id,'sender@example.invalid',seal('synthetic-refresh',key),'https://www.googleapis.com/auth/gmail.send']);
   let entered!:()=>void;const reached=new Promise<void>(resolve=>{entered=resolve});const waiting=new Promise<void>(resolve=>{release=resolve});let deliveries=0;
   globalThis.fetch=async input=>{if(String(input).includes('/token')){entered();await waiting;return Response.json({access_token:'synthetic-access'})}deliveries++;return Response.json({id:'synthetic-receipt',threadId:'synthetic-thread'})};
   const pending=Promise.resolve(s.app.inject({method:'POST',url:'/api/messages/send',headers:{authorization:'Bearer '+apiKey,'x-user-session':a.token,'idempotency-key':'synthetic-send-race-'+change},payload:{subject:'Synthetic race',to:'recipient@example.invalid',text:'No actual delivery',tracking:true}}));
   await reached;
   if(change==='logout')await s.accounts.logout(a.token);
   if(change==='reset'){
    await s.security.issue(a.user.id,'reset');const row=(await s.db.query<{payload:string}>('SELECT payload FROM mail_outbox WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1',[a.user.id])).rows[0];
    const token=JSON.parse(unseal(row.payload,key)).text.match(/#token=([\w-]{43})/)[1];await s.security.consume(token,'reset','New-synthetic-reset-password-2026!');
   }
   if(change==='unverified')await s.db.query('UPDATE users SET email_verified_at=NULL WHERE id=$1',[a.user.id]);
   if(change==='no-plan')await s.db.query('DELETE FROM access_grants WHERE workspace_id=$1',[a.user.workspace_id]);
   if(change==='disconnected')await s.db.query('DELETE FROM mail_connections WHERE workspace_id=$1',[a.user.workspace_id]);
   if(change==='sender-changed')await s.db.query('UPDATE mail_connections SET email=$2 WHERE workspace_id=$1',[a.user.workspace_id,'other@example.invalid']);
   release();const response=await pending;const allowed=change==='unchanged';
   assert.equal(response.statusCode===200,allowed,change+': '+response.body);assert.equal(deliveries,allowed?1:0,change);
   assert.equal((await s.db.query<{used:number}>('SELECT used FROM entitlements WHERE workspace_id=$1',[a.user.workspace_id])).rows[0].used,allowed?1:0,change);
   assert.equal((await s.db.query('SELECT id FROM messages WHERE workspace_id=$1',[a.user.workspace_id])).rows.length,allowed?1:0,change);
  }
 }finally{release();globalThis.fetch=originalFetch;if(oldId===undefined)delete process.env.GOOGLE_CLIENT_ID;else process.env.GOOGLE_CLIENT_ID=oldId;if(oldSecret===undefined)delete process.env.GOOGLE_CLIENT_SECRET;else process.env.GOOGLE_CLIENT_SECRET=oldSecret;await s.app.close();await s.db.close()}
});

test('OAuth cannot store a Gmail connection when verification, access or entitlement is revoked during token exchange',async()=>{
 const {GmailConnections}=await import('../apps/api/gmail');const s=await setup();
 const originalFetch=globalThis.fetch,oldId=process.env.GOOGLE_CLIENT_ID,oldSecret=process.env.GOOGLE_CLIENT_SECRET;
 process.env.GOOGLE_CLIENT_ID='synthetic-client';process.env.GOOGLE_CLIENT_SECRET='synthetic-secret';
 try{
  for(const scenario of ['verification','plan','suspension'] as const){
   const a=await s.create('oauth-revoked-'+scenario+'@example.invalid',true);await s.accounts.grant(a.user,'team');
   const gmail=new GmailConnections(s.db,'https://folloopy.example',key),state=new URL(await gmail.begin(a.user,a.token)).searchParams.get('state')!;
   let entered!:()=>void,release!:()=>void;const reached=new Promise<void>(resolve=>{entered=resolve}),waiting=new Promise<void>(resolve=>{release=resolve});
   globalThis.fetch=async input=>{if(String(input).includes('/token')){entered();await waiting;return Response.json({access_token:'synthetic-access',refresh_token:'synthetic-refresh',scope:'https://www.googleapis.com/auth/gmail.send'})}return Response.json({email:'sender@example.invalid',email_verified:true})};
   const finishing=gmail.finish(a.user,a.token,state,'synthetic-code');
   const outcome=finishing.then(()=>false,()=>true);
   await reached;
   if(scenario==='verification')await s.db.query('UPDATE users SET email_verified_at=NULL WHERE id=$1',[a.user.id]);
   else if(scenario==='plan')await s.db.query('DELETE FROM access_grants WHERE workspace_id=$1',[a.user.workspace_id]);
   else await s.db.query("UPDATE entitlements SET status='suspended' WHERE workspace_id=$1",[a.user.workspace_id]);
   release();assert.equal(await outcome,true,scenario+': revoked authority accepted');
   assert.equal((await s.db.query('SELECT email FROM mail_connections WHERE workspace_id=$1',[a.user.workspace_id])).rows.length,0);
  }
 }finally{globalThis.fetch=originalFetch;if(oldId===undefined)delete process.env.GOOGLE_CLIENT_ID;else process.env.GOOGLE_CLIENT_ID=oldId;if(oldSecret===undefined)delete process.env.GOOGLE_CLIENT_SECRET;else process.env.GOOGLE_CLIENT_SECRET=oldSecret;await s.app.close();await s.db.close()}
});

test('Development OAuth can use its explicit local preview while production rejects the same unverified preview account',async()=>{
 const {GmailConnections}=await import('../apps/api/gmail');const s=await setup();
 const originalFetch=globalThis.fetch,oldId=process.env.GOOGLE_CLIENT_ID,oldSecret=process.env.GOOGLE_CLIENT_SECRET;
 process.env.GOOGLE_CLIENT_ID='synthetic-client';process.env.GOOGLE_CLIENT_SECRET='synthetic-secret';
 globalThis.fetch=async input=>String(input).includes('/token')?Response.json({access_token:'synthetic-access',refresh_token:'synthetic-refresh',scope:'https://www.googleapis.com/auth/gmail.send'}):Response.json({email:'preview@example.invalid',email_verified:true});
 try{
  const local=new Accounts(s.db,false),session=await local.register('Local Preview','oauth-preview@example.invalid',password),user=(await local.current(session.token))!;
  await local.purchase(user,'individual');
  const dev=new GmailConnections(s.db,'https://folloopy.example',key,false),prod=new GmailConnections(s.db,'https://folloopy.example',key,true);
  let state=new URL(await prod.begin(user,session.token)).searchParams.get('state')!;
  await assert.rejects(prod.finish(user,session.token,state,'synthetic-code'),/EMAIL_NOT_VERIFIED/);
  assert.equal((await s.db.query('SELECT email FROM mail_connections')).rows.length,0);
  state=new URL(await dev.begin(user,session.token)).searchParams.get('state')!;
  await dev.finish(user,session.token,state,'synthetic-code');
  assert.equal((await dev.status(user.workspace_id)).connected,true);
 }finally{globalThis.fetch=originalFetch;if(oldId===undefined)delete process.env.GOOGLE_CLIENT_ID;else process.env.GOOGLE_CLIENT_ID=oldId;if(oldSecret===undefined)delete process.env.GOOGLE_CLIENT_SECRET;else process.env.GOOGLE_CLIENT_SECRET=oldSecret;await s.app.close();await s.db.close()}
});
