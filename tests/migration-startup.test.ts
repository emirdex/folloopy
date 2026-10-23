import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase,migrate,LATEST_SCHEMA_VERSION,type DB} from '../packages/database';

test('A current database starts with one read and no migration transactions',async()=>{
 const db=await openDatabase();
 try{
  await migrate(db);
  assert.equal((await db.query<{version:number}>('SELECT max(version) AS version FROM schema_migrations')).rows[0].version,LATEST_SCHEMA_VERSION);
  let reads=0,transactions=0;
  const measured:DB={...db,query:async<T>(sql:string,params?:unknown[])=>{reads++;return db.query<T>(sql,params)},transaction:async fn=>{transactions++;return db.transaction(fn)}};
  await migrate(measured);assert.equal(reads,1);assert.equal(transactions,0);
 }finally{await db.close()}
});

test('Startup does not hide a database connection failure as an empty schema',async()=>{
 let transactions=0;
 const failure=Object.assign(new Error('synthetic database failure'),{code:'08006'});
 const db:DB={query:async()=>{throw failure},transaction:async()=>{transactions++;throw Error('must not migrate')},close:async()=>{}};
 await assert.rejects(()=>migrate(db),error=>error===failure);assert.equal(transactions,0);
});
