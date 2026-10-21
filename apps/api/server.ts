import {billingProfile} from '../../packages/domain/billing-profile';
import {BulkMail} from './bulk-mail';
import type {BulkInput} from '../../packages/domain/bulk-mail';
import {MailDrafts} from './mail-drafts';
import type {MailDraftInput} from '../../packages/domain/mail-drafts';
import {AccountDetails} from './account-details';
import {AccountSecurity} from './account-security';
import {GmailConnections} from './gmail';
import {allowRequest} from './rate-limit';
import {blogImageType,BLOG_IMAGE_LIMIT,isBlogImage} from '../../packages/domain/blog-media';
import Fastify from 'fastify';
import {Accounts,type Plan} from './accounts';
import {PASSWORD_PATTERN} from '../../packages/domain/password-policy';
import {AdminService,type AdminConfig} from './admin';
import {BlogService,type PostInput} from './blog';
import { createHash,randomUUID,timingSafeEqual } from 'node:crypto';
import type { DB } from '../../packages/database/index';
import type { MailProvider } from '../../packages/provider-adapters/index';
import { LOCAL_WORKSPACE,TrackingService } from './service';
const gif=Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7','base64');
const digestRate=(s:string)=>createHash('sha256').update(s).digest('hex');
const uuid={type:'string',pattern:'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'};
export function buildServer(db:DB,provider:MailProvider,key:string,origin:string,adminConfig?:AdminConfig,options:{production?:boolean;site?:string;encryptionKey?:string;billing?:string}={}){
 const production=options.production??process.env.NODE_ENV==='production';
 const security=options.encryptionKey?new AccountSecurity(db,options.site||origin,options.encryptionKey):null;
 const gmail=new GmailConnections(db,options.site||origin,options.encryptionKey||'');
 if(key.length<32) throw new Error('INTERNAL_API_KEY_REQUIRED');
 const app=Fastify({logger:false,bodyLimit:32768,trustProxy:false,ajv:{customOptions:{removeAdditional:false}}});
 const service=new TrackingService(db,provider,origin);
 const accounts=new Accounts(db,production);
 const admin=new AdminService(db,accounts),blog=new BlogService(db);
 const bulk=new BulkMail(db,gmail,options.encryptionKey,origin,production);
 const drafts=new MailDrafts(db,options.encryptionKey,production);
 const accountDetails=new AccountDetails(db,options.site||origin,options.encryptionKey);
 if(adminConfig)app.addHook('onReady',async()=>{await admin.init(adminConfig)});
 const owner=(req:{headers:Record<string,unknown>})=>admin.owner(String(req.headers['x-user-session']||''));
 app.addHook('preValidation',async(req,reply)=>{if(req.url.startsWith('/api/admin/')){reply.header('Cache-Control','no-store');if(!['/api/admin/setup','/api/admin/setup-status'].includes(req.url.split('?')[0]))await owner(req)}});
 const workspace=async(req:{headers:Record<string,unknown>})=>{
  const token=req.headers['x-user-session'];
  if(!token){if(production)throw new Error('UNAUTHORIZED');return LOCAL_WORKSPACE;}
  const user=await accounts.current(String(token));
  if(!user)throw new Error('UNAUTHORIZED');
  if(production&&!user.email_verified_at)throw new Error('EMAIL_NOT_VERIFIED');
  if(!user.plan)throw new Error('PLAN_REQUIRED');
  if(production){const entitlement=(await db.query<{status:string}>('SELECT status FROM entitlements WHERE workspace_id=$1',[user.workspace_id])).rows[0];if(entitlement?.status!=='active')throw Error('FORBIDDEN');}
  return user.workspace_id;
 };
 const account=async(req:{headers:Record<string,unknown>})=>{const user=await accounts.current(String(req.headers['x-user-session']||''));if(!user)throw new Error('UNAUTHORIZED');return user};
 // Deny unverified accounts centrally, including owners and direct API requests.
 // Only login, recovery and verification are available before email ownership is proven.
 const onboardingRoutes=new Set(['/api/auth/register','/api/auth/login','/api/auth/me','/api/auth/logout','/api/auth/verify/request','/api/auth/verify/confirm','/api/auth/reset/request','/api/auth/reset/confirm','/api/auth/verify/code/status','/api/auth/verify/code/request','/api/auth/verify/code/confirm','/api/admin/setup','/api/admin/setup-status','/api/account/email/confirm','/api/enterprise-requests']);
 app.addHook('preValidation',async req=>{
  if(!production||!req.url.startsWith('/api/')||onboardingRoutes.has(req.url.split('?')[0]))return;
  const user=await account(req);if(!user.email_verified_at)throw Error('EMAIL_NOT_VERIFIED');
  if(req.url.startsWith('/api/gmail/'))await workspace(req);
  const path=req.url.split('?')[0];
  if(path==='/api/gmail/start'||path==='/api/gmail/disconnect'||path==='/api/access/activate'){
   if(!await allowRequest(db,'private-mutation:'+path,user.id,30))throw Error('TOO_MANY_ATTEMPTS');
  }
 });
 const attempts=new Map<string,{count:number;until:number}>();
 const metrics={collectorErrors:0,collectorTimeouts:0};
 app.addHook('onRequest',async(req,reply)=>{
  if(!req.url.startsWith('/api/')) return;
  reply.header('Cache-Control','no-store');
  const actual=Buffer.from(req.headers.authorization||''),expected=Buffer.from(`Bearer ${key}`);
  if(actual.length!==expected.length||!timingSafeEqual(actual,expected)) return reply.code(401).send({code:'UNAUTHORIZED',message:'Oturum gerekli.'});
 });
 app.setErrorHandler((error,req,reply)=>{
  const code=error instanceof Error?error.message:'INTERNAL_ERROR';
  const status=({BULK_UNAVAILABLE:503,BULK_INVALID_INPUT:400,BULK_INVALID_TEMPLATE:400,BULK_PLAN_REQUIRED:403,BULK_QUOTA_REQUIRED:402,BULK_SENDER_CHANGED:409,BULK_ACTIVE_CAMPAIGN:409,BULK_PREVIEW_EXPIRED:409,BULK_INVALID_STATE:409,DRAFTS_UNAVAILABLE:503,INVALID_DRAFT:400,DRAFT_LIMIT_REACHED:409,DRAFT_PLAN_LIMIT:403,STALE_DRAFT:409,UNAUTHORIZED:401,INVALID_LOGIN:401,ACCOUNT_EXISTS:409,PLAN_REQUIRED:402,INVALID_PLAN:400,INVALID_PASSWORD:400,INVALID_ACCOUNT:400,INVALID_BILLING_PROFILE:400,INVALID_POST:400,SETUP_CLOSED:409,INVALID_SETUP_TOKEN:403,EXISTING_ACCOUNT_PASSWORD_REQUIRED:401,SLUG_EXISTS:409,STALE_POST:409,NOT_FOUND:404,FORBIDDEN:403,EMAIL_NOT_VERIFIED:403,INVALID_ACCOUNT_TOKEN:400,INVALID_VERIFICATION_CODE:400,TOO_MANY_ATTEMPTS:429,VERIFICATION_LOCKED:429,VERIFICATION_COOLDOWN:429,EMAIL_UNAVAILABLE:503,EMAIL_IN_USE:409,EMAIL_UNCHANGED:400,GMAIL_NOT_CONNECTED:409,GMAIL_UNAVAILABLE:503,INVALID_OAUTH_STATE:400,GMAIL_AUTH_FAILED:400,GMAIL_CLIENT_INVALID:400,GMAIL_CODE_INVALID:400,GMAIL_IDENTITY_FAILED:400,GMAIL_REFRESH_REQUIRED:400,GMAIL_SCOPE_REQUIRED:400,LIMIT_REACHED:402,IDEMPOTENCY_CONFLICT:409} as Record<string,number>)[code]|| (typeof error==='object' && error!==null && 'validation' in error?400:500);
  reply.code(status).send({code:status===500?'INTERNAL_ERROR':code,message:status===500?'İşlem tamamlanamadı.':status===400?'Girdi geçersiz.':'İşlem için hak veya geçerli istek gerekli.'});
 });
 const newPassword={type:'string',minLength:8,maxLength:128,pattern:PASSWORD_PATTERN};
 const credentials={type:'object',additionalProperties:false,required:['email','password'],properties:{email:{type:'string',minLength:3,maxLength:254,pattern:String.raw`^[^\s@]+@[^\s@]+\.[^\s@]+$`},password:{type:'string',minLength:1,maxLength:128},name:{type:'string',minLength:2,maxLength:80}}};
 const authRate=async(req:any,reply:any)=>{const email=String(req.body?.email||'').trim().toLowerCase();if(production){if(!await allowRequest(db,'auth-email',email,15)||!await allowRequest(db,'auth-global','all',500))return reply.code(429).send({code:'TOO_MANY_ATTEMPTS'});return;}const key=digestRate(email);let entry=attempts.get(key);if(!entry||entry.until<Date.now()){entry={count:0,until:Date.now()+15*60*1000};attempts.set(key,entry)}if(++entry.count>15)return reply.code(429).send({code:'TOO_MANY_ATTEMPTS'});if(attempts.size>10000)for(const[k,v]of attempts)if(v.until<Date.now())attempts.delete(k)};
 app.post('/api/auth/register',{schema:{body:{...credentials,properties:{...credentials.properties,password:newPassword},required:['name','email','password']}},preHandler:authRate},async req=>{const b=req.body as {name:string;email:string;password:string};const result=await accounts.register(b.name.trim(),b.email,b.password);if(production&&security){const user=await accounts.current(result.token);if(user)await security.issueVerificationCode(user.id);}return result});
 app.post('/api/auth/login',{schema:{body:credentials},preHandler:authRate},async req=>{const b=req.body as {email:string;password:string};return accounts.login(b.email,b.password)});
 app.get('/api/auth/me',async req=>({user:await account(req)}));
 app.get('/api/account/details',async req=>accountDetails.details(await account(req)));
 const accountChangeRate=async(req:any,reply:any)=>{const user=await account(req);if(!await allowRequest(db,'account-change',user.id,10))return reply.code(429).send({code:'TOO_MANY_ATTEMPTS'})};
 app.get('/api/account/billing',async req=>{const user=await account(req);const row=(await db.query<{profile:unknown}>('SELECT profile FROM billing_profiles WHERE user_id=$1 AND workspace_id=$2',[user.id,user.workspace_id])).rows[0];return {profile:row?.profile||null}});
 app.post('/api/account/billing',{schema:{body:{type:'object',additionalProperties:false,properties:Object.fromEntries(['kind','name','email','city','district','address','postalCode','companyName','taxOffice','taxNumber'].map(key=>[key,{type:'string',maxLength:500}]))}},preHandler:accountChangeRate},async req=>{
  const user=await account(req);if(production&&!user.email_verified_at)throw Error('EMAIL_NOT_VERIFIED');
  const profile=billingProfile(req.body);
  await db.query('INSERT INTO billing_profiles(user_id,workspace_id,profile) VALUES($1,$2,$3) ON CONFLICT(user_id) DO UPDATE SET profile=excluded.profile,updated_at=now()',[user.id,user.workspace_id,JSON.stringify(profile)]);return {ok:true};
 });
 app.post('/api/account/profile',{schema:{body:{type:'object',additionalProperties:false,required:['name'],properties:{name:{type:'string',minLength:2,maxLength:80}}}},preHandler:accountChangeRate},async req=>{await accountDetails.updateName(await account(req),(req.body as {name:string}).name);return {ok:true}});
 app.post('/api/account/email/request',{schema:{body:credentials},preHandler:accountChangeRate},async req=>{const user=await account(req),body=req.body as {email:string;password:string};await accountDetails.requestEmail(user,body.email,tx=>accounts.verifyPassword(user.id,body.password,tx));return {ok:true}});
 app.post('/api/account/email/cancel',{preHandler:accountChangeRate},async req=>{await accountDetails.cancelEmail((await account(req)).id);return {ok:true}});
 app.post('/api/account/email/confirm',{schema:{body:{type:'object',additionalProperties:false,required:['token'],properties:{token:{type:'string',minLength:43,maxLength:43}}}},preHandler:async(_req,reply)=>{if(!await allowRequest(db,'email-change-confirm','all',200))return reply.code(429).send({code:'TOO_MANY_ATTEMPTS'})}},async req=>accountDetails.confirmEmail((req.body as {token:string}).token));
 app.post('/api/auth/logout',async req=>{await accounts.logout(String(req.headers['x-user-session']||''));return {ok:true}});
 app.post('/api/purchase-preview',{schema:{body:{type:'object',additionalProperties:false,required:['plan'],properties:{plan:{type:'string',enum:['individual','team','business']},idempotencyKey:uuid}}}},async(req,reply)=>{
  if(production)return reply.code(403).send({code:'PREVIEW_DISABLED'});
  await accounts.purchase(await account(req),(req.body as {plan:Plan}).plan,(req.body as {idempotencyKey?:string}).idempotencyKey);return {ok:true,mode:'local_test'};
 });
 app.post('/api/enterprise-requests',{schema:{body:{type:'object',additionalProperties:false,required:['email','company'],properties:{email:{type:'string',minLength:3,maxLength:254,pattern:String.raw`^[^\s@]+@[^\s@]+\.[^\s@]+$`},company:{type:'string',minLength:2,maxLength:160,pattern:String.raw`^[^\r\n]+$`}}}}},async(req,reply)=>{
  const body=req.body as {email:string;company:string};
  if(production&&!await allowRequest(db,'enterprise',body.email.trim().toLowerCase(),5,3600))return reply.code(429).send({code:'TOO_MANY_ATTEMPTS'});
  const company=body.company.trim();if(company.length<2)return reply.code(400).send({code:'INVALID_COMPANY'});
  await db.query('INSERT INTO enterprise_requests(id,email,company) VALUES($1,$2,$3) ON CONFLICT(email,company) DO NOTHING',[randomUUID(),body.email.trim().toLowerCase(),company]);
  return {ok:true};
 });
 const listQuery={type:'object',additionalProperties:false,properties:{q:{type:'string',maxLength:200},offset:{type:'integer',minimum:0,maximum:100000}}};
 const idParams={type:'object',additionalProperties:false,required:['id'],properties:{id:uuid}};
 const setupAttempts={count:0,until:0};
 const draftBody={type:'object',additionalProperties:false,required:['title','subject','to','text','tracking'],properties:{title:{type:'string',minLength:1,maxLength:80},subject:{type:'string',maxLength:200},to:{type:'string',maxLength:254},text:{type:'string',maxLength:10000},tracking:{type:'boolean'}}};
 const draftOwner=async(req:{headers:Record<string,unknown>})=>{await workspace(req);return account(req)};
 const draftMutationRate=async(req:any)=>{const user=await draftOwner(req);if(!await allowRequest(db,'mail-draft-write',user.id,80))throw Error('TOO_MANY_ATTEMPTS')};
 app.get('/api/drafts',async req=>drafts.list(await draftOwner(req)));
 app.get('/api/drafts/:id',{schema:{params:idParams}},async req=>drafts.get(await draftOwner(req),(req.params as {id:string}).id));
 app.post('/api/drafts',{schema:{body:draftBody},preHandler:draftMutationRate},async req=>drafts.save(await draftOwner(req),req.body as MailDraftInput));
 app.post('/api/drafts/:id',{schema:{params:idParams,body:{...draftBody,required:[...draftBody.required,'version'],properties:{...draftBody.properties,version:{type:'integer',minimum:1}}}},preHandler:draftMutationRate},async req=>{const{version,...input}=req.body as MailDraftInput&{version:number};return drafts.save(await draftOwner(req),input,(req.params as {id:string}).id,version)});
 app.post('/api/drafts/:id/delete',{schema:{params:idParams,body:{type:'object',additionalProperties:false,required:['version'],properties:{version:{type:'integer',minimum:1}}}},preHandler:draftMutationRate},async req=>drafts.remove(await draftOwner(req),(req.params as {id:string}).id,(req.body as {version:number}).version));
 const bulkOwner=async(req:{headers:Record<string,unknown>})=>{await workspace(req);return account(req)};
 const bulkRate=async(req:any)=>{const user=await bulkOwner(req);if(!await allowRequest(db,'bulk-write',user.id,30))throw Error('TOO_MANY_ATTEMPTS')};
 app.get('/api/bulk',async req=>bulk.list(await bulkOwner(req)));
 app.post('/api/bulk/preview',{bodyLimit:1024*1024,schema:{body:{type:'object',additionalProperties:false,required:['name','subject','text','tracking','csv','requestId'],properties:{name:{type:'string',minLength:1,maxLength:80},subject:{type:'string',minLength:1,maxLength:200},text:{type:'string',minLength:1,maxLength:10000},tracking:{type:'boolean'},csv:{type:'string',maxLength:524288},requestId:uuid}}},preHandler:bulkRate},async req=>bulk.preview(await bulkOwner(req),req.body as BulkInput));
 app.get('/api/bulk/:id',{schema:{params:idParams,querystring:{type:'object',additionalProperties:false,properties:{offset:{type:'integer',minimum:0,maximum:500}}}}},async req=>bulk.detail(await bulkOwner(req),(req.params as {id:string}).id,(req.query as {offset?:number}).offset||0));
 app.get('/api/bulk/:id/report',{schema:{params:idParams}},async req=>({csv:await bulk.report(await bulkOwner(req),(req.params as {id:string}).id)}));
 app.post('/api/bulk/:id/confirm',{schema:{params:idParams,body:{type:'object',additionalProperties:false,properties:{}}},preHandler:bulkRate},async req=>bulk.confirm(await bulkOwner(req),(req.params as {id:string}).id));
 app.post('/api/bulk/:id/control',{schema:{params:idParams,body:{type:'object',additionalProperties:false,required:['action'],properties:{action:{type:'string',enum:['pause','resume','cancel']}}}},preHandler:bulkRate},async req=>bulk.control(await bulkOwner(req),(req.params as {id:string}).id,(req.body as {action:'pause'|'resume'|'cancel'}).action));
 app.get('/api/admin/setup-status',()=>admin.status());
 app.post('/api/admin/setup',{schema:{body:{type:'object',additionalProperties:false,required:['token','name','password'],properties:{token:{type:'string',minLength:32,maxLength:128},name:{type:'string',minLength:2,maxLength:80,pattern:String.raw`.*\S.*`},password:newPassword}}},preHandler:async(_req,reply)=>{if(production&&!await allowRequest(db,'owner-setup','all',8))return reply.code(429).send({code:'TOO_MANY_ATTEMPTS'});if(setupAttempts.until<Date.now()){setupAttempts.count=0;setupAttempts.until=Date.now()+15*60000}if(++setupAttempts.count>8)return reply.code(429).send({code:'TOO_MANY_ATTEMPTS'})}},async req=>{const b=req.body as {token:string;name:string;password:string};return admin.setup(b.token,b.name,b.password)});
 app.get('/api/admin/overview',()=>admin.overview());
 app.get('/api/admin/members',{schema:{querystring:listQuery}},req=>{const q=req.query as {q?:string;offset?:number};return admin.members(q.q,q.offset)});
 app.get('/api/admin/members/:id',{schema:{params:idParams}},async(req,reply)=>{const row=await admin.member((req.params as {id:string}).id);return row||reply.code(404).send({code:'NOT_FOUND'})});
 app.get('/api/admin/purchases',{schema:{querystring:listQuery}},req=>{const q=req.query as {q?:string;offset?:number};return admin.purchases(q.q,q.offset)});
 app.get('/api/admin/purchases/:id',{schema:{params:idParams}},async(req,reply)=>{const row=await admin.purchase((req.params as {id:string}).id);return row||reply.code(404).send({code:'NOT_FOUND'})});
 app.get('/api/admin/enterprise',{schema:{querystring:listQuery}},req=>admin.leads((req.query as {offset?:number}).offset));
 app.post('/api/admin/enterprise/:id',{schema:{params:idParams,body:{type:'object',additionalProperties:false,required:['status'],properties:{status:{type:'string',enum:['new','contacted','closed']}}}}},async req=>{await admin.markLead(await owner(req),(req.params as {id:string}).id,(req.body as {status:string}).status);return {ok:true}});
 app.get('/api/admin/blog',{schema:{querystring:listQuery}},req=>{const q=req.query as {q?:string;offset?:number};return blog.list(false,q.offset,q.q)});
 app.get('/api/admin/blog/:id',{schema:{params:idParams}},async(req,reply)=>{const row=await blog.get((req.params as {id:string}).id);return row||reply.code(404).send({code:'NOT_FOUND'})});
 app.post('/api/admin/blog',{schema:{body:{type:'object',additionalProperties:false,required:['slug','title','excerpt','body','category','status'],properties:{coverImage:{type:'string',maxLength:100,pattern:'^$|^/blog/media/[a-f0-9-]{36}\\.(png|jpg|webp)$'},coverAlt:{type:'string',maxLength:240},seoTitle:{type:'string',maxLength:180},metaDescription:{type:'string',maxLength:320},focusKeyword:{type:'string',maxLength:100},id:uuid,version:{type:'integer',minimum:1},slug:{type:'string',minLength:3,maxLength:140,pattern:'^[a-z0-9]+(?:-[a-z0-9]+)*$'},title:{type:'string',minLength:3,maxLength:180},excerpt:{type:'string',minLength:10,maxLength:400},body:{type:'string',minLength:30,maxLength:24000},category:{type:'string',minLength:2,maxLength:50},status:{type:'string',enum:['draft','published','archived']}}}}},async req=>blog.save((await owner(req)).id,req.body as PostInput));
 app.get('/public/blog',{schema:{querystring:listQuery}},req=>{const q=req.query as {q?:string;offset?:number};return blog.list(true,q.offset,q.q)});
 app.get('/public/blog/:slug',{schema:{params:{type:'object',required:['slug'],properties:{slug:{type:'string',maxLength:140,pattern:'^[a-z0-9]+(?:-[a-z0-9]+)*$'}}}}},async(req,reply)=>{const row=await blog.get((req.params as {slug:string}).slug,true);return row||reply.code(404).send({code:'NOT_FOUND'})});
 app.get('/health',async(_req,reply)=>{reply.header('Cache-Control','no-store');try{await db.query('SELECT 1');return {status:'ok'}}catch{return reply.code(503).send({status:'unavailable'})}});
 app.get('/api/status',async req=>{const user=production?await account(req):null;const connection=user?await gmail.status(user.workspace_id):{configured:gmail.configured,connected:false,email:null};return {mode:production?'production':'development',gmailConnected:connection.connected,gmailConfigured:connection.configured,gmailEmail:connection.email,...metrics}});
 app.post('/api/test-submissions',{schema:{body:{type:'object',additionalProperties:false,required:['subject','to','text','tracking'],properties:{subject:{type:'string',minLength:1,maxLength:200,pattern:'^[^\r\n]+$'},to:{type:'string',pattern:'^[a-zA-Z0-9._+-]+@example\.invalid$'},text:{type:'string',minLength:1,maxLength:10000},tracking:{type:'boolean'}}},headers:{type:'object',required:['idempotency-key'],properties:{'idempotency-key':{type:'string',minLength:16,maxLength:128,pattern:'^[A-Za-z0-9_-]+$'}}}}},async(req,reply)=>{
  if(production||provider.name!=='fake') return reply.code(403).send({code:'LOCAL_TEST_ONLY'});
  return service.send(await workspace(req),req.headers['idempotency-key'] as string,req.body as any);
 });

 app.post('/api/access/activate',{schema:{body:{type:'object',additionalProperties:false,required:['plan'],properties:{plan:{type:'string',enum:['individual','team']}}}}},async(req,reply)=>{
  const user=await account(req);if(production&&!user.email_verified_at)throw Error('EMAIL_NOT_VERIFIED');
  if(options.billing!=='complimentary')return reply.code(403).send({code:'BILLING_UNAVAILABLE'});
  await accounts.grant(user,(req.body as {plan:Plan}).plan);return {ok:true,mode:'complimentary'};
 });
 app.get('/api/auth/verify/code/status',async(req,reply)=>{if(!security)return reply.code(503).send({code:'EMAIL_UNAVAILABLE'});return security.codeStatus((await account(req)).id)});
 app.post('/api/auth/verify/code/request',async(req,reply)=>{const user=await account(req);if(!security)return reply.code(503).send({code:'EMAIL_UNAVAILABLE'});if(!await allowRequest(db,'verify-code-send',user.id,5))return reply.code(429).send({code:'TOO_MANY_ATTEMPTS'});await security.issueVerificationCode(user.id);return {ok:true,resendAfter:60}});
 app.post('/api/auth/verify/code/confirm',{schema:{body:{type:'object',additionalProperties:false,required:['code'],properties:{code:{type:'string',pattern:'^[0-9]{6}$'}}}}},async(req,reply)=>{const user=await account(req);if(!security)return reply.code(503).send({code:'EMAIL_UNAVAILABLE'});if(!await allowRequest(db,'verify-code-confirm',user.id,15))return reply.code(429).send({code:'TOO_MANY_ATTEMPTS'});await security.consumeVerificationCode(user.id,(req.body as {code:string}).code);return {ok:true}});
 const tokenBody={type:'object',additionalProperties:false,required:['token'],properties:{token:{type:'string',pattern:'^[A-Za-z0-9_-]{43}$'},password:newPassword}};
 for(const purpose of ['verify','reset'] as const){
  app.post('/api/auth/'+purpose+'/request',{schema:{body:{type:'object',additionalProperties:false,required:['email'],properties:{email:credentials.properties.email}}},preHandler:authRate},async(req,reply)=>{if(!security)return reply.code(503).send({code:'EMAIL_UNAVAILABLE'});await security.request((req.body as {email:string}).email,purpose);return {ok:true}});
  app.post('/api/auth/'+purpose+'/confirm',{schema:{body:{...tokenBody,required:purpose==='reset'?['token','password']:['token']}},preHandler:async(_req,reply)=>{if(!await allowRequest(db,'token-confirm','all',200))return reply.code(429).send({code:'TOO_MANY_ATTEMPTS'})}},async(req,reply)=>{if(!security)return reply.code(503).send({code:'EMAIL_UNAVAILABLE'});const b=req.body as {token:string;password?:string};await security.consume(b.token,purpose,b.password,purpose==='verify'?(await account(req)).id:undefined);return {ok:true}});
 }
 app.post('/api/gmail/start',async req=>{const user=await account(req);if(production&&!user.email_verified_at)throw Error('EMAIL_NOT_VERIFIED');return {url:await gmail.begin(user,String(req.headers['x-user-session']||''))}});
 app.post('/api/gmail/callback',{schema:{body:{type:'object',additionalProperties:false,required:['state','code'],properties:{state:{type:'string',maxLength:128},code:{type:'string',maxLength:4096}}}}},async req=>{const b=req.body as {state:string;code:string};await gmail.finish(await account(req),String(req.headers['x-user-session']||''),b.state,b.code);return {ok:true}});
 app.post('/api/gmail/disconnect',async req=>{await gmail.disconnect((await account(req)).workspace_id);return {ok:true}});
 app.post('/api/messages/send',{schema:{body:{type:'object',additionalProperties:false,required:['subject','to','text','tracking'],properties:{subject:{type:'string',minLength:1,maxLength:200,pattern:'^[^\\r\\n]+$'},to:{type:'string',maxLength:254,pattern:'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'},text:{type:'string',minLength:1,maxLength:10000},tracking:{type:'boolean'}}},headers:{type:'object',required:['idempotency-key'],properties:{'idempotency-key':{type:'string',minLength:16,maxLength:128,pattern:'^[A-Za-z0-9_-]+$'}}}}},async req=>{
  const w=await workspace(req);if(!await allowRequest(db,'single-mail-send',w,20,60))throw Error('TOO_MANY_ATTEMPTS');const connected=await gmail.provider(w);const sender=new TrackingService(db,connected.provider,origin,connected.from);return sender.send(w,String(req.headers['idempotency-key']),req.body as any);
 });
 app.addContentTypeParser('application/octet-stream',{parseAs:'buffer',bodyLimit:BLOG_IMAGE_LIMIT},(_req,body,done)=>done(null,body));
 app.post('/api/admin/media',{bodyLimit:BLOG_IMAGE_LIMIT},async(req,reply)=>{const user=await owner(req),bytes=req.body as Buffer;if(!Buffer.isBuffer(bytes)||bytes.length>BLOG_IMAGE_LIMIT)return reply.code(413).send({code:'INVALID_IMAGE'});const type=blogImageType(bytes);if(!type)return reply.code(415).send({code:'INVALID_IMAGE'});const name=randomUUID()+'.'+type.ext;await db.query('INSERT INTO blog_media(name,mime,bytes,owner_id) VALUES($1,$2,$3,$4)',[name,type.mime,bytes,user.id]);return reply.code(201).send({url:'/blog/media/'+name})});
 app.get('/public/media/:name',async(req,reply)=>{const name=(req.params as {name:string}).name;if(!isBlogImage('/blog/media/'+name))return reply.code(404).send();const row=(await db.query<{mime:string;bytes:Buffer}>('SELECT mime,bytes FROM blog_media WHERE name=$1',[name])).rows[0];if(!row)return reply.code(404).send();return reply.type(row.mime).header('Cache-Control','public, max-age=31536000, immutable').header('X-Content-Type-Options','nosniff').header('Content-Security-Policy',"default-src 'none'; sandbox").send(Buffer.from(row.bytes))});
 app.get('/api/messages',{schema:{querystring:{type:'object',additionalProperties:false,properties:{q:{type:'string',maxLength:200},offset:{type:'integer',minimum:0,maximum:100000}}}}},async req=>{
  const q=req.query as {q?:string;offset?:number};return {messages:await service.list(await workspace(req),q.q,q.offset)};
 });
 app.get('/api/messages/:id',{schema:{params:{type:'object',properties:{id:uuid},required:['id']}}},async(req,reply)=>{
  const result=await service.detail(await workspace(req),(req.params as {id:string}).id);return result||reply.code(404).send({code:'NOT_FOUND'});
 });
 app.post('/api/messages/:id/stop',{schema:{params:{type:'object',properties:{id:uuid},required:['id']}}},async(req,reply)=>{
  if(!await service.stop(await workspace(req),(req.params as {id:string}).id)) return reply.code(404).send({code:'NOT_FOUND'});
  return {stopped:true};
 });
 app.route({method:['GET','HEAD'],url:'/t/o/:token.gif',handler:async(req,reply)=>{
  reply.type('image/gif').header('Cache-Control','no-store, private, max-age=0').header('X-Content-Type-Options','nosniff');
  const secret=(req.params as {token:string}).token;
  if(req.method==='GET'&&/^[A-Za-z0-9_-]{43}$/.test(secret)){
   // Collector en fazla 100 ms bekler; tamamlanmayan kalıcı kayıt Promise'i izlenmeye devam eder.
   let timer:ReturnType<typeof setTimeout>|undefined;
   await Promise.race([service.collect(secret).catch(()=>{metrics.collectorErrors++}),new Promise<void>(resolve=>{timer=setTimeout(()=>{metrics.collectorTimeouts++;resolve()},100)})]);
   if(timer)clearTimeout(timer);
  }
  return reply.send(gif);
 }});
 return {app,service,metrics,bulk};
}
