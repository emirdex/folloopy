import {servePrivateApi} from '../../packages/runtime/private-api.cjs';
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
const config=productionConfig();
if(!config.production)await mkdir('.data',{recursive:true});
const db=await openDatabase(config.database||undefined,'.data/postgres');
await migrate(db);if(!config.production)await seedLocal(db);if(process.env.SEED_BLOG==='true'||!config.production)await seedBlog(db);
let setupToken=process.env.ADMIN_SETUP_TOKEN||'';
if(!config.production&&!setupToken){try{setupToken=(await readFile('.data/admin-setup-key','utf8')).trim()}catch(e){if((e as {code?:string}).code!=='ENOENT')throw e;setupToken=randomBytes(32).toString('base64url');await writeFile('.data/admin-setup-key',setupToken,{mode:0o600,flag:'wx'})}}
// A single API process is supervised by scripts/start.ts. Never resend uncertain submissions.
await db.query("UPDATE messages SET state='unknown' WHERE state='sending'");
const{app}=buildServer(db,config.production?new UnavailableProvider():new FakeProvider(),config.key,config.production?config.site:(process.env.PUBLIC_TRACKING_ORIGIN||'http://127.0.0.1:4000'),setupToken?{email:config.admin||'emir@dexdijital.com',token:setupToken}:undefined,{production:config.production,site:config.site,encryptionKey:config.encryption,billing:config.billing});
const security=config.encryption?new AccountSecurity(db,config.site,config.encryption):null;
let busy=false,ticks=0;
const worker=setInterval(async()=>{if(busy)return;busy=true;try{await processBatch(db);if(security){await security.deliver();if(++ticks%60===0)await security.cleanup()}}catch{console.error('WORKER_BATCH_FAILED')}finally{busy=false}},1000);
if(process.env.FOLLOOPY_API_TRANSPORT==='ipc'&&process.send){
 await servePrivateApi(app);
 console.log('Folloopy API ready (private IPC)');
}else{
 await app.listen({host:'127.0.0.1',port:config.apiPort});
 console.log('Folloopy API ready');
}
let closing=false;const close=async()=>{if(closing)return;closing=true;clearInterval(worker);await app.close();while(busy)await new Promise(r=>setTimeout(r,20));await db.close();process.exit(0)};
process.on('SIGTERM',close);process.on('SIGINT',close);

process.on('disconnect',close);
