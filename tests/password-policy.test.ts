import test from 'node:test';
import assert from 'node:assert/strict';
import {validNewPassword} from '../packages/domain/password-policy';
import {openDatabase,migrate} from '../packages/database/index';
import {FakeProvider} from '../packages/provider-adapters/index';
import {buildServer} from '../apps/api/server';
test('Şifre politikası 8 karakter, Unicode büyük/küçük harf ve özel karakter ister; rakam zorunlu değildir',()=>{
 for(const password of ['Abcdef!g','Şifre!ğü','Password1!'])assert.equal(validNewPassword(password),true);
 for(const password of ['Abcde!g','abcdefgh!','ABCDEFGH!','Abcdefgh','Abcdefg1','Abcdefg ','A!'+ 'a'.repeat(127)])assert.equal(validNewPassword(password),false);
});
test('Kayıt ve admin kurulum API’leri aynı kuralları uygular; 8 karakterli hesaplar giriş yapabilir',async()=>{
 const db=await openDatabase();await migrate(db);const key='password-policy-test-api-key-more-than-32-characters';const token='password-policy-admin-bootstrap-test-key-32-plus';
 const{app}=buildServer(db,new FakeProvider(),key,'http://localhost:4000',{email:'owner-policy@example.invalid',token});
 const call=(url:string,payload:Record<string,unknown>)=>app.inject({method:'POST',url,headers:{authorization:'Bearer '+key},payload});
 try{
  for(const password of ['Abcde!g','abcdefgh!','ABCDEFGH!','Abcdefg1','Abcdefg ']){
   assert.equal((await call('/api/auth/register',{name:'Test',email:'member-policy@example.invalid',password})).statusCode,400);
   assert.equal((await call('/api/admin/setup',{name:'Site sahibi',token,password})).statusCode,400);
  }
  const password='Abcdef!g';
  assert.equal((await call('/api/auth/register',{name:'Test',email:'member-policy@example.invalid',password})).statusCode,200);
  assert.equal((await call('/api/auth/login',{email:'member-policy@example.invalid',password})).statusCode,200);
  const admin=await call('/api/admin/setup',{name:'Site sahibi',token,password});assert.equal(admin.statusCode,200,admin.body);
  const login=await call('/api/auth/login',{email:'owner-policy@example.invalid',password});assert.equal(login.statusCode,200);
  const me=await app.inject({url:'/api/auth/me',headers:{authorization:'Bearer '+key,'x-user-session':login.json().token}});assert.equal(me.json().user.role,'owner');
 }finally{await app.close();await db.close()}
});
