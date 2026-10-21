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
