import type {FastifyInstance} from 'fastify';
import type {DB} from '../../packages/database';
import type {Account} from './accounts';
import {allowRequest} from './rate-limit';
import {FileSharing} from './file-sharing';
import {FILE_CHUNK_SIZE} from '../../packages/domain/file-sharing';
const uuid={type:'string',pattern:'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'};
const idParams={type:'object',additionalProperties:false,required:['id'],properties:{id:uuid}};
export function registerFileRoutes(app:FastifyInstance,db:DB,files:FileSharing,account:(req:{headers:Record<string,unknown>})=>Promise<Account>){
 const mutation=async(req:any)=>{const user=await account(req);if(!await allowRequest(db,'file-mutation',user.id,150,60))throw Error('TOO_MANY_ATTEMPTS')};
 app.get('/api/files',async req=>files.list(await account(req)));
 app.post('/api/files',{preHandler:mutation,schema:{body:{type:'object',additionalProperties:false,required:['name','size'],properties:{name:{type:'string',maxLength:180},size:{type:'integer',minimum:1,maximum:26214400}}}}},async req=>{const b=req.body as {name:string;size:number};return files.begin(await account(req),b.name,b.size)});
 app.post('/api/files/:id/chunks/:part',{preHandler:mutation,bodyLimit:FILE_CHUNK_SIZE,schema:{params:{type:'object',additionalProperties:false,required:['id','part'],properties:{id:uuid,part:{type:'integer',minimum:0,maximum:8}}}}},async req=>{const p=req.params as {id:string;part:number};return files.upload(await account(req),p.id,p.part,req.body as Buffer)});
 app.post('/api/files/:id/complete',{preHandler:mutation,schema:{params:idParams}},async req=>files.complete(await account(req),(req.params as {id:string}).id));
 app.post('/api/files/:id/delete',{preHandler:mutation,schema:{params:idParams}},async req=>files.remove(await account(req),(req.params as {id:string}).id));
 app.get('/api/files/:id',{schema:{params:idParams,querystring:{type:'object',additionalProperties:false,properties:{offset:{type:'integer',minimum:0,maximum:100000}}}}},async req=>files.detail(await account(req),(req.params as {id:string}).id,(req.query as {offset?:number}).offset||0));
 app.post('/api/files/:id/shares',{preHandler:mutation,schema:{params:idParams,body:{type:'object',additionalProperties:false,properties:{label:{type:'string',maxLength:160},password:{type:'string',maxLength:128},expiresAt:{type:'string',maxLength:40},allowDownload:{type:'boolean'}}}}},async req=>files.createShare(await account(req),(req.params as {id:string}).id,req.body as any));
 app.post('/api/files/:id/shares/:share/revoke',{preHandler:mutation,schema:{params:{type:'object',additionalProperties:false,required:['id','share'],properties:{id:uuid,share:uuid}}}},async req=>{const p=req.params as {id:string;share:string};return files.revoke(await account(req),p.id,p.share)});
 const publicRate=async(req:any,reply:any)=>{reply.header('Cache-Control','no-store, private').header('X-Robots-Tag','noindex, nofollow').header('Referrer-Policy','no-referrer');const credential=String(req.headers['x-file-session']||'');if(!await allowRequest(db,credential?'file-public-session':'file-public-landing',String(req.params.token)+':'+credential,credential?180:3000,60))throw Error('TOO_MANY_ATTEMPTS')};
 const params={type:'object',additionalProperties:false,required:['token'],properties:{token:{type:'string',pattern:'^[A-Za-z0-9_-]{43}$'}}};
 const session=(req:any)=>String(req.headers['x-file-session']||'');
 app.get('/public/files/:token',{preHandler:publicRate,schema:{params}},req=>files.landing((req.params as {token:string}).token,String(req.headers['user-agent']||'')+' '+String(req.headers['sec-purpose']||''),req.method==='GET'));
 app.post('/public/files/:token/open',{preHandler:publicRate,schema:{params,body:{type:'object',additionalProperties:false,properties:{password:{type:'string',maxLength:128}}}}},async req=>{const token=(req.params as {token:string}).token;if(!await allowRequest(db,'file-password',token,1000,900))throw Error('TOO_MANY_ATTEMPTS');return files.open(token,(req.body as {password?:string})?.password||'',String(req.headers['user-agent']||''))});
 app.get('/public/files/:token/chunks/:part',{preHandler:publicRate,schema:{params:{...params,required:['token','part'],properties:{...params.properties,part:{type:'integer',minimum:0,maximum:8}}},querystring:{type:'object',additionalProperties:false,properties:{download:uuid}}}},async(req,reply)=>{const p=req.params as {token:string;part:number};return reply.type('application/octet-stream').header('X-Content-Type-Options','nosniff').header('Content-Security-Policy',"default-src 'none'; sandbox").send(await files.chunk(p.token,session(req),p.part,(req.query as {download?:string}).download))});
 app.post('/public/files/:token/download',{preHandler:publicRate,schema:{params}},req=>files.startDownload((req.params as {token:string}).token,session(req)));
 app.post('/public/files/:token/events',{preHandler:publicRate,schema:{params,body:{type:'object',additionalProperties:false,required:['kind','key'],properties:{kind:{type:'string',enum:['preview','page_view','active_time','download_received']},key:uuid,page:{type:'integer',minimum:0,maximum:5000},seconds:{type:'integer',minimum:0,maximum:15},downloadId:uuid}}}},req=>files.observe((req.params as {token:string}).token,session(req),req.body as any));
}
