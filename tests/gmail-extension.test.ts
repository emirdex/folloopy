import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,randomBytes,randomUUID,sign} from 'node:crypto';
import {openDatabase,migrate} from '../packages/database';
import {Accounts} from '../apps/api/accounts';
import {GmailExtension,extensionCanonical,type ExtensionEnvelope} from '../apps/api/gmail-extension';
import {GmailConnections} from '../apps/api/gmail';
import {FakeProvider} from '../packages/provider-adapters';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
async function setup(){const db=await openDatabase();await migrate(db);const accounts=new Accounts(db,true),provider=new FakeProvider();const gmail={provider:async()=>({provider,from:'sender@example.invalid'})};const extension=new GmailExtension(db,gmail as unknown as GmailConnections,'https://tracking.example');
 async function user(email:string,plan:'individual'|'team'='team',verified=true){const {token}=await accounts.register('Extension Member',email,'Synthetic-extension-password-2026!');if(verified)await db.query('UPDATE users SET email_verified_at=now() WHERE email=$1',[email]);let u=(await accounts.current(token))!;if(verified)await accounts.grant(u,plan);u=(await accounts.current(token))!;await db.query("INSERT INTO mail_connections(workspace_id,email,refresh_token,scopes) VALUES($1,'sender@example.invalid','synthetic','gmail.send')",[u.workspace_id]);return {user:u,token}}
 async function pair(u:Awaited<ReturnType<typeof user>>){const keys=generateKeyPairSync('ec',{namedCurve:'P-256'}),secret=randomBytes(32).toString('base64url');const {pairId}=await extension.begin({challenge:hash(secret),publicKey:keys.publicKey.export({format:'jwk'})});await extension.approve(u.user,u.token,pairId);const device=await extension.exchange({pairId,secret}) as any;function envelope(operation:ExtensionEnvelope['operation']='status',payload:Record<string,unknown>={}):ExtensionEnvelope{const e={deviceId:device.deviceId,token:device.token,nonce:randomUUID(),issuedAt:Date.now(),operation,payload};return {...e,signature:sign('sha256',Buffer.from(extensionCanonical(e)),{key:keys.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url')}}return {device,pairId,secret,envelope}}
 return {db,accounts,extension,provider,gmail,user,pair,close:()=>db.close()}}
test('Pairing requires verified premium account, current session, PKCE and one-time approval',async()=>{const s=await setup();try{const a=await s.user('extension@example.invalid'),basic=await s.user('basic@example.invalid','individual'),unverified=await s.user('unverified@example.invalid','team',false);const keys=generateKeyPairSync('ec',{namedCurve:'P-256'}),secret=randomBytes(32).toString('base64url');const {pairId}=await s.extension.begin({challenge:hash(secret),publicKey:keys.publicKey.export({format:'jwk'})});assert.deepEqual(await s.extension.exchange({pairId,secret}),{pending:true});await assert.rejects(s.extension.approve(basic.user,basic.token,pairId),/FORBIDDEN/);await assert.rejects(s.extension.approve(unverified.user,unverified.token,pairId),/FORBIDDEN/);await assert.rejects(s.extension.approve(a.user,'wrong-session',pairId),/FORBIDDEN/);await s.extension.approve(a.user,a.token,pairId);await assert.rejects(s.extension.approve(a.user,a.token,pairId),/NOT_FOUND/);await assert.rejects(s.extension.exchange({pairId,secret:randomBytes(32).toString('base64url')}),/FORBIDDEN/);const d=await s.extension.exchange({pairId,secret}) as any;assert.ok(d.token);await assert.rejects(s.extension.exchange({pairId,secret}),/FORBIDDEN/);const stored=(await s.db.query<any>('SELECT * FROM extension_devices')).rows[0];assert.notEqual(stored.token_hash,d.token);assert.equal(stored.public_key.d,undefined);assert.equal((await s.db.query('SELECT id FROM messages')).rows.length,0)}finally{await s.close()}});
test('Signed requests reject replay, forgery, timestamp abuse; sender and quota remain server controlled',async()=>{const s=await setup();try{const a=await s.user('signed@example.invalid'),p=await s.pair(a);let e=p.envelope();assert.equal((await s.extension.request(e) as any).sender,'sender@example.invalid');await assert.rejects(s.extension.request(e),/UNAUTHORIZED/);e=p.envelope();e.signature=randomBytes(64).toString('base64url');await assert.rejects(s.extension.request(e),/UNAUTHORIZED/);e=p.envelope();e.issuedAt-=120000;await assert.rejects(s.extension.request(e),/UNAUTHORIZED/);const payload={from:'sender@example.invalid',to:'recipient@example.invalid',subject:'Tracking',text:'Synthetic message',tracking:true,idempotencyKey:randomUUID()};await assert.rejects(s.extension.request(p.envelope('send',{...payload,from:'friend@example.invalid'})),/INVALID_ACCOUNT/);await assert.rejects(s.extension.request(p.envelope('send',{...payload,to:'a@example.invalid,b@example.invalid'})),/INVALID_ACCOUNT/);const sent=await s.extension.request(p.envelope('send',payload)) as any;assert.equal(sent.state,'sent');assert.equal((await s.db.query<any>('SELECT send_channel FROM messages WHERE id=$1',[sent.id])).rows[0].send_channel,'extension');const repeated=await s.extension.request(p.envelope('send',payload)) as any;assert.equal(repeated.id,sent.id);assert.equal(repeated.replay,true);assert.equal((await s.db.query<any>('SELECT used FROM entitlements WHERE workspace_id=$1',[a.user.workspace_id])).rows[0].used,1);await s.db.query('UPDATE entitlements SET used=message_limit WHERE workspace_id=$1',[a.user.workspace_id]);await assert.rejects(s.extension.request(p.envelope('send',{...payload,idempotencyKey:randomUUID()})),/LIMIT_REACHED/)}finally{await s.close()}});
test('Copied files grant nothing; downgrade, logout, suspension, Gmail change and new pairing revoke access',async()=>{const s=await setup();try{const a=await s.user('revocation@example.invalid');let p=await s.pair(a);await s.accounts.grant(a.user,'individual');await assert.rejects(s.extension.request(p.envelope()),/FORBIDDEN/);await s.accounts.grant(a.user,'team');await s.db.query("UPDATE entitlements SET status='suspended' WHERE workspace_id=$1",[a.user.workspace_id]);await assert.rejects(s.extension.request(p.envelope()),/FORBIDDEN/);await s.db.query("UPDATE entitlements SET status='active' WHERE workspace_id=$1",[a.user.workspace_id]);await s.db.query("UPDATE mail_connections SET email='changed@example.invalid' WHERE workspace_id=$1",[a.user.workspace_id]);await assert.rejects(s.extension.request(p.envelope()),/FORBIDDEN/);await s.db.query("UPDATE mail_connections SET email='sender@example.invalid' WHERE workspace_id=$1",[a.user.workspace_id]);const second=await s.pair(a);await assert.rejects(s.extension.request(p.envelope()),/FORBIDDEN/);assert.equal((await s.extension.request(second.envelope()) as any).connected,true);await s.extension.revoke(a.user);await assert.rejects(s.extension.request(second.envelope()),/FORBIDDEN/);p=await s.pair(a);await s.accounts.logout(a.token);await assert.rejects(s.extension.request(p.envelope()),/FORBIDDEN/)}finally{await s.close()}});

test('Public transport keeps internal API authentication and never inherits browser session authority',async()=>{
 const {buildServer}=await import('../apps/api/server');const s=await setup();const key='extension-transport-test-internal-key-32';const {app}=buildServer(s.db,s.provider,key,'https://tracking.example',undefined,{production:true});
 try{const a=await s.user('transport@example.invalid');const keys=generateKeyPairSync('ec',{namedCurve:'P-256'});const payload={operation:'pair',payload:{challenge:hash('synthetic-secret'),publicKey:keys.publicKey.export({format:'jwk'})}};
 assert.equal((await app.inject({method:'POST',url:'/api/extension/transport',payload})).statusCode,401);
 const paired=await app.inject({method:'POST',url:'/api/extension/transport',headers:{authorization:'Bearer '+key},payload});assert.equal(paired.statusCode,200);assert.ok(paired.json().pairId);
 const unsigned=await app.inject({method:'POST',url:'/api/extension/transport',headers:{authorization:'Bearer '+key,'x-user-session':a.token},payload:{operation:'send',payload:{}}});assert.equal(unsigned.statusCode,401);
 const anonymousApprove=await app.inject({method:'POST',url:'/api/extension/approve',headers:{authorization:'Bearer '+key},payload:{id:paired.json().pairId}});assert.equal(anonymousApprove.statusCode,401);
 }finally{await app.close();await s.close()}
});

test('Stolen device token without its private key, tampered payloads, expired devices and pairs fail closed',async()=>{
 const s=await setup();try{
  const a=await s.user('extension-hardening@example.invalid'),p=await s.pair(a);
  const stolen=p.envelope(),attacker=generateKeyPairSync('ec',{namedCurve:'P-256'});
  stolen.signature=sign('sha256',Buffer.from(extensionCanonical(stolen)),{key:attacker.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
  await assert.rejects(s.extension.request(stolen),/UNAUTHORIZED/);
  const tampered=p.envelope();tampered.payload={injected:'unauthorized-change'};await assert.rejects(s.extension.request(tampered),/UNAUTHORIZED/);
  await s.db.query("UPDATE extension_devices SET expires_at=now()-interval '1 second' WHERE id=$1",[p.device.deviceId]);await assert.rejects(s.extension.request(p.envelope()),/FORBIDDEN/);
  const keys=generateKeyPairSync('ec',{namedCurve:'P-256'}),secret=randomBytes(32).toString('base64url');
  const pair=await s.extension.begin({challenge:hash(secret),publicKey:keys.publicKey.export({format:'jwk'})});
  await s.db.query("UPDATE extension_pairs SET expires_at=now()-interval '1 second' WHERE id=$1",[pair.pairId]);
  await assert.rejects(s.extension.approve(a.user,a.token,pair.pairId),/NOT_FOUND/);await assert.rejects(s.extension.exchange({pairId:pair.pairId,secret}),/FORBIDDEN/);
  const pending=await s.extension.begin({challenge:hash(secret),publicKey:keys.publicKey.export({format:'jwk'})});await s.extension.approve(a.user,a.token,pending.pairId);await s.accounts.logout(a.token);await assert.rejects(s.extension.exchange({pairId:pending.pairId,secret}),/FORBIDDEN/);
  assert.equal(s.provider.submissions.length,0);
 }finally{await s.close()}
});
test('Extension sends recheck approval, session, premium entitlement and sender after provider refresh',async()=>{
 const s=await setup();let release=()=>{};
 try{
  for(const change of ['logout','downgrade','revoked','unverified','suspended','disconnected','sender-changed','unchanged']){
   const a=await s.user('extension-race-'+change+'@example.invalid'),p=await s.pair(a);let entered!:()=>void;const reached=new Promise<void>(resolve=>{entered=resolve}),waiting=new Promise<void>(resolve=>{release=resolve});
   s.gmail.provider=async()=>{entered();await waiting;return {provider:s.provider,from:'sender@example.invalid'}};
   const pending=s.extension.request(p.envelope('send',{from:'sender@example.invalid',to:'recipient@example.invalid',subject:'Synthetic extension race',text:'No real delivery',tracking:true,idempotencyKey:randomUUID()}));
   const outcome=pending.then(value=>({value,error:undefined}),error=>({value:undefined,error}));await reached;
   if(change==='logout')await s.accounts.logout(a.token);
   if(change==='downgrade')await s.accounts.grant(a.user,'individual');
   if(change==='revoked')await s.extension.revoke(a.user);
   if(change==='unverified')await s.db.query('UPDATE users SET email_verified_at=NULL WHERE id=$1',[a.user.id]);
   if(change==='suspended')await s.db.query("UPDATE entitlements SET status='suspended' WHERE workspace_id=$1",[a.user.workspace_id]);
   if(change==='disconnected')await s.db.query('DELETE FROM mail_connections WHERE workspace_id=$1',[a.user.workspace_id]);
   if(change==='sender-changed')await s.db.query('UPDATE mail_connections SET email=$2 WHERE workspace_id=$1',[a.user.workspace_id,'other@example.invalid']);
   release();const result=await outcome;const allowed=change==='unchanged';assert.equal(!result.error,allowed,change);assert.equal((await s.db.query<{used:number}>('SELECT used FROM entitlements WHERE workspace_id=$1',[a.user.workspace_id])).rows[0].used,allowed?1:0,change);
  }
  assert.equal(s.provider.submissions.length,1);
 }finally{release();await s.close()}
});

test('Signed file sharing operations enforce device authority, owner isolation and current plan',async()=>{
 const s=await setup();try{
  const {FileSharing}=await import('../apps/api/file-sharing');const encryption=randomBytes(32).toString('base64');
  const extension=new GmailExtension(s.db,s.gmail as unknown as GmailConnections,'https://panel.example',encryption);
  const files=new FileSharing(s.db,encryption,'https://panel.example');
  const a=await s.user('file-extension@example.invalid'),b=await s.user('file-other@example.invalid'),paired=await s.pair(a);
  const data=Buffer.from('%PDF-1.4\nSynthetic attachment\n%%EOF');
  async function upload(user:typeof a.user){const f=await files.begin(user,'proposal.pdf',data.length);await files.upload(user,f.id,0,data);await files.complete(user,f.id);return f.id}
  const id=await upload(a.user),other=await upload(b.user);
  const listing=await extension.request(paired.envelope('files')) as any;assert.equal(listing.files.length,1);assert.equal(listing.files[0].id,id);
  await assert.rejects(extension.request(paired.envelope('file-share',{fileId:other})),/NOT_FOUND/);
  await assert.rejects(extension.request(paired.envelope('file-share',{fileId:id,plan:'team'})),/INVALID_FILE/);
  const share=await extension.request(paired.envelope('file-share',{fileId:id,label:'recipient@example.invalid'})) as any;assert.match(share.url,/\/dosya\/[A-Za-z0-9_-]{43}$/);
  await s.accounts.grant(a.user,'individual');await assert.rejects(extension.request(paired.envelope('files')),/FORBIDDEN/);await assert.rejects(extension.request(paired.envelope('file-share',{fileId:id})),/FORBIDDEN/);
  await s.accounts.grant(a.user,'team');await s.accounts.logout(a.token);await assert.rejects(extension.request(paired.envelope('files')),/FORBIDDEN/);
 }finally{await s.close()}
});
