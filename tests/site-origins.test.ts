import test from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from 'next/server';
import {siteOrigins,destinationHref} from '../packages/runtime/site-origins';
import {proxy} from '../apps/web/proxy';
const origins={SITE_URL:'https://folloopy.com',APP_URL:'https://panel.folloopy.com'};
test('Account and public links use separate explicit origins; local anchors and external destinations stay intact',()=>{
 for(const path of ['/giris','/kayit?plan=team','/panel?id=123','/hesap/dogrula#token=legacy','/admin','/odeme'])assert.equal(destinationHref(path,origins),origins.APP_URL+path);
 for(const path of ['/','/#planlar','/blog/post','/yasal/gizlilik-politikasi'])assert.equal(destinationHref(path,origins),origins.SITE_URL+path);
 for(const path of ['#main','mailto:info@folloopy.com','https://outside.example/','//outside.example/path','/t/o/existing.gif'])assert.equal(destinationHref(path,origins),path);
 assert.equal(destinationHref('/panel',{}),'/panel');assert.equal(siteOrigins(origins).split,true);
 assert.throws(()=>siteOrigins({...origins,APP_URL:'https://user:password@example.com'}),/CONFIG_ORIGIN/);
});
test('Split hosts redirect safe navigation, preserve query, reject cross-host request bodies and preserve old pixel URLs',()=>{
 const old={...process.env};Object.assign(process.env,{...origins,APP_MODE:'application'});
 try{
  for(const path of ['/giris','/panel?view=account','/sifre-yenile','/hesap/dogrula']){
   const response=proxy(new NextRequest(origins.SITE_URL+path));assert.equal(response.headers.get('location'),origins.APP_URL+path);assert.equal(response.headers.get('cache-control'),'no-store');
   assert.equal(proxy(new NextRequest(origins.SITE_URL+path,{method:'POST',body:'private password'})).status,409);
  }
  assert.equal(proxy(new NextRequest(origins.APP_URL+'/')).headers.get('location'),origins.APP_URL+'/panel');
  assert.equal(proxy(new NextRequest(origins.SITE_URL+'/?view=messages&q=example')).headers.get('location'),origins.APP_URL+'/panel?view=messages&q=example');
  assert.equal(proxy(new NextRequest(origins.SITE_URL+'/?utm_source=example')).headers.get('location'),null);
  assert.equal(proxy(new NextRequest(origins.APP_URL+'/blog?tag=a')).headers.get('location'),origins.SITE_URL+'/blog?tag=a');
  assert.equal(proxy(new NextRequest(origins.APP_URL+'/panel')).headers.get('x-robots-tag'),'noindex, nofollow');
  for(const path of ['/t/o/existing.gif','/health','/blog'])assert.equal(proxy(new NextRequest(origins.SITE_URL+path)).headers.get('location'),null);
 }finally{for(const key of Object.keys(process.env))if(!(key in old))delete process.env[key];Object.assign(process.env,old)}
});
