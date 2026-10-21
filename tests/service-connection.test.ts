import test from 'node:test';
import assert from 'node:assert/strict';
import {probeService} from '../packages/domain/service-connection';
test('Connection indicator confirms actual application health, not just a successful HTTP response',async()=>{
 const signal=new AbortController().signal;
 const result=(body:unknown,status=200)=>probeService(signal,(async()=>Response.json(body,{status})) as typeof fetch);
 assert.equal(await result({status:'ok'}),'online');
 assert.equal(await result({status:'ok',mode:'marketing'}),'unavailable');
 assert.equal(await result({status:'unavailable'},503),'unavailable');
 assert.equal(await result({status:'unavailable'}),'unavailable');
 assert.equal(await result({},401),'session');
 assert.equal(await probeService(signal,(async()=>new Response('<html>Error</html>')) as typeof fetch),'disconnected');
});
test('Connection indicator distinguishes network failure from a health-check timeout',async()=>{
 const request=(async()=>{throw new TypeError('Failed to fetch')}) as typeof fetch;
 assert.equal(await probeService(new AbortController().signal,request),'disconnected');
 const controller=new AbortController();controller.abort('timeout');
 assert.equal(await probeService(controller.signal,request),'timeout');
});
