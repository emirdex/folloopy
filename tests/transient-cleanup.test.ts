import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {openDatabase,migrate} from '../packages/database';
import {Accounts} from '../apps/api/accounts';
import {AccountSecurity} from '../apps/api/account-security';
test('Maintenance removes only obsolete pairing/device/replay data and expired sessions, preserving active login and member records',async()=>{
 const db=await openDatabase();await migrate(db);try{
  const accounts=new Accounts(db,true),a=await accounts.register('Cleanup member','cleanup@example.invalid','Synthetic-password-2026!');const user=(await accounts.current(a.token))!;const active=randomUUID(),expired=randomUUID(),revoked=randomUUID();
  for(const id of [active,expired,revoked])await db.query("INSERT INTO extension_devices(id,user_id,workspace_id,session_hash,token_hash,public_key,sender,expires_at,revoked) VALUES($1,$2,$3,'synthetic','synthetic','{}','sender@example.invalid',now()+interval '1 day',$4)",[id,user.id,user.workspace_id,id===revoked]);
  await db.query("UPDATE extension_devices SET expires_at=now()-interval '1 minute' WHERE id=$1",[expired]);
  const oldNonce=randomUUID(),freshNonce=randomUUID();await db.query("INSERT INTO extension_nonces(device_id,nonce,created_at) VALUES($1,$2,now()-interval '6 minutes'),($1,$3,now())",[active,oldNonce,freshNonce]);
  const oldPair=randomUUID(),validPair=randomUUID();await db.query("INSERT INTO extension_pairs(id,challenge,public_key,expires_at) VALUES($1,'synthetic','{}',now()-interval '1 minute'),($2,'synthetic','{}',now()+interval '5 minutes')",[oldPair,validPair]);
  await db.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES('synthetic-expired-session',$1,now()-interval '1 minute')",[user.id]);
  await new AccountSecurity(db,'https://panel.example',randomBytes(32).toString('base64')).cleanup();
  assert.deepEqual((await db.query<{id:string}>('SELECT id FROM extension_devices')).rows.map(r=>r.id),[active]);assert.deepEqual((await db.query<{nonce:string}>('SELECT nonce FROM extension_nonces')).rows.map(r=>r.nonce),[freshNonce]);assert.deepEqual((await db.query<{id:string}>('SELECT id FROM extension_pairs')).rows.map(r=>r.id),[validPair]);assert.ok(await accounts.current(a.token));assert.equal((await db.query('SELECT id FROM users')).rows.length,1);assert.equal((await db.query('SELECT * FROM sessions')).rows.length,1);
 }finally{await db.close()}
});
