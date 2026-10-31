import {mailRecipients} from '../../packages/domain/recipients';
import {MemberTools} from './member-tools';
import {MailDrafts} from './mail-drafts';
import {membershipPolicy} from './package-usage';
import {freeUsage} from './free-usage';
import {UnavailableProvider} from '../../packages/provider-adapters';
import {validateRichMessage} from './mail-format';
import {FileSharing} from './file-sharing';
import {recordMemberActivity} from './member-activity';
import {createHash,createPublicKey,randomBytes,randomUUID,verify} from 'node:crypto';
import type {DB} from '../../packages/database';
import type {Account} from './accounts';
import {GmailConnections} from './gmail';
import {TrackingService} from './service';
import {allowRequest} from './rate-limit';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const fail=()=>{throw Error('FORBIDDEN')};
export type ExtensionEnvelope={deviceId:string;token:string;nonce:string;issuedAt:number;operation:'status'|'send'|'disconnect'|'files'|'file-share'|'messages'|'message'|'drafts'|'remind'|'notifications'|'schedule';payload:Record<string,unknown>;signature:string};
export function extensionCanonical(e:Omit<ExtensionEnvelope,'signature'>){return JSON.stringify([e.deviceId,e.token,e.nonce,e.issuedAt,e.operation,e.payload])}
export class GmailExtension{
 private cleanupAt=0;
 constructor(private db:DB,private gmail:GmailConnections,private origin:string,private archiveKey?:string){}
 async eligible(userId:string,sessionHash:string,db=this.db){
  const u=(await db.query<{id:string;workspace_id:string;sender:string}>(`SELECT u.id,u.workspace_id,mc.email AS sender FROM users u JOIN sessions s ON s.user_id=u.id JOIN access_grants g ON g.workspace_id=u.workspace_id JOIN entitlements e ON e.workspace_id=u.workspace_id JOIN mail_connections mc ON mc.workspace_id=u.workspace_id WHERE u.id=$1 AND s.token_hash=$2 AND s.expires_at>now() AND u.email_verified_at IS NOT NULL AND g.plan IN ('team','business') AND e.status='active'`,[userId,sessionHash])).rows[0];
  if(!u)fail();return u!;
 }
 async begin(input:any){
  if(!input||!/^[a-f0-9]{64}$/.test(input.challenge)||input.publicKey?.kty!=='EC'||input.publicKey?.crv!=='P-256'||!/^[A-Za-z0-9_-]{43}$/.test(input.publicKey?.x)||!/^[A-Za-z0-9_-]{43}$/.test(input.publicKey?.y)||input.publicKey.d)throw Error('INVALID_ACCOUNT');
  const publicKey={kty:'EC',crv:'P-256',x:input.publicKey.x,y:input.publicKey.y};
  try{createPublicKey({key:publicKey,format:'jwk'})}catch{throw Error('INVALID_ACCOUNT')}
  if(!await allowRequest(this.db,'extension-pair-key',hash(JSON.stringify(publicKey)),5,300)||!await allowRequest(this.db,'extension-pair-global','all',300,300))throw Error('TOO_MANY_ATTEMPTS');
  await this.db.query('DELETE FROM extension_pairs WHERE expires_at<now()');
  await this.db.query("DELETE FROM extension_nonces WHERE created_at<now()-interval '5 minutes'");
  const id=randomUUID();await this.db.query("INSERT INTO extension_pairs(id,challenge,public_key,expires_at) VALUES($1,$2,$3,now()+interval '5 minutes')",[id,input.challenge,JSON.stringify(publicKey)]);return {pairId:id};
 }
 async approve(user:Account,session:string,id:string){
  if(!uuid.test(id))throw Error('INVALID_ACCOUNT');
  await this.db.transaction(async tx=>{
   await tx.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[user.id]);
   await tx.query('SELECT workspace_id FROM entitlements WHERE workspace_id=$1 FOR UPDATE',[user.workspace_id]);
   const u=await this.eligible(user.id,hash(session),tx);
   const rows=(await tx.query('UPDATE extension_pairs SET user_id=$2,session_hash=$3,sender=$4 WHERE id=$1 AND expires_at>now() AND consumed=false AND user_id IS NULL RETURNING id',[id,u.id,hash(session),u.sender.toLowerCase()])).rows;
   if(!rows.length)throw Error('NOT_FOUND');
  });return {ok:true};
 }
 async exchange(input:any){
  if(!uuid.test(input?.pairId)||!/^[A-Za-z0-9_-]{43}$/.test(input?.secret))throw Error('INVALID_ACCOUNT');
  if(!await allowRequest(this.db,'extension-exchange',input.pairId,100,300))throw Error('TOO_MANY_ATTEMPTS');
  return this.db.transaction(async tx=>{
   const initial=(await tx.query<any>('SELECT * FROM extension_pairs WHERE id=$1 AND challenge=$2 AND expires_at>now() AND consumed=false',[input.pairId,hash(input.secret)])).rows[0];
   if(!initial)fail();if(!initial.user_id)return {pending:true};
   await tx.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[initial.user_id]);
   const u=await this.eligible(initial.user_id,initial.session_hash,tx);
   await tx.query('SELECT workspace_id FROM entitlements WHERE workspace_id=$1 FOR UPDATE',[u.workspace_id]);
   const pair=(await tx.query<any>('SELECT * FROM extension_pairs WHERE id=$1 AND consumed=false AND expires_at>now() FOR UPDATE',[initial.id])).rows[0];
   if(!pair||u.sender.toLowerCase()!==pair.sender)fail();
   await tx.query('UPDATE extension_devices SET revoked=true WHERE user_id=$1',[u.id]);
   const id=randomUUID(),token=randomBytes(32).toString('base64url');
   await tx.query("INSERT INTO extension_devices(id,user_id,workspace_id,session_hash,token_hash,public_key,sender,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,now()+interval '7 days')",[id,u.id,u.workspace_id,pair.session_hash,hash(token),JSON.stringify(pair.public_key),pair.sender]);
   await tx.query('UPDATE extension_pairs SET consumed=true WHERE id=$1',[pair.id]);await recordMemberActivity(tx,u.id,'extension_connected');return {deviceId:id,token,sender:pair.sender};
  });
 }
 async authorize(e:ExtensionEnvelope,db=this.db){
  const d=(await db.query<any>('SELECT * FROM extension_devices WHERE id=$1 AND token_hash=$2 AND revoked=false AND expires_at>now()',[e.deviceId,hash(e.token)])).rows[0];
  if(!d)fail();const u=await this.eligible(d.user_id,d.session_hash,db);if(u.sender.toLowerCase()!==d.sender)fail();return d;
 }
 async request(e:ExtensionEnvelope){
  if(!e||!uuid.test(e.deviceId)||!uuid.test(e.nonce)||!/^[A-Za-z0-9_-]{43}$/.test(e.token)||!Number.isSafeInteger(e.issuedAt)||Math.abs(Date.now()-e.issuedAt)>60000||!['status','send','disconnect','files','file-share','messages','message','drafts','remind','notifications','schedule'].includes(e.operation)||!e.payload||Array.isArray(e.payload)||typeof e.payload!=='object'||!/^[A-Za-z0-9_-]{86}$/.test(e.signature))throw Error('UNAUTHORIZED');
  const d=await this.authorize(e);
  if(Date.now()>this.cleanupAt){this.cleanupAt=Date.now()+60000;await this.db.query("DELETE FROM extension_nonces WHERE created_at<now()-interval '5 minutes'");}
  if(!verify('sha256',Buffer.from(extensionCanonical(e)),{key:createPublicKey({key:d.public_key,format:'jwk'}),dsaEncoding:'ieee-p1363'},Buffer.from(e.signature,'base64url')))throw Error('UNAUTHORIZED');
  const inserted=await this.db.query('INSERT INTO extension_nonces(device_id,nonce) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING nonce',[d.id,e.nonce]);if(!inserted.rows.length)throw Error('UNAUTHORIZED');
  if(!await allowRequest(this.db,'extension-device',d.id,120,60))throw Error('TOO_MANY_ATTEMPTS');
  if(e.operation==='disconnect'){await this.db.query('UPDATE extension_devices SET revoked=true WHERE id=$1',[d.id]);await recordMemberActivity(this.db,d.user_id,'extension_disconnected');return {ok:true}}
  await this.db.query('UPDATE extension_devices SET last_seen_at=now() WHERE id=$1',[d.id]);
  const membership=await membershipPolicy(this.db,d.workspace_id);
  if(e.operation==='status')return {connected:true,sender:d.sender,plan:membership.plan,policy:membership.policy,usage:membership.plan==='free'?await freeUsage(this.db,d.workspace_id):{unlimited:true}};
  if(['messages','message','drafts','remind','notifications','schedule'].includes(e.operation)){const user=(await this.db.query<Account>('SELECT id,workspace_id,email,name,role,email_verified_at FROM users WHERE id=$1',[d.user_id])).rows[0];if(!user)fail();const service=new TrackingService(this.db,new UnavailableProvider(),this.origin,undefined,this.archiveKey),tools=new MemberTools(this.db,this.gmail,this.archiveKey,this.origin,true);const p=e.payload;if(e.operation==='messages')return {messages:await service.list(d.workspace_id,typeof p.q==='string'?p.q.slice(0,200):'',0,{from:p.from as string|undefined,to:p.to as string|undefined,channel:p.channel as string|undefined,campaign:p.campaign as string|undefined})};if(e.operation==='message'){if(typeof p.id!=='string'||!uuid.test(p.id))throw Error('INVALID_REQUEST');const detail=await service.detail(d.workspace_id,p.id);if(!detail)throw Error('NOT_FOUND');return detail}if(e.operation==='drafts')return new MailDrafts(this.db,this.archiveKey,true).list(user);if(e.operation==='remind'){if(typeof p.messageId!=='string'||!uuid.test(p.messageId)||typeof p.dueAt!=='string')throw Error('INVALID_REQUEST');return tools.remind(user,p.messageId,p.dueAt)}if(e.operation==='schedule'){if(!p.message||typeof p.message!=='object'||typeof (p.message as any).tracking!=='boolean'||typeof p.dueAt!=='string'||typeof p.requestId!=='string'||Object.keys(p.message).some(k=>!['to','subject','text','html','cc','bcc','attachments','tracking','linkTracking','threadId','inReplyTo','references'].includes(k)))throw Error('INVALID_REQUEST');return tools.schedule(user,p.message as any,p.dueAt,p.requestId)}return tools.overview(user)}
  if(e.operation==='files'||e.operation==='file-share'){
   const user=(await this.db.query<Account>('SELECT id,workspace_id,email,name,role,email_verified_at FROM users WHERE id=$1',[d.user_id])).rows[0];if(!user)fail();
   const files=new FileSharing(this.db,this.archiveKey,process.env.APP_URL||process.env.NEXT_PUBLIC_APP_URL||this.origin,true,tx=>this.authorize(e,tx));
   if(e.operation==='files'){const listing=await files.list(user);return {files:listing.files.filter(f=>!f.locked&&f.state==='ready'),policy:listing.policy}}
   if(typeof e.payload.fileId!=='string'||!uuid.test(e.payload.fileId)||Object.keys(e.payload).some(k=>!['fileId','label'].includes(k)))throw Error('INVALID_FILE');
   return files.createShare(user,e.payload.fileId,{label:e.payload.label as string|undefined});
  }
  const p=e.payload;try{validateRichMessage(p as any);if(mailRecipients(p as any).to.length!==1)throw Error('INVALID_ACCOUNT')}catch{throw Error('INVALID_ACCOUNT')}
  if(typeof p.from!=='string'||p.from.toLowerCase()!==d.sender||typeof p.tracking!=='boolean'||typeof p.idempotencyKey!=='string'||!/^[A-Za-z0-9_-]{16,128}$/.test(p.idempotencyKey)||Object.keys(p).some(k=>!['from','to','subject','text','tracking','idempotencyKey','html','cc','bcc','attachments','threadId','inReplyTo','references','linkTracking'].includes(k)))throw Error('INVALID_ACCOUNT');
  if(!await allowRequest(this.db,'single-mail-send',d.workspace_id,20,60))throw Error('TOO_MANY_ATTEMPTS');
  const connected=await this.gmail.provider(d.workspace_id);if(connected.from.toLowerCase()!==d.sender)fail();
  return new TrackingService(this.db,connected.provider,this.origin,connected.from,this.archiveKey).send(d.workspace_id,'ext_'+p.idempotencyKey,{to:p.to,subject:p.subject,text:p.text,tracking:p.tracking,...Object.fromEntries(['html','cc','bcc','attachments','threadId','inReplyTo','references','linkTracking'].filter(k=>p[k]!==undefined).map(k=>[k,p[k]]))} as any,undefined,async tx=>{await this.authorize(e,tx)},'extension');
 }
 async status(user:Account){return {allowed:!!(await this.db.query("SELECT 1 FROM users u JOIN access_grants g ON g.workspace_id=u.workspace_id JOIN entitlements e ON e.workspace_id=u.workspace_id WHERE u.id=$1 AND u.email_verified_at IS NOT NULL AND g.plan IN ('team','business') AND e.status='active'",[user.id])).rows.length,devices:(await this.db.query('SELECT id,sender,created_at,last_seen_at,expires_at FROM extension_devices d WHERE user_id=$1 AND revoked=false AND expires_at>now() AND EXISTS(SELECT 1 FROM sessions s WHERE s.token_hash=d.session_hash AND s.expires_at>now())',[user.id])).rows}}
 async revoke(user:Account){await this.db.query('UPDATE extension_devices SET revoked=true WHERE user_id=$1',[user.id]);return {ok:true}}
}
