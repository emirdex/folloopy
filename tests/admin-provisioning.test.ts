import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {openDatabase,migrate,type DB} from '../packages/database';
import {Accounts} from '../apps/api/accounts';
import {AdminService} from '../apps/api/admin';
import {buildServer} from '../apps/api/server';
import {UnavailableProvider} from '../packages/provider-adapters';
const password='Synthetic-member-password-2026!',key='synthetic-admin-provisioning-key-32-characters';

test('only a verified owner can provision members; package, identity and email verification remain separate',async()=>{
 const db=await openDatabase();await migrate(db);const accounts=new Accounts(db,true);
 const owner=await accounts.register('Site owner','owner@example.invalid',password),member=await accounts.register('Existing member','existing@example.invalid',password);
 await db.query("UPDATE users SET role='owner' WHERE email='owner@example.invalid'");
 const {app}=buildServer(db,new UnavailableProvider(),key,'https://folloopy.example',undefined,{production:true,encryptionKey:randomBytes(32).toString('base64')});
 const call=(payload:Record<string,unknown>,token?:string)=>app.inject({method:'POST',url:'/api/admin/members',headers:{authorization:'Bearer '+key,...(token?{'x-user-session':token}:{})},payload});
 const payload={name:'Package member',email:'package@example.invalid',password,plan:'individual'};
 try{
  assert.equal((await call(payload)).statusCode,401);
  assert.equal((await call(payload,member.token)).statusCode,403);
  assert.equal((await call(payload,owner.token)).json().code,'EMAIL_NOT_VERIFIED');
  await db.query('UPDATE users SET email_verified_at=now() WHERE email=$1',['owner@example.invalid']);
  for(const extra of [{role:'owner'},{plan:'business'},{password:'123456'}])assert.equal((await call({...payload,...extra},owner.token)).statusCode,400);
  for(const [plan,limit] of [['individual',100],['team',500]] as const){
   const email=plan+'@example.invalid';
   const response=await call({...payload,email,plan},owner.token);assert.equal(response.statusCode,200,response.body);
   assert.deepEqual(Object.keys(response.json()).sort(),['email','id','name','plan']);
   assert.ok(!response.body.includes(password));
   const row=(await db.query<{role:string;email_verified_at:string|null;plan:string;message_limit:number;used:number;password_hash:string}>(`SELECT u.role,u.email_verified_at,u.password_hash,g.plan,e.message_limit,e.used FROM users u JOIN access_grants g ON g.workspace_id=u.workspace_id JOIN entitlements e ON e.workspace_id=u.workspace_id WHERE u.email=$1`,[email])).rows[0];
   assert.equal(row.role,'member');assert.equal(row.email_verified_at,null);assert.equal(row.plan,plan);assert.equal(row.message_limit,limit);assert.equal(row.used,0);assert.ok(!row.password_hash.includes(password));
   assert.equal((await db.query('SELECT * FROM sessions WHERE user_id=$1',[response.json().id])).rows.length,0);
   const login=await accounts.login(email,password);const user=await accounts.current(login.token);assert.equal(user?.plan,plan);
   const messages=await app.inject({url:'/api/messages',headers:{authorization:'Bearer '+key,'x-user-session':login.token}});assert.equal(messages.statusCode,403);assert.equal(messages.json().code,'EMAIL_NOT_VERIFIED');
  }
  const workspaces=(await db.query('SELECT id FROM workspaces')).rows.length;
  assert.equal((await call({...payload,email:'INDIVIDUAL@example.invalid',password:'Different-password-2026!'},owner.token)).statusCode,409);
  assert.equal((await db.query('SELECT id FROM workspaces')).rows.length,workspaces);
  await accounts.login('individual@example.invalid',password);
  assert.equal((await db.query("SELECT * FROM admin_audit WHERE action='member_created_with_plan'")).rows.length,2);
  assert.equal((await db.query('SELECT * FROM purchases')).rows.length,0);
 }finally{await app.close();await db.close()}
});

test('a failed audit rolls back the member, workspace and package together',async()=>{
 const db=await openDatabase();await migrate(db);const accounts=new Accounts(db,true);
 const session=await accounts.register('Site owner','owner@example.invalid',password);
 await db.query("UPDATE users SET role='owner',email_verified_at=now()");const actor=(await accounts.current(session.token))!;
 const failing:DB={...db,transaction:fn=>db.transaction(tx=>fn({...tx,query:async(sql,params)=>{if(sql.includes('INSERT INTO admin_audit'))throw Error('AUDIT_FAILED');return tx.query(sql,params)}}))};
 try{
  await assert.rejects(new AdminService(failing,accounts).createMember(actor,{name:'Atomic member',email:'atomic@example.invalid',password,plan:'team'}),/AUDIT_FAILED/);
  assert.equal((await db.query('SELECT * FROM users')).rows.length,1);
  assert.equal((await db.query('SELECT * FROM workspaces')).rows.length,1);
  assert.equal((await db.query('SELECT * FROM access_grants')).rows.length,0);
 }finally{await db.close()}
});
