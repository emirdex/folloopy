import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {openDatabase,migrate,type DB} from '../packages/database';
import type {Account} from '../apps/api/accounts';
import {BulkMail} from '../apps/api/bulk-mail';
import {seal} from '../packages/runtime/vault';

for(const kind of ['embedded','postgres'] as const)test(`${kind}: bulk history counts use two queries and preserve page and tenant boundaries`,{skip:kind==='postgres'&&!process.env.TEST_DATABASE_URL},async()=>{
 const db=await openDatabase(kind==='postgres'?process.env.TEST_DATABASE_URL:undefined),rollback=new Error('rollback synthetic audit data');
 try{
  await migrate(db);
  await assert.rejects(()=>db.transaction(async tx=>{
   const key=randomBytes(32).toString('base64');
   const member=async():Promise<Account>=>{
    const user:Account={id:randomUUID(),workspace_id:randomUUID(),name:'Synthetic bulk audit',email:randomUUID()+'@example.invalid',role:'member',plan:'team'};
    await tx.query('INSERT INTO workspaces(id,name) VALUES($1,$2)',[user.workspace_id,user.name]);
    await tx.query('INSERT INTO users(id,workspace_id,name,email,password_hash) VALUES($1,$2,$3,$4,$5)',[user.id,user.workspace_id,user.name,user.email,'synthetic-not-a-login']);
    return user;
   };
   const user=await member(),outsider=await member();
   const states=['queued','sending','sent','unknown','failed','cancelled'] as const;
   for(let i=0;i<24;i++){
    const owner=i===23?outsider:user,id=randomUUID();
    await tx.query("INSERT INTO bulk_campaigns(id,workspace_id,user_id,request_id,content_hash,payload,sender_email,total,status,created_at) VALUES($1,$2,$3,$4,'synthetic',$5,'sender@example.invalid',6,$6,now()-($7::text||' minutes')::interval)",[id,owner.workspace_id,owner.id,randomUUID(),seal(JSON.stringify({name:'Campaign '+i,subject:'Synthetic '+i,text:'Synthetic',tracking:false,duplicates:0}),key),i===22?'draft':'completed',i]);
    for(let position=0;position<states.length;position++)await tx.query('INSERT INTO bulk_recipients(id,campaign_id,workspace_id,position,payload,state) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),id,owner.workspace_id,position,'synthetic',states[position]]);
   }
   let queries=0;
   const measured:DB={...tx,query:async<T>(sql:string,params?:unknown[])=>{queries++;return tx.query<T>(sql,params)}};
   const gateway={status:async()=>({configured:false,connected:false,email:null}),provider:async()=>{throw Error('must not send')}};
   const bulk=new BulkMail(measured,gateway,key,'https://example.invalid');
   const {campaigns}=await bulk.list(user);
   assert.equal(queries,2);assert.equal(campaigns.length,20);
   assert.deepEqual(campaigns.map(c=>c.name),Array.from({length:20},(_,i)=>'Campaign '+i));
   for(const campaign of campaigns)assert.deepEqual(campaign.counts,{queued:1,sending:1,sent:1,unknown:1,failed:1,cancelled:1});
   queries=0;assert.deepEqual(await bulk.list({...user,workspace_id:randomUUID()}),{campaigns:[]});assert.equal(queries,1);
   throw rollback;
  }),error=>error===rollback);
 }finally{await db.close()}
});
