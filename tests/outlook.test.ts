import test from 'node:test';
import assert from 'node:assert/strict';
import {OutlookSubmissionGateway} from '../packages/provider-adapters/outlook';
import {ProviderRejected} from '../packages/provider-adapters/index';
import {outlookReadiness,OUTLOOK_REDIRECT_URI} from '../packages/provider-adapters/outlook-readiness';
const mime='From: Sender <sender@example.invalid>\r\nTo: recipient@example.invalid\r\nSubject: Türkçe deneme\r\n\r\nİçerik';
test('Outlook never calls Graph while unverified or missing token',async()=>{
 let calls=0;const request:typeof fetch=async()=>{calls++;return new Response(null,{status:202})};
 for(const gateway of [new OutlookSubmissionGateway('synthetic',false,request),new OutlookSubmissionGateway(' ',true,request)])await assert.rejects(gateway.submit(mime),/OUTLOOK_UNAVAILABLE/);
 await assert.rejects(new OutlookSubmissionGateway('synthetic',true,request).submit(''),/OUTLOOK_INVALID_MIME/);assert.equal(calls,0);
});
test('Outlook sends UTF-8 MIME exactly once to fixed Graph endpoint without redirect following',async()=>{
 let calls=0;const request:typeof fetch=async(url,options)=>{calls++;assert.equal(url,'https://graph.microsoft.com/v1.0/me/sendMail');assert.equal(options?.method,'POST');assert.equal(options?.redirect,'error');assert.equal(new Headers(options?.headers).get('Content-Type'),'text/plain');assert.equal(Buffer.from(String(options?.body),'base64').toString('utf8'),mime);assert.ok(options?.signal);return new Response(null,{status:202})};
 const result=await new OutlookSubmissionGateway('synthetic',true,request).submit(mime);
 assert.deepEqual(result,{status:'accepted',deliveryConfirmed:false});assert.equal(calls,1);assert.equal('providerMessageId' in result,false);
});
test('Outlook explicit provider rejection is distinguishable from uncertain outcome',async()=>{
 for(const status of [400,401,403,404,413,422,429])await assert.rejects(new OutlookSubmissionGateway('synthetic',true,async()=>new Response(null,{status})).submit(mime),ProviderRejected);
});
test('Outlook timeout, network failures, unexpected success and server errors never retry or leak bodies',async()=>{
 for(const status of [200,204,302,408,500,502,503]){let calls=0;await assert.rejects(new OutlookSubmissionGateway('synthetic',true,async()=>{calls++;return new Response(status===204?null:'private-provider-body',{status})}).submit(mime),/^Error: OUTLOOK_SEND_UNCONFIRMED$/);assert.equal(calls,1)}
 let calls=0;await assert.rejects(new OutlookSubmissionGateway('synthetic',true,async()=>{calls++;throw Error('private-token')}).submit(mime),/^Error: OUTLOOK_SEND_UNCONFIRMED$/);assert.equal(calls,1);
});
test('Outlook configuration check never enables integration and never exposes secrets',()=>{
 const env={MICROSOFT_CLIENT_ID:'11111111-2222-3333-4444-555555555555',MICROSOFT_CLIENT_SECRET:'secret-not-for-output',MICROSOFT_TENANT:'common',MICROSOFT_REDIRECT_URI:OUTLOOK_REDIRECT_URI,OUTLOOK_CONFIGURATION_VERIFIED:'true'};
 assert.equal(outlookReadiness({}).configured,false);assert.equal(outlookReadiness(env).configured,true);assert.equal(outlookReadiness(env).available,false);
 assert.equal(JSON.stringify(outlookReadiness(env)).includes(env.MICROSOFT_CLIENT_SECRET),false);
 assert.equal(outlookReadiness({...env,MICROSOFT_CLIENT_SECRET_EXPIRES_AT:'2020-01-01'}).configured,false);
 assert.equal(outlookReadiness({...env,MICROSOFT_CLIENT_SECRET_EXPIRES_AT:'invalid'}).configured,false);
 assert.equal(outlookReadiness({...env,MICROSOFT_REDIRECT_URI:'https://attacker.invalid/callback'}).configured,false);
 assert.equal(outlookReadiness({...env,MICROSOFT_TENANT:'organizations'}).configured,false);
});
