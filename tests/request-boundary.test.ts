import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {publicOrigin,guardPublicRequest}=createRequire(import.meta.url)('../packages/runtime/public-request.cjs');
const origins={SITE_URL:'https://folloopy.com',APP_URL:'https://panel.folloopy.com'};
test('Custom server pins its origin by deployment role and rejects host/origin spoofing before Next',()=>{
 assert.equal(publicOrigin({...origins,DEPLOYMENT_ROLE:'public'}),origins.SITE_URL);assert.equal(publicOrigin({...origins,DEPLOYMENT_ROLE:'panel'}),origins.APP_URL);
 assert.throws(()=>publicOrigin({}));assert.throws(()=>publicOrigin({SITE_URL:'https://user:pass@example.com'}));
 for(const host of ['evil.example','panel.folloopy.com.evil.example','panel.folloopy.com@evil.example','127.0.0.1','panel.folloopy.com:99','panel.folloopy.com,evil.example'])assert.equal(guardPublicRequest({method:'GET',headers:{host}},origins.APP_URL),421);
 for(const origin of [undefined,'null','https://evil.example','https://folloopy.com','https://panel.folloopy.com.evil.example'])assert.equal(guardPublicRequest({method:'POST',headers:{host:'panel.folloopy.com',origin,'x-forwarded-host':'evil.example'}},origins.APP_URL),403);
 const req={method:'POST',headers:{host:'panel.folloopy.com',origin:origins.APP_URL,'x-forwarded-host':'evil.example','x-forwarded-proto':'http'}};assert.equal(guardPublicRequest(req,origins.APP_URL),null);assert.equal(req.headers['x-forwarded-host'],'panel.folloopy.com');assert.equal(req.headers['x-forwarded-proto'],'https');
 assert.equal(guardPublicRequest({method:'GET',headers:{host:'folloopy.com'}},origins.SITE_URL),null);
});

test('Only the explicit public www alias redirects; unsafe requests and unknown hosts stay blocked',()=>{
 const{canonicalRedirect}=createRequire(import.meta.url)('../packages/runtime/public-request.cjs');
 assert.equal(canonicalRedirect({method:'GET',url:'/kayit?plan=team',headers:{host:'www.folloopy.com'}},origins.SITE_URL,true),'https://folloopy.com/kayit?plan=team');
 for(const request of [{method:'POST',url:'/giris',headers:{host:'www.folloopy.com'}},{method:'GET',url:'/kayit',headers:{host:'attacker.folloopy.com'}},{method:'GET',url:'//evil.example',headers:{host:'www.folloopy.com'}}])assert.equal(canonicalRedirect(request,origins.SITE_URL,true),null);
 assert.equal(canonicalRedirect({method:'GET',url:'/giris',headers:{host:'www.panel.folloopy.com'}},origins.APP_URL,false),null);
});

test('Chrome origin exception is limited to the credential-free extension transport',()=>{
 const origin='https://panel.folloopy.com';
 const req=(url:string,source:string,method='POST')=>({url,method,headers:{host:'panel.folloopy.com',origin:source}});
 const extension='chrome-extension://'+'a'.repeat(32);
 assert.equal(guardPublicRequest(req('/eklentiler/api',extension),origin),null);
 for(const path of ['/panel','/eklentiler/indir','/eklentiler/api/other','/eklentiler/api?x=1','/api/auth/logout'])assert.equal(guardPublicRequest(req(path,extension),origin),403);
 for(const source of ['https://attacker.example','chrome-extension://invalid','null',''])assert.equal(guardPublicRequest(req('/eklentiler/api',source),origin),403);
});
