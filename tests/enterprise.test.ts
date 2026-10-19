import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase,migrate} from '../packages/database/index';
import {buildServer} from '../apps/api/server';
import {FakeProvider} from '../packages/provider-adapters/index';
test('Enterprise talebi doğrulanır, kalıcı yazılır ve aynı kayıt çoğaltılmaz',async()=>{
 const db=await openDatabase();await migrate(db);const key='enterprise-test-key-at-least-32-characters';const{app}=buildServer(db,new FakeProvider(),key,'http://localhost:4000');
 const post=(payload:Record<string,unknown>,authorized=true)=>app.inject({method:'POST',url:'/api/enterprise-requests',headers:authorized?{authorization:'Bearer '+key}:{},payload});
 try{
  assert.equal((await post({email:'test@example.invalid',company:'Test şirketi'},false)).statusCode,401);
  for(const body of [{email:'invalid',company:'Test'},{email:'test@example.invalid',company:'  '},{email:'test@example.invalid',company:'Test\r\ncompany'},{email:'test@example.invalid',company:'Test',extra:'invalid'}])assert.equal((await post(body)).statusCode,400);
  assert.equal((await post({email:'TEST@example.invalid',company:' Test şirketi '})).statusCode,200);
  assert.equal((await post({email:'test@example.invalid',company:'Test şirketi'})).statusCode,200);
  const rows=(await db.query<{email:string;company:string}>('SELECT email,company FROM enterprise_requests')).rows;
  assert.deepEqual(rows,[{email:'test@example.invalid',company:'Test şirketi'}]);
 }finally{await app.close();await db.close()}
});
