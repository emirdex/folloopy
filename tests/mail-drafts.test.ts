import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {openDatabase,migrate} from '../packages/database';
import {buildServer} from '../apps/api/server';
import {Accounts} from '../apps/api/accounts';
import {UnavailableProvider} from '../packages/provider-adapters';
const key='mail-draft-api-test-key-with-32-characters',encryptionKey=randomBytes(32).toString('base64');
const input={title:'İlk görüşme',subject:'Proje teklifi',to:'recipient@example.invalid',text:'Merhaba, proje teklifimizi iletiyorum.',tracking:true};
async function setup(){
 const db=await openDatabase();await migrate(db);await migrate(db);
 const{app}=buildServer(db,new UnavailableProvider(),key,'https://tracking.example',undefined,{production:true,site:'https://panel.example',encryptionKey});
 const accounts=new Accounts(db,true);
 async function create(email:string,plan?:'individual'|'team',verified=true){const{token}=await accounts.register('Draft Member',email,'Synthetic-draft-password-2026!');if(verified)await db.query('UPDATE users SET email_verified_at=now() WHERE email=$1',[email]);const user=(await accounts.current(token))!;if(plan)await accounts.grant(user,plan);return {token,user:(await accounts.current(token))!}}
 const call=(url:string,token?:string,body?:unknown)=>app.inject({method:body===undefined?'GET':'POST',url,headers:{authorization:'Bearer '+key,...(token?{'x-user-session':token}:{})},...(body===undefined?{}:{payload:body as any})});
 return {db,app,accounts,create,call,close:async()=>{await app.close();await db.close()}};
}
test('Essential allows one saved draft; edits, stale versions, deletion and encrypted persistence',async()=>{
 const s=await setup();try{
  const a=await s.create('draft-essential@example.invalid','individual');
  let result=await s.call('/api/drafts',a.token,{...input,subject:'',to:'',text:''});assert.equal(result.statusCode,200,result.body);let draft=result.json();
  assert.equal((await s.call('/api/drafts',a.token,input)).json().code,'DRAFT_LIMIT_REACHED');
  result=await s.call('/api/drafts/'+draft.id,a.token,{...input,version:1});assert.equal(result.statusCode,200,result.body);draft=result.json();assert.equal(draft.version,2);
  assert.equal((await s.call('/api/drafts/'+draft.id,a.token,{...input,text:'Overwritten',version:1})).json().code,'STALE_DRAFT');
  assert.equal((await s.call('/api/drafts/'+draft.id,a.token)).json().text,input.text);
  const list=(await s.call('/api/drafts',a.token)).json();assert.equal(list.used,1);assert.equal(list.limit,1);assert.equal(list.drafts[0].locked,false);
  const row=(await s.db.query<{payload:string}>('SELECT payload FROM mail_drafts')).rows[0];assert.equal(row.payload.includes(input.text),false);assert.equal(row.payload.includes(input.to),false);
  assert.equal((await s.call('/api/drafts/'+draft.id+'/delete',a.token,{version:1})).json().code,'STALE_DRAFT');
  assert.equal((await s.call('/api/drafts/'+draft.id+'/delete',a.token,{version:2})).statusCode,200);
  assert.equal((await s.call('/api/drafts/'+draft.id,a.token)).statusCode,404);
  assert.equal((await s.call('/api/drafts',a.token,input)).statusCode,200);
  assert.equal((await s.db.query<{used:number}>('SELECT used FROM entitlements WHERE workspace_id=$1',[a.user.workspace_id])).rows[0].used,0);
  assert.equal((await s.db.query('SELECT id FROM messages')).rows.length,0);
 }finally{await s.close()}
});
test('Signature quota is atomic at ten and draft IDs cannot cross accounts',async()=>{
 const s=await setup();try{
  const a=await s.create('draft-signature@example.invalid','team'),b=await s.create('draft-other@example.invalid','team');
  const results=await Promise.all(Array.from({length:11},(_,i)=>s.call('/api/drafts',a.token,{...input,title:'Taslak '+i})));
  assert.equal(results.filter(r=>r.statusCode===200).length,10);assert.equal(results.filter(r=>r.json().code==='DRAFT_LIMIT_REACHED').length,1);
  const list=(await s.call('/api/drafts',a.token)).json();assert.equal(list.used,10);assert.equal(list.limit,10);
  const draft=list.drafts[0];assert.equal((await s.call('/api/drafts',b.token)).json().used,0);
  assert.equal((await s.call('/api/drafts/'+draft.id,b.token)).statusCode,404);
  assert.equal((await s.call('/api/drafts/'+draft.id,b.token,{...input,version:1})).statusCode,404);
  assert.equal((await s.call('/api/drafts/'+draft.id+'/delete',b.token,{version:1})).statusCode,404);
  assert.equal((await s.call('/api/drafts/'+draft.id,a.token)).json().text,input.text);
  const absent=randomUUID();assert.equal((await s.call('/api/drafts/'+absent,a.token,{...input,version:1})).statusCode,404);
 }finally{await s.close()}
});
test('Downgrades preserve contents, lock excess drafts, and enforce the current plan on every request',async()=>{
 const s=await setup();try{
  const a=await s.create('draft-downgrade@example.invalid','team');
  for(let i=0;i<3;i++)assert.equal((await s.call('/api/drafts',a.token,{...input,title:'Taslak '+i})).statusCode,200);
  await s.accounts.grant(a.user,'individual');
  const list=(await s.call('/api/drafts',a.token)).json();assert.equal(list.used,3);assert.equal(list.limit,1);assert.equal(list.drafts.filter((d:any)=>!d.locked).length,1);
  const locked=list.drafts[1];assert.equal(locked.text,'');assert.equal(locked.to,'');
  assert.equal((await s.call('/api/drafts/'+locked.id,a.token)).json().code,'DRAFT_PLAN_LIMIT');
  assert.equal((await s.call('/api/drafts/'+locked.id,a.token,{...input,version:1})).json().code,'DRAFT_PLAN_LIMIT');
  assert.equal((await s.call('/api/drafts',a.token,input)).json().code,'DRAFT_LIMIT_REACHED');
  await s.accounts.grant(a.user,'team');assert.equal((await s.call('/api/drafts/'+locked.id,a.token)).json().text,input.text);
  assert.equal((await s.call('/api/drafts',a.token)).json().drafts.filter((d:any)=>d.locked).length,0);
  await s.db.query("UPDATE entitlements SET status='suspended' WHERE workspace_id=$1",[a.user.workspace_id]);assert.equal((await s.call('/api/drafts',a.token)).statusCode,403);
 }finally{await s.close()}
});
test('Draft access requires verified membership, and malformed or injected fields are rejected',async()=>{
 const s=await setup();try{
  const a=await s.create('draft-valid@example.invalid','individual'),unverified=await s.create('draft-unverified@example.invalid',undefined,false),noPlan=await s.create('draft-no-plan@example.invalid');
  assert.equal((await s.call('/api/drafts')).statusCode,401);assert.equal((await s.call('/api/drafts',undefined,input)).statusCode,401);
  assert.equal((await s.call('/api/drafts',unverified.token)).json().code,'EMAIL_NOT_VERIFIED');assert.equal((await s.call('/api/drafts',unverified.token,input)).statusCode,403);
  assert.equal((await s.call('/api/drafts',noPlan.token)).json().code,'PLAN_REQUIRED');
  for(const bad of [{...input,title:' '},{...input,subject:'Header\r\nInjected'},{...input,to:'invalid-address'},{...input,text:'x'.repeat(10001)},{...input,workspace_id:a.user.workspace_id},{...input,plan:'team'}])assert.equal((await s.call('/api/drafts',a.token,bad)).statusCode,400);
  assert.equal((await s.call('/api/drafts/not-a-uuid',a.token)).statusCode,400);
  assert.equal((await s.call('/api/drafts',a.token)).json().used,0);
 }finally{await s.close()}
});
