import {readdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {openDatabase,migrate} from '../packages/database/index';
import {isBlogImage,blogImageType} from '../packages/domain/blog-media';
if(!process.env.DATABASE_URL||!process.env.LEGACY_MEDIA_DIR)throw Error('DATABASE_URL_AND_LEGACY_MEDIA_DIR_REQUIRED');
const db=await openDatabase(process.env.DATABASE_URL);try{await migrate(db);const owner=(await db.query<{id:string}>("SELECT id FROM users WHERE role='owner'")).rows[0];if(!owner)throw Error('CREATE_PRODUCTION_OWNER_FIRST');let imported=0;for(const name of await readdir(process.env.LEGACY_MEDIA_DIR)){if(!isBlogImage('/blog/media/'+name))continue;const bytes=await readFile(join(process.env.LEGACY_MEDIA_DIR,name)),type=blogImageType(bytes);if(!type)continue;const row=await db.query('INSERT INTO blog_media(name,mime,bytes,owner_id) VALUES($1,$2,$3,$4) ON CONFLICT(name) DO NOTHING RETURNING name',[name,type.mime,bytes,owner.id]);imported+=row.rows.length}console.log('Imported image count:',imported)}finally{await db.close()}
