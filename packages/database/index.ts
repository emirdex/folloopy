import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import { readFile } from 'node:fs/promises';
export interface DB { kind?:'postgres'|'embedded'; query<T=Record<string,unknown>>(sql:string,params?:unknown[]):Promise<{rows:T[]}>; transaction<T>(fn:(db:DB)=>Promise<T>):Promise<T>; close():Promise<void> }
export async function openDatabase(url?:string, directory?:string):Promise<DB>{
 if(url){
  const connection=new URL(url),secure=process.env.NODE_ENV==='production';
  if(secure)for(const key of ['sslmode','sslcert','sslkey','sslrootcert'])connection.searchParams.delete(key);
  const pool=new pg.Pool({connectionString:connection.toString(),...(secure?{ssl:{rejectUnauthorized:true,...(process.env.DATABASE_SSL_CA?{ca:process.env.DATABASE_SSL_CA}:{})}}:{}),max:8,connectionTimeoutMillis:10000,idleTimeoutMillis:30000,statement_timeout:15000});
  const wrap=(client:pg.Pool|pg.PoolClient):DB=>({kind:'postgres',
   query:async<T>(sql:string,params?:unknown[])=>({rows:(await client.query(sql,params)).rows as T[]}),
   transaction:async<T>(fn:(db:DB)=>Promise<T>)=>{
    const c=await pool.connect();
    try{await c.query('BEGIN');const result=await fn(wrap(c));await c.query('COMMIT');return result;}
    catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
   },close:()=>pool.end()
  });
  return wrap(pool);
 }
 const lite=new PGlite(directory);
 await lite.waitReady;
 const wrap=(client:any):DB=>({kind:'embedded',query:<T>(sql:string,params?:unknown[])=>client.query(sql,params) as Promise<{rows:T[]}>,
  transaction:<T>(fn:(db:DB)=>Promise<T>)=>client.transaction((tx:any)=>fn(wrap(tx))),close:()=>lite.close()});
 return wrap(lite);
}
export async function migrate(db:DB){
 for(const [version,file] of [[1,'001_initial.sql'],[2,'002_accounts.sql'],[3,'003_enterprise_requests.sql'],[4,'004_admin_blog.sql'],[5,'005_blog_media_seo.sql'],[6,'006_product_copy.sql'],[7,'007_production.sql'],[8,'008_account_details.sql']] as const){
  const sql=await readFile(new URL('./migrations/'+file,import.meta.url),'utf8');
  await db.transaction(async tx=>{
   if(db.kind==='postgres')await tx.query('SELECT pg_advisory_xact_lock(731005827)');
   await tx.query('CREATE TABLE IF NOT EXISTS schema_migrations(version integer PRIMARY KEY)');
   if((await tx.query('SELECT version FROM schema_migrations WHERE version=$1',[version])).rows.length)return;
   for(const statement of sql.split(';').map(s=>s.trim()).filter(Boolean))await tx.query(statement);
   await tx.query('INSERT INTO schema_migrations(version) VALUES($1)',[version]);
  });
 }
}
