import { randomUUID } from 'node:crypto';
export interface Submission { submissionId:string; rfcMessageId:string; raw:string;threadId?:string }
export interface Receipt { providerMessageId:string; threadId:string }
export class ProviderRejected extends Error{constructor(){super('PROVIDER_REJECTED')}}
export interface MailProvider { readonly name:string; send(message:Submission):Promise<Receipt> }
// Bu adaptör dış ağa veya gerçek alıcılara gönderim yapmaz.
export class FakeProvider implements MailProvider {
 readonly name='fake';
 readonly submissions:Submission[]=[];
 constructor(private readonly mode:'accept'|'timeout'='accept'){}
 async send(message:Submission):Promise<Receipt>{
  this.submissions.push(message);
  if(this.mode==='timeout') throw new Error('PROVIDER_OUTCOME_UNKNOWN');
  return {providerMessageId:`fake-${randomUUID()}`,threadId:`fake-thread-${randomUUID()}`};
 }
}
// OAuth token yenileme ve güvenli hesap deposu tamamlanmadan API'ye bağlanmaz.
// HTTP timeout/5xx sonucu otomatik retry edilmez; servis unknown durumuna geçirir.
export class GmailProvider implements MailProvider {
 readonly name='gmail';
 constructor(private readonly accessToken:string){}
 async send(message:Submission):Promise<Receipt>{
  const response=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{
   method:'POST',signal:AbortSignal.timeout(15000),headers:{Authorization:`Bearer ${this.accessToken}`,'Content-Type':'application/json'},
   body:JSON.stringify({raw:Buffer.from(message.raw).toString('base64url'),...(message.threadId?{threadId:message.threadId}:{})})
  });
  if([400,401,403,413,429].includes(response.status))throw new ProviderRejected();
  if(!response.ok) throw new Error('GMAIL_SEND_UNCONFIRMED');
  const body=await response.json() as {id?:string;threadId?:string};
  if(!body.id||!body.threadId) throw new Error('GMAIL_RECEIPT_INVALID');
  return {providerMessageId:body.id,threadId:body.threadId};
 }
}

export class UnavailableProvider implements MailProvider{readonly name='unavailable';async send(_message:Submission):Promise<Receipt>{throw new Error('PROVIDER_NOT_CONFIGURED')}}
