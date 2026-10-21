import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {seedBlog} from './blog-seed';
import {openDatabase,migrate} from '../../packages/database/index';
import {FakeProvider,UnavailableProvider} from '../../packages/provider-adapters/index';
import {productionConfig} from '../../packages/runtime/config';
import {AccountSecurity} from './account-security';
import {seedLocal} from './service';
import {buildServer} from './server';
import {processBatch} from '../worker/process';

export async function startApi(config=productionConfig()){
 console.log('Folloopy API startup: database initialization');
 if(!config.production)await mkdir('.data',{recursive:true});
 const db=await openDatabase(config.database||undefined,'.data/postgres');
 try{
  await migrate(db);if(!config.production)await seedLocal(db);if(process.env.SEED_BLOG==='true'||!config.production)await seedBlog(db);
  let setupToken=process.env.ADMIN_SETUP_TOKEN||'';
  if(!config.production&&!setupToken){try{setupToken=(await readFile('.data/admin-setup-key','utf8')).trim()}catch(e){if((e as {code?:string}).code!=='ENOENT')throw e;setupToken=randomBytes(32).toString('base64url');await writeFile('.data/admin-setup-key',setupToken,{mode:0o600,flag:'wx'})}}
  if(config.backgroundWorkers)await db.query("UPDATE messages SET state='unknown' WHERE state='sending'");
  const{app}=buildServer(db,config.production?new UnavailableProvider():new FakeProvider(),config.key,config.production?config.trackingSite:(process.env.PUBLIC_TRACKING_ORIGIN||'http://127.0.0.1:4000'),setupToken?{email:config.admin||'emir@dexdijital.com',token:setupToken}:undefined,{production:config.production,site:config.appSite,encryptionKey:config.encryption,billing:config.billing});
  try{await app.ready()}catch(error){await app.close();throw error}
  const security=config.encryption?new AccountSecurity(db,config.appSite,config.encryption):null;
  let busy=false,ticks=0,closing=false;
  const worker=config.backgroundWorkers?setInterval(async()=>{if(busy||closing)return;busy=true;try{await processBatch(db);if(security){await security.deliver();if(++ticks%60===0)await security.cleanup()}}catch{console.error('WORKER_BATCH_FAILED')}finally{busy=false}},1000):null;
  const close=async()=>{if(closing)return;closing=true;if(worker)clearInterval(worker);await app.close();while(busy)await new Promise(r=>setTimeout(r,20));await db.close()};
  console.log('Folloopy API ready');
  return {app,close};
 }catch(error){await db.close();throw error}
}
