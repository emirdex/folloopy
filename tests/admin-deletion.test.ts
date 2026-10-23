import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {openDatabase,migrate,type DB} from '../packages/database';
import {Accounts} from '../apps/api/accounts';
import {AdminService} from '../apps/api/admin';
import {TrackingService} from '../apps/api/service';
import {buildServer} from '../apps/api/server';
import {FakeProvider,type MailProvider} from '../packages/provider-adapters';
const password='Synthetic-deletion-test-2026!',key='synthetic-member-deletion-api-key-2026';
async function setup(){
 const db=await openDatabase();await migrate(db);const accounts=new Accounts(db,true);
 const ownerSession=await accounts.register('Owner','owner@deletion.invalid',password),session=await accounts.register('Delete member','member@deletion.invalid',password),otherSession=await accounts.register('Other member','other@deletion.invalid',password);
 await db.query('UPDATE users SET email_verified_at=now()');await db.query("UPDATE users SET role='owner' WHERE email='owner@deletion.invalid'");
 const actor=(await accounts.current(ownerSession.token))!,member=(await accounts.current(session.token))!,other=(await accounts.current(otherSession.token))!;
 await accounts.grant(member,'team');await accounts.grant(other,'individual');
 const {app}=buildServer(db,new FakeProvider(),key,'https://deletion.invalid',undefined,{production:true});
 const remove=(token:string|undefined=ownerSession.token,id=member.id,email=member.email,extra:Record<string,unknown>={})=>app.inject({method:'POST',url:'/api/admin/members/'+id+'/delete',headers:{authorization:'Bearer '+key,...(token?{'x-user-session':token}:{})},payload:{email,confirm:true,...extra}});
 return {db,accounts,actor,member,other,ownerSession,session,otherSession,app,remove};
}
async function seed(s:Awaited<ReturnType<typeof setup>>){
 const {db,member,actor,session,other}=s,w=member.workspace_id;
 const sent=await new TrackingService(db,new FakeProvider(),'https://deletion.invalid').send(w,'delete-fixture',{to:'recipient@example.invalid',subject:'Private member subject',text:'Private body',tracking:true});
 const otherMail=await new TrackingService(db,new FakeProvider(),'https://deletion.invalid').send(other.workspace_id,'other-fixture',{to:'other@example.invalid',subject:'Keep this message',text:'Keep',tracking:true});
 const event=randomUUID();await db.query("INSERT INTO raw_events(id,workspace_id,message_id,kind,occurred_at) VALUES($1,$2,$3,'image_fetch',now())",[event,w,sent.id]);await db.query("INSERT INTO event_assessments(event_id,workspace_id,source,identity_relation,reason_codes,classifier_version) VALUES($1,$2,'unknown','unknown','[]','test')",[event,w]);await db.query('INSERT INTO outbox(id,workspace_id,event_id) VALUES($1,$2,$3)',[randomUUID(),w,event]);
 await db.query("INSERT INTO mail_drafts(id,workspace_id,user_id,payload) VALUES($1,$2,$3,'synthetic-encrypted-draft')",[randomUUID(),w,member.id]);
 const campaign=randomUUID();await db.query("INSERT INTO bulk_campaigns(id,workspace_id,user_id,request_id,content_hash,payload,sender_email,total) VALUES($1,$2,$3,$4,'hash','encrypted','sender@example.invalid',1)",[campaign,w,member.id,randomUUID()]);await db.query("INSERT INTO bulk_recipients(id,campaign_id,workspace_id,position,payload,state,message_id) VALUES($1,$2,$3,0,'encrypted','sent',$4)",[randomUUID(),campaign,w,sent.id]);
 const device=randomUUID();await db.query("INSERT INTO extension_devices(id,user_id,workspace_id,session_hash,token_hash,public_key,sender,expires_at) VALUES($1,$2,$3,'session','secret','{}','sender@example.invalid',now()+interval '1 day')",[device,member.id,w]);await db.query('INSERT INTO extension_nonces(device_id,nonce) VALUES($1,$2)',[device,randomUUID()]);
 await db.query("INSERT INTO extension_pairs(id,challenge,public_key,user_id,session_hash,sender,expires_at) VALUES($1,'challenge','{}',$2,'session','sender@example.invalid',now()+interval '1 hour')",[randomUUID(),member.id]);
 await db.query("INSERT INTO mail_connections(workspace_id,email,refresh_token,scopes) VALUES($1,'sender@example.invalid','synthetic-secret','send')",[w]);
 await db.query("INSERT INTO account_tokens(token_hash,user_id,purpose,expires_at) VALUES('reset-token',$1,'reset',now()+interval '1 hour')",[member.id]);await db.query("INSERT INTO verification_codes(user_id,code_hash,expires_at) VALUES($1,'code',now()+interval '1 hour')",[member.id]);await db.query("INSERT INTO oauth_states(token_hash,user_id,session_hash,verifier,expires_at) VALUES('oauth-token',$1,'session','verifier',now()+interval '1 hour')",[member.id]);
 await db.query("INSERT INTO mail_outbox(id,user_id,payload) VALUES($1,$2,'synthetic-private-notification')",[randomUUID(),member.id]);await db.query("INSERT INTO account_email_changes(user_id,old_email,new_email,expires_at) VALUES($1,$2,'new@example.invalid',now()+interval '1 hour')",[member.id,member.email]);await db.query("INSERT INTO billing_profiles(user_id,workspace_id,profile) VALUES($1,$2,'{}')",[member.id,w]);
 const purchase=randomUUID();await db.query("INSERT INTO purchases(id,user_id,workspace_id,plan,mode,status,amount_minor,currency,message_limit,idempotency_key,source,completed_at) VALUES($1,$2,$3,'team','live','paid',54900,'TRY',500,'preserved-payment','test',now())",[purchase,member.id,w]);
 await db.query("INSERT INTO admin_audit(id,actor_id,action,target_id) VALUES($1,$2,'historical_action',$3)",[randomUUID(),member.id,purchase]);
 await db.query("INSERT INTO blog_posts(id,slug,title,excerpt,body,category,status,author_id) VALUES($1,'keep-public-content','Keep public content','Public excerpt','Public body','Test','published',$2)",[randomUUID(),member.id]);await db.query("INSERT INTO blog_media(name,mime,bytes,owner_id) VALUES('keep-public-image','image/png',$1,$2)",[Buffer.from('public-image'),member.id]);
 return {purchase,otherMail,tokenHash:createHash('sha256').update(session.token).digest('hex'),ownerId:actor.id};
}
test('member deletion requires verified ownership and explicit confirmation, removes private records atomically and preserves anonymous ledger/public content',async()=>{
 const s=await setup();try{
  const seeded=await seed(s);
  assert.equal((await s.remove('')).statusCode,401);assert.equal((await s.remove(s.session.token)).statusCode,403);
  assert.equal((await s.remove(s.ownerSession.token,s.actor.id,s.actor.email)).statusCode,403);
  assert.equal((await s.remove(undefined,undefined,undefined,{confirm:false})).statusCode,400);assert.equal((await s.remove(undefined,undefined,undefined,{extra:'forged'})).statusCode,400);
  assert.equal((await s.remove(undefined,undefined,'changed@example.invalid')).json().code,'MEMBER_CHANGED');
  await s.db.query('UPDATE users SET email_verified_at=NULL WHERE id=$1',[s.actor.id]);assert.equal((await s.remove()).statusCode,403);await s.db.query('UPDATE users SET email_verified_at=now() WHERE id=$1',[s.actor.id]);
  const response=await s.remove();assert.equal(response.statusCode,200,response.body);assert.deepEqual(response.json(),{deleted:true});
  assert.equal(await s.accounts.current(s.session.token),null);await assert.rejects(s.accounts.login(s.member.email,password),/INVALID_LOGIN/);
  for(const table of ['users','sessions','account_tokens','verification_codes','oauth_states','mail_outbox','account_email_changes','member_activity','billing_profiles','extension_pairs','extension_devices','mail_drafts']){const keyColumn=table==='users'?'id':'user_id';assert.equal((await s.db.query(`SELECT * FROM ${table} WHERE ${keyColumn}=$1`,[s.member.id])).rows.length,0,table)}
  for(const table of ['workspaces','entitlements','mail_connections','access_grants','preview_purchases','messages','raw_events','event_assessments','outbox','bulk_campaigns','bulk_recipients']){const keyColumn=table==='workspaces'?'id':'workspace_id';assert.equal((await s.db.query(`SELECT * FROM ${table} WHERE ${keyColumn}=$1`,[s.member.workspace_id])).rows.length,0,table)}
  assert.equal((await s.db.query('SELECT * FROM extension_nonces')).rows.length,0);
  assert.equal((await s.db.query('SELECT id FROM messages WHERE id=$1',[seeded.otherMail.id])).rows.length,1);assert.ok(await s.accounts.current(s.otherSession.token));assert.ok(await s.accounts.current(s.ownerSession.token));
  const admin=new AdminService(s.db,s.accounts),ledger=(await admin.purchases()).rows as any[];assert.equal(ledger.length,1);assert.equal(ledger[0].email,'Silinen üye');assert.equal(ledger[0].amount_minor,54900);assert.equal(ledger[0].user_id,null);assert.equal(ledger[0].workspace_id,null);assert.equal((await admin.purchase(seeded.purchase) as any).status,'paid');
  assert.equal((await s.db.query('SELECT author_id FROM blog_posts')).rows[0].author_id,null);assert.equal((await s.db.query('SELECT owner_id FROM blog_media')).rows[0].owner_id,s.actor.id);assert.equal((await s.db.query("SELECT actor_id FROM admin_audit WHERE action='historical_action'")).rows[0].actor_id,null);
  assert.equal((await s.db.query("SELECT target_id FROM admin_audit WHERE action='member_deleted'")).rows[0].target_id,s.member.id);
  assert.equal((await s.remove()).statusCode,404);
  const rejoined=await s.accounts.register('New member',s.member.email,password);assert.ok(rejoined.token);
 }finally{await s.app.close();await s.db.close()}
});
test('an in-flight provider send prevents deletion until the message completes',async()=>{
 const s=await setup();let release!:()=>void;try{
  let entered!:()=>void;const started=new Promise<void>(r=>{entered=r}),hold=new Promise<void>(r=>{release=r});
  const provider:MailProvider={name:'fake-delayed',send:async()=>{entered();await hold;return {providerMessageId:'synthetic-id',threadId:'synthetic-thread'}}};
  const sending=new TrackingService(s.db,provider,'https://deletion.invalid').send(s.member.workspace_id,'busy-fixture',{to:'recipient@example.invalid',subject:'Pending send',text:'Synthetic',tracking:true});
  await started;const blocked=await s.remove();assert.equal(blocked.statusCode,409);assert.equal(blocked.json().code,'MEMBER_BUSY');assert.ok(await s.accounts.current(s.session.token));
  release();await sending;assert.equal((await s.remove()).statusCode,200);
 }finally{release?.();await s.app.close();await s.db.close()}
});
test('a failed deletion audit rolls back the identity, sessions, private data and payment links together',async()=>{
 const s=await setup();try{
  const seeded=await seed(s);const failing:DB={...s.db,transaction:fn=>s.db.transaction(tx=>fn({...tx,query:async(sql,params)=>{if(sql.includes('INSERT INTO admin_audit'))throw Error('AUDIT_FAILED');return tx.query(sql,params)}}))};
  await assert.rejects(new AdminService(failing,s.accounts).deleteMember(s.actor,s.member.id,s.member.email),/AUDIT_FAILED/);
  assert.ok(await s.accounts.current(s.session.token));assert.equal((await s.db.query('SELECT id FROM mail_drafts WHERE user_id=$1',[s.member.id])).rows.length,1);assert.equal((await s.db.query('SELECT user_id FROM purchases WHERE id=$1',[seeded.purchase])).rows[0].user_id,s.member.id);assert.equal((await s.db.query('SELECT owner_id FROM blog_media')).rows[0].owner_id,s.member.id);assert.equal((await s.db.query("SELECT * FROM admin_audit WHERE action='member_deleted'")).rows.length,0);
 }finally{await s.app.close();await s.db.close()}
});
