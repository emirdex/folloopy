import {productionConfig} from '../packages/runtime/config';
import {openDatabase} from '../packages/database/index';
const config=productionConfig({...process.env,NODE_ENV:'production'});
console.log('Configuration: valid');
const db=await openDatabase(config.database);
try{await db.query('SELECT 1');const migrations=await db.query<{version:number}>('SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1');if(migrations.rows[0]?.version!==10)throw Error('DATABASE_MIGRATIONS_REQUIRED');await db.transaction(async tx=>{await tx.query("INSERT INTO request_limits(key,count,expires_at) VALUES('preflight',1,now()) ON CONFLICT(key) DO UPDATE SET count=1");await tx.query("DELETE FROM request_limits WHERE key='preflight'")});console.log('PostgreSQL: reachable, migrations current, writes available');console.log('Blog storage: PostgreSQL (no deployment filesystem dependency)');console.log('Email: configuration present; real delivery must be verified after DNS setup');console.log('Gmail:',process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET?'configured; consent verification required':'not configured');console.log('Billing:',config.billing)}finally{await db.close()}
