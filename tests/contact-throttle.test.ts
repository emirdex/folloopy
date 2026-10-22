import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {ContactThrottle} from '../apps/web/lib/contact-throttle';
import {openDatabase,migrate} from '../packages/database';
import {buildServer} from '../apps/api/server';
import {UnavailableProvider} from '../packages/provider-adapters';

test('Changing forwarded IPs cannot bypass the email or global contact budget; windows recover',()=>{
 const local=new ContactThrottle();
 for(let i=0;i<5;i++)assert.equal(local.allow('Visitor@EXAMPLE.invalid','ip-'+i,1000),true);
 assert.equal(local.allow('visitor@example.invalid','forged-new-ip',1000),false);
 const rotated=new ContactThrottle();
 for(let i=0;i<50;i++)assert.equal(rotated.allow('rotated-'+i+'@example.invalid','forged-'+i,1000),true);
 assert.equal(rotated.allow('new@example.invalid','new-forged-ip',1000),false);
 assert.equal(rotated.allow('new@example.invalid','new-forged-ip',1000+900000),true);
});
test('Contact budget is private, schema checked, durable and shared by independent API instances',async()=>{
 const db=await openDatabase();await migrate(db);
 const key='contact-budget-synthetic-internal-key-2026';
 const a=buildServer(db,new UnavailableProvider(),key,'https://folloopy.example',undefined,{production:true,encryptionKey:randomBytes(32).toString('base64')}).app;
 const b=buildServer(db,new UnavailableProvider(),key,'https://folloopy.example',undefined,{production:true}).app;
 const call=(app:typeof a,email:string,authorized=true)=>app.inject({method:'POST',url:'/api/contact/limit',headers:authorized?{authorization:'Bearer '+key}:{},payload:{email}});
 try{
  assert.equal((await call(a,'visitor@example.invalid',false)).statusCode,401);
  assert.equal((await call(a,'bad-address')).statusCode,400);
  for(let i=0;i<5;i++)assert.equal((await call(a,'visitor@example.invalid')).statusCode,200);
  assert.equal((await call(b,'VISITOR@example.invalid')).statusCode,429);
  for(let i=0;i<45;i++)assert.equal((await call(i%2?a:b,'visitor-'+i+'@example.invalid')).statusCode,200);
  assert.equal((await call(b,'new@example.invalid')).statusCode,429);
  const persisted=(await db.query<{key:string}>('SELECT key FROM request_limits')).rows;
  assert.ok(persisted.every(row=>/^[a-f0-9]{64}$/.test(row.key)));
 }finally{await a.close();await b.close();await db.close()}
});
