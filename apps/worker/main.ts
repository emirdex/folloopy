import {openDatabase} from '../../packages/database/index';
import {processBatch} from './process';
if(!process.env.DATABASE_URL) throw new Error('STANDALONE_WORKER_REQUIRES_POSTGRES');
const db=await openDatabase(process.env.DATABASE_URL);
let running=true;process.on('SIGTERM',()=>{running=false});process.on('SIGINT',()=>{running=false});
while(running){try{await processBatch(db)}catch{console.error('WORKER_BATCH_FAILED')}await new Promise(r=>setTimeout(r,500));}
await db.close();
