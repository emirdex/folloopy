import {consumeBucket,bucketUsed,usagePeriod} from '../apps/api/package-usage';
import {TrackingService} from '../apps/api/service';
import {FakeProvider} from '../packages/provider-adapters';
import {freeUsage} from '../apps/api/free-usage';
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {openDatabase,migrate} from '../packages/database/index';
import {Accounts} from '../apps/api/accounts';
import {allowRequest} from '../apps/api/rate-limit';
test('PostgreSQL: concurrent migration, transaction rollback, durable accounts and bytea storage',{skip:!process.env.TEST_DATABASE_URL},async()=>{
 const db=await openDatabase(process.env.TEST_DATABASE_URL);let userId='',workspace='';try{await Promise.all([migrate(db),migrate(db)]);const accounts=new Accounts(db),email=randomUUID()+'@example.invalid';const{token}=await accounts.register('Postgres Integration',email,'Synthetic-test-password-2026!',{free:true});const u=(await accounts.current(token))!;userId=u.id;workspace=u.workspace_id;assert.equal(u.email,email);
 const service=new TrackingService(db,new FakeProvider(),'https://example.invalid'),sends=await Promise.allSettled(Array.from({length:6},()=>service.send(workspace,randomUUID(),{subject:'PG concurrency',text:'Synthetic body',to:'recipient@example.invalid',tracking:false})));assert.equal(sends.filter(r=>r.status==='fulfilled').length,3);assert.equal(sends.filter(r=>r.status==='rejected'&&r.reason.message==='FREE_DAILY_LIMIT').length,3);assert.equal((await freeUsage(db,workspace)).used,3);
 const period=await usagePeriod(db,true),bucket=await Promise.allSettled(Array.from({length:12},()=>db.transaction(tx=>consumeBucket(tx,workspace,'link_month',period,1,10))));assert.equal(bucket.filter(r=>r.status==='fulfilled').length,10);assert.equal(bucket.filter(r=>r.status==='rejected'&&r.reason.message==='PACKAGE_QUOTA_REACHED').length,2);assert.equal(await bucketUsed(db,workspace,'link_month',period),10);
 const file=randomUUID()+'.png',bytes=Buffer.from([0,1,2,255]);await db.query('INSERT INTO blog_media(name,mime,bytes,owner_id) VALUES($1,$2,$3,$4)',[file,'image/png',bytes,u.id]);const stored=(await db.query<{bytes:Buffer}>('SELECT bytes FROM blog_media WHERE name=$1',[file])).rows[0];assert.deepEqual(stored.bytes,bytes);
 await assert.rejects(()=>db.transaction(async tx=>{await tx.query('UPDATE users SET name=$1 WHERE id=$2',['Wrong',u.id]);throw Error('rollback')}));assert.equal((await accounts.current(token))!.name,'Postgres Integration');assert.equal(await allowRequest(db,'postgres',email,1),true);assert.equal(await allowRequest(db,'postgres',email,1),false);
 }finally{if(userId){await db.query('DELETE FROM messages WHERE workspace_id=$1',[workspace]);await db.query('DELETE FROM access_grants WHERE workspace_id=$1',[workspace]);await db.query('DELETE FROM entitlements WHERE workspace_id=$1',[workspace]);await db.query('DELETE FROM blog_media WHERE owner_id=$1',[userId]);await db.query('DELETE FROM sessions WHERE user_id=$1',[userId]);await db.query('DELETE FROM users WHERE id=$1',[userId]);await db.query('DELETE FROM workspaces WHERE id=$1',[workspace])}await db.close()}
});
