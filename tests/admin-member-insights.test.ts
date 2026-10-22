import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {openDatabase,migrate} from '../packages/database';
import {Accounts} from '../apps/api/accounts';
import {TrackingService} from '../apps/api/service';
import {FakeProvider} from '../packages/provider-adapters';
import {buildServer} from '../apps/api/server';
const key='admin-insights-internal-key-32-characters';
async function setup(){
 const db=await openDatabase();await migrate(db);const accounts=new Accounts(db);
 const owner=await accounts.register('Owner','owner@insights.invalid','Synthetic-Owner-2026!');const user=await accounts.register('Üye İnceleme','member@insights.invalid','Synthetic-Member-2026!');const other=await accounts.register('Diğer Üye','other@insights.invalid','Synthetic-Other-2026!');
 const admin=(await accounts.current(owner.token))!,member=(await accounts.current(user.token))!,outsider=(await accounts.current(other.token))!;
 await db.query("UPDATE users SET role='owner',email_verified_at=now() WHERE id=$1",[admin.id]);await db.query('UPDATE users SET email_verified_at=now() WHERE id=$1',[member.id]);await accounts.grant(member,'team');await accounts.grant(outsider,'team');
 await db.query('INSERT INTO mail_connections(workspace_id,email,refresh_token,scopes) VALUES($1,$2,$3,$4)',[member.workspace_id,'sender@insights.invalid','NEVER_SERIALIZE_REFRESH_TOKEN','https://www.googleapis.com/auth/gmail.send']);
 const server=buildServer(db,new FakeProvider(),key,'https://panel.example.invalid');await server.app.ready();
 const call=(path:string,token:string=owner.token,body?:any)=>server.app.inject({method:body===undefined?'GET':'POST',url:'/api'+path,headers:{authorization:'Bearer '+key,...(token?{'x-user-session':token}:{})},...(body===undefined?{}:{payload:body})});
 return {db,accounts,member,outsider,owner,user,other,call,app:server.app,async close(){await server.app.close();await db.close()}};
}
test('Owner-only member detail and paginated records redact credentials and isolate workspace data',async()=>{
 const s=await setup();try{
 const service=new TrackingService(s.db,new FakeProvider(),'https://panel.example.invalid');
 for(let i=0;i<43;i++)await service.send(s.member.workspace_id,'insight_'+i,{subject:'Kullanıcı maili '+i,to:'recipient@example.invalid',text:'PRIVATE_MAIL_BODY',tracking:true},undefined,undefined,i%2?'extension':'panel');
 await service.send(s.outsider.workspace_id,'other_insight_1',{subject:'OTHER_WORKSPACE_SUBJECT',to:'other@example.invalid',text:'OTHER_PRIVATE_BODY',tracking:true});
 const deviceId=randomUUID();await s.db.query('INSERT INTO extension_devices(id,user_id,workspace_id,session_hash,token_hash,public_key,sender,expires_at,last_seen_at) VALUES($1,$2,$3,$4,$5,$6,$7,now()+interval \'7 days\',now())',[deviceId,s.member.id,s.member.workspace_id,createHash('sha256').update(s.user.token).digest('hex'),'NEVER_SERIALIZE_DEVICE_TOKEN','{}','sender@insights.invalid']);
 for(const suffix of ['', '/activity','/messages']){const path='/admin/members/'+s.member.id+suffix;assert.equal((await s.call(path,'')).statusCode,401);assert.equal((await s.call(path,s.user.token)).statusCode,403);}
 const response=await s.call('/admin/members/'+s.member.id);assert.equal(response.statusCode,200,response.body);const data=response.json();
 assert.equal(data.user.message_count,43);assert.equal(data.summary.sent,43);assert.equal(data.summary.panel_count,22);assert.equal(data.summary.extension_count,21);assert.equal(data.connection.provider,'gmail');assert.equal(data.connection.send_permission,true);assert.equal(data.extension.active_count,1);assert.equal(data.sessions.active_count,1);
 for(const forbidden of ['password_hash','token_hash','session_hash','refresh_token','public_key','NEVER_SERIALIZE','PRIVATE_MAIL_BODY','OTHER_WORKSPACE_SUBJECT','OTHER_PRIVATE_BODY'])assert.ok(!response.body.includes(forbidden),forbidden);
 assert.equal(data.messages.rows.length,40);const more=(await s.call('/admin/members/'+s.member.id+'/messages?offset=40')).json();assert.equal(more.rows.length,3);assert.equal(new Set([...data.messages.rows,...more.rows].map(x=>x.id)).size,43);
 assert.equal(data.activity.rows.length,40);assert.ok(data.activity.total>=45);const next=(await s.call('/admin/members/'+s.member.id+'/activity?offset=40')).json();assert.ok(next.rows.length>0);assert.ok(!next.rows.some((x:any)=>data.activity.rows.some((y:any)=>y.id===x.id)));
 assert.equal((await s.call('/admin/members/'+randomUUID()+'/activity')).statusCode,404);assert.equal((await s.call('/admin/members/'+s.member.id+'/messages?offset=-1')).statusCode,400);
 await s.db.query("UPDATE users SET role='member' WHERE email='owner@insights.invalid'");assert.equal((await s.call('/admin/members/'+s.member.id+'/messages')).statusCode,403);
 }finally{await s.close()}
});
test('Extension status checks current entitlement, sender, revocation, expiry and session rather than presence alone',async()=>{
 const s=await setup();try{
 const id=randomUUID();await s.db.query('INSERT INTO extension_devices(id,user_id,workspace_id,session_hash,token_hash,public_key,sender,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,now()+interval \'7 days\')',[id,s.member.id,s.member.workspace_id,createHash('sha256').update(s.user.token).digest('hex'),'secret','{}','sender@insights.invalid']);
 const detail=async()=>(await s.call('/admin/members/'+s.member.id)).json();assert.equal((await detail()).extension.active_count,1);
 await s.db.query("INSERT INTO preview_purchases(workspace_id,plan) VALUES($1,'team')",[s.member.workspace_id]);await s.db.query('DELETE FROM access_grants WHERE workspace_id=$1',[s.member.workspace_id]);assert.equal((await detail()).extension.active_count,0);await s.accounts.grant(s.member,'team');
 await s.accounts.grant(s.member,'individual');assert.equal((await detail()).extension.devices[0].reason,'plan_or_verification');await s.accounts.grant(s.member,'team');
 await s.db.query("UPDATE mail_connections SET email='changed@example.invalid' WHERE workspace_id=$1",[s.member.workspace_id]);assert.equal((await detail()).extension.devices[0].reason,'sender_changed');await s.db.query("UPDATE mail_connections SET email='sender@insights.invalid' WHERE workspace_id=$1",[s.member.workspace_id]);
 await s.db.query('UPDATE extension_devices SET revoked=true WHERE id=$1',[id]);assert.equal((await detail()).extension.devices[0].reason,'revoked');await s.db.query("UPDATE extension_devices SET revoked=false,expires_at=now()-interval '1 minute' WHERE id=$1",[id]);assert.equal((await detail()).extension.devices[0].reason,'expired');await s.db.query("UPDATE extension_devices SET expires_at=now()+interval '1 day' WHERE id=$1",[id]);
 await s.accounts.logout(s.user.token);const data=await detail();assert.equal(data.extension.active_count,0);assert.equal(data.extension.devices[0].reason,'session_closed');assert.equal(data.sessions.active_count,0);assert.ok(data.activity.rows.some((x:any)=>x.type==='logout'));
 }finally{await s.close()}
});
test('Audit logs only successful allowlisted mutations and never stores form bodies',async()=>{
 const s=await setup();try{
 assert.equal((await s.call('/account/profile',s.user.token,{name:'Güncel İsim'})).statusCode,200);
 assert.equal((await s.call('/account/profile',s.user.token,{name:''})).statusCode,400);
 const service=new TrackingService(s.db,new FakeProvider(),'https://panel.example.invalid');const message=await service.send(s.member.workspace_id,'audit-tracking-stop',{subject:'Takip testi',to:'recipient@example.invalid',text:'Private',tracking:true});assert.equal((await s.call('/messages/'+message.id+'/stop',s.user.token,{})).statusCode,200);assert.equal((await s.db.query("SELECT id FROM member_activity WHERE user_id=$1 AND action='tracking_stopped'",[s.member.id])).rows.length,1);
 const rows=(await s.db.query<any>("SELECT action FROM member_activity WHERE user_id=$1 AND action='profile_updated'",[s.member.id])).rows;assert.equal(rows.length,1);
 assert.equal((await s.call('/account/billing',s.user.token,{kind:'individual',name:'Fatura Adı',email:'invoice@example.invalid',city:'İstanbul',district:'Kadıköy',address:'Sentetik fatura adresi 123',postalCode:'34000'})).statusCode,200);
 await s.db.query("INSERT INTO account_email_changes(user_id,old_email,new_email,old_token_hash,new_token_hash,expires_at) VALUES($1,$2,'new@example.invalid','NEVER_SERIALIZE_OLD','NEVER_SERIALIZE_NEW',now()+interval '1 hour')",[s.member.id,s.member.email]);
 const detailResponse=await s.call('/admin/members/'+s.member.id);assert.equal(detailResponse.headers['cache-control'],'no-store');assert.ok(!detailResponse.body.includes('NEVER_SERIALIZE'));const detail=detailResponse.json();assert.equal(detail.security.pending_email_change.new_email,'new@example.invalid');assert.equal(detail.billing.profile.address,'Sentetik fatura adresi 123');assert.ok(detail.activity.rows.some((x:any)=>x.type==='billing_updated'));assert.ok(!JSON.stringify(detail.activity).includes('Sentetik fatura adresi'));
 }finally{await s.close()}
});
test('Migration preserves uncertain historical origin and only backfills a proven bulk relationship',async()=>{
 const s=await setup();try{
 const service=new TrackingService(s.db,new FakeProvider(),'https://panel.example.invalid');const ext=await service.send(s.member.workspace_id,'ext_old_idempotency',{subject:'Belirsiz eski kaynak',to:'recipient@example.invalid',text:'Private',tracking:false});const bulk=await service.send(s.member.workspace_id,'old_bulk_idempotency',{subject:'Eski toplu kayıt',to:'recipient@example.invalid',text:'Private',tracking:false});
 const campaign=randomUUID();await s.db.query("INSERT INTO bulk_campaigns(id,workspace_id,user_id,request_id,content_hash,payload,sender_email,total) VALUES($1,$2,$3,$4,'hash','encrypted','sender@insights.invalid',1)",[campaign,s.member.workspace_id,s.member.id,randomUUID()]);await s.db.query("INSERT INTO bulk_recipients(id,campaign_id,workspace_id,position,payload,state,message_id) VALUES($1,$2,$3,0,'encrypted','sent',$4)",[randomUUID(),campaign,s.member.workspace_id,bulk.id]);
 await s.db.query('ALTER TABLE messages DROP COLUMN send_channel');await s.db.query('DROP TABLE member_activity');await s.db.query('DELETE FROM schema_migrations WHERE version=14');await migrate(s.db);await migrate(s.db);
 const rows=(await s.db.query<any>('SELECT id,send_channel FROM messages WHERE workspace_id=$1',[s.member.workspace_id])).rows;assert.equal(rows.find(r=>r.id===ext.id).send_channel,'legacy');assert.equal(rows.find(r=>r.id===bulk.id).send_channel,'bulk');
 }finally{await s.close()}
});
