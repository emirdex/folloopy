import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {openDatabase,migrate} from '../packages/database/index';
import {Accounts} from '../apps/api/accounts';
import {allowRequest} from '../apps/api/rate-limit';
test('PostgreSQL: concurrent migration, transaction rollback, durable accounts and bytea storage',{skip:!process.env.TEST_DATABASE_URL},async()=>{
 const db=await openDatabase(process.env.TEST_DATABASE_URL);let userId='',workspace='';try{await Promise.all([migrate(db),migrate(db)]);const accounts=new Accounts(db),email=randomUUID()+'@example.invalid';const{token}=await accounts.register('Postgres Integration',email,'Synthetic-test-password-2026!');const u=(await accounts.current(token))!;userId=u.id;workspace=u.workspace_id;assert.equal(u.email,email);
 const file=randomUUID()+'.png',bytes=Buffer.from([0,1,2,255]);await db.query('INSERT INTO blog_media(name,mime,bytes,owner_id) VALUES($1,$2,$3,$4)',[file,'image/png',bytes,u.id]);const stored=(await db.query<{bytes:Buffer}>('SELECT bytes FROM blog_media WHERE name=$1',[file])).rows[0];assert.deepEqual(stored.bytes,bytes);
 await assert.rejects(()=>db.transaction(async tx=>{await tx.query('UPDATE users SET name=$1 WHERE id=$2',['Wrong',u.id]);throw Error('rollback')}));assert.equal((await accounts.current(token))!.name,'Postgres Integration');assert.equal(await allowRequest(db,'postgres',email,1),true);assert.equal(await allowRequest(db,'postgres',email,1),false);
 }finally{if(userId){await db.query('DELETE FROM blog_media WHERE owner_id=$1',[userId]);await db.query('DELETE FROM sessions WHERE user_id=$1',[userId]);await db.query('DELETE FROM users WHERE id=$1',[userId]);await db.query('DELETE FROM workspaces WHERE id=$1',[workspace])}await db.close()}
});
