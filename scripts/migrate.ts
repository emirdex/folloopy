import {openDatabase,migrate} from '../packages/database/index';
const db=await openDatabase(process.env.DATABASE_URL,'.data/postgres');
try{await migrate(db)}finally{await db.close()}
