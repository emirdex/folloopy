import {createHash,randomBytes} from 'node:crypto';
import type {DB} from '../../packages/database/index';
import type {Account} from './accounts';
import {seal,unseal} from '../../packages/runtime/vault';
import {GmailProvider} from '../../packages/provider-adapters/index';
const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
const sendScope='https://www.googleapis.com/auth/gmail.send';
export class GmailConnections{
 constructor(private db:DB,private site:string,private key:string){}
 get configured(){return !!(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET&&this.key)}
 private get redirect(){return this.site+'/baglantilar/google/callback'}
 async begin(user:Account,session:string){
  if(!this.configured)throw Error('GMAIL_UNAVAILABLE');
  const state=randomBytes(32).toString('base64url'),verifier=randomBytes(32).toString('base64url');
  await this.db.query("INSERT INTO oauth_states(token_hash,user_id,session_hash,verifier,expires_at) VALUES($1,$2,$3,$4,now()+interval '10 minutes')",[digest(state),user.id,digest(session),seal(verifier,this.key)]);
  const params=new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID!,redirect_uri:this.redirect,response_type:'code',scope:'openid email '+sendScope,access_type:'offline',prompt:'consent',state,code_challenge:digestBase64(verifier),code_challenge_method:'S256'});
  return 'https://accounts.google.com/o/oauth2/v2/auth?'+params;
 }
 private async token(body:Record<string,string>){
  const res=await fetch('https://oauth2.googleapis.com/token',{method:'POST',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({...body,client_id:process.env.GOOGLE_CLIENT_ID!,client_secret:process.env.GOOGLE_CLIENT_SECRET!})});
  if(!res.ok){const failure=await res.json().catch(()=>({})) as {error?:string};throw Error(failure.error==='invalid_client'?'GMAIL_CLIENT_INVALID':failure.error==='invalid_grant'?'GMAIL_CODE_INVALID':'GMAIL_AUTH_FAILED');}
  const result=await res.json() as {access_token:string;refresh_token?:string;scope?:string};if(!result.access_token)throw Error('GMAIL_AUTH_FAILED');return result;
 }
 async finish(user:Account,session:string,state:string,code:string){
  if(!this.configured)throw Error('GMAIL_UNAVAILABLE');
  const row=(await this.db.query<{verifier:string}>('SELECT verifier FROM oauth_states WHERE token_hash=$1 AND user_id=$2 AND session_hash=$3 AND expires_at>now()',[digest(state),user.id,digest(session)])).rows[0];if(!row)throw Error('INVALID_OAUTH_STATE');
  const tokens=await this.token({grant_type:'authorization_code',code,redirect_uri:this.redirect,code_verifier:unseal(row.verifier,this.key)});
  if(!tokens.scope?.split(' ').includes(sendScope))throw Error('GMAIL_SCOPE_REQUIRED');
  if(!tokens.refresh_token)throw Error('GMAIL_REFRESH_REQUIRED');const refreshToken=tokens.refresh_token;
  const res=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:'Bearer '+tokens.access_token},signal:AbortSignal.timeout(10000)});if(!res.ok)throw Error('GMAIL_IDENTITY_FAILED');const identity=await res.json() as {email?:string;email_verified?:boolean};
  if(!identity.email_verified||!identity.email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identity.email))throw Error('GMAIL_IDENTITY_FAILED');
  await this.db.transaction(async tx=>{
   await tx.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[user.id]);
   const sessionActive=(await tx.query('SELECT user_id FROM sessions WHERE token_hash=$1 AND user_id=$2 AND expires_at>now()',[digest(session),user.id])).rows.length;
   if(!sessionActive)throw Error('UNAUTHORIZED');
   const consumed=(await tx.query('DELETE FROM oauth_states WHERE token_hash=$1 AND user_id=$2 AND session_hash=$3 AND expires_at>now() RETURNING user_id',[digest(state),user.id,digest(session)])).rows.length;
   if(!consumed)throw Error('INVALID_OAUTH_STATE');
   await tx.query('INSERT INTO mail_connections(workspace_id,email,refresh_token,scopes) VALUES($1,$2,$3,$4) ON CONFLICT(workspace_id) DO UPDATE SET email=excluded.email,refresh_token=excluded.refresh_token,scopes=excluded.scopes,updated_at=now()',[user.workspace_id,identity.email,seal(refreshToken,this.key),tokens.scope]);
  });
 }
 async status(workspace:string){const row=(await this.db.query<{email:string}>('SELECT email FROM mail_connections WHERE workspace_id=$1',[workspace])).rows[0];return {configured:this.configured,connected:!!row,email:row?.email||null}}
 async disconnect(workspace:string){const row=await this.db.transaction(async tx=>{
  await tx.query('SELECT id FROM users WHERE workspace_id=$1 FOR UPDATE',[workspace]);
  await tx.query('DELETE FROM oauth_states WHERE user_id IN (SELECT id FROM users WHERE workspace_id=$1)',[workspace]);
  return (await tx.query<{refresh_token:string}>('DELETE FROM mail_connections WHERE workspace_id=$1 RETURNING refresh_token',[workspace])).rows[0];
 });if(row){try{await fetch('https://oauth2.googleapis.com/revoke',{method:'POST',signal:AbortSignal.timeout(10000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:unseal(row.refresh_token,this.key)})})}catch{/* Local access is already revoked; no token remains in the application. */}}}
 async provider(workspace:string){const row=(await this.db.query<{email:string;refresh_token:string}>('SELECT email,refresh_token FROM mail_connections WHERE workspace_id=$1',[workspace])).rows[0];if(!row||!this.configured)throw Error('GMAIL_NOT_CONNECTED');const tokens=await this.token({grant_type:'refresh_token',refresh_token:unseal(row.refresh_token,this.key)});return {provider:new GmailProvider(tokens.access_token),from:row.email}}
}
function digestBase64(s:string){return createHash('sha256').update(s).digest('base64url')}
