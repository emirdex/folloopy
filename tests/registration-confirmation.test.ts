import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
// Next aliases this build-time marker to an empty module on the server.
const hook=registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==='server-only')return {url:new URL('../node_modules/next/dist/compiled/server-only/empty.js',import.meta.url).href,shortCircuit:true};
 return nextResolve(specifier,context);
}});
const {registerAccount}=await import('../apps/web/app/account-actions');
hook.deregister();

test('registration rejects absent or different confirmation before accessing accounts',async()=>{
 const attempt=async(confirmation?:string)=>{
  const form=new FormData();
  for(const [key,value] of Object.entries({firstName:'Test',lastName:'User',email:'confirmation@example.invalid',password:'Synthetic-password-2026!'}))form.set(key,value);
  if(confirmation!==undefined)form.set('passwordConfirmation',confirmation);
  return registerAccount(null,form);
 };
 const [missing,different,extraSpace]=await Promise.all([attempt(),attempt('Another-password-2026!'),attempt('Synthetic-password-2026! ')]);
 assert.equal(missing?.error,'Şifrenizi tekrar girin.');
 assert.equal(different?.error,'Şifreler eşleşmiyor. Lütfen aynı şifreyi tekrar girin.');
 assert.equal(extraSpace?.error,different?.error);
});
