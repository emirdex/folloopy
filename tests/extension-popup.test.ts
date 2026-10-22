import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../extensions/gmail/popup.js',import.meta.url),'utf8');
async function popup(responses:any[],pair:any=null){
 const elements:any={};const calls:string[]=[];
 const document={getElementById(id:string){return elements[id]??={hidden:false,disabled:false,textContent:'',dataset:{},setAttribute(k:string,v:string){this[k]=v}}}};
 const chrome={runtime:{async sendMessage({operation}:any){calls.push(operation);const r=responses.shift();if(r instanceof Error)throw r;return r}},storage:{local:{async get(){return {pair}}}}};
 vm.runInNewContext(source,{document,chrome,Date,Error});
 await new Promise(resolve=>setImmediate(resolve));
 return {elements,calls,async click(id:string){await elements[id].onclick();}};
}
const ok=(result:any)=>({ok:true,result});const fail=(error:string)=>({ok:false,error});
test('validated account shows one primary action and safely renders the address',async()=>{
 const {elements:e}=await popup([ok({sender:'<img src=x>@example.com'})]);
 assert.equal(e.popup.dataset.state,'connected');assert.equal(e.sender.textContent,'<img src=x>@example.com');assert.equal(e.panel.hidden,false);assert.equal(e.pair.hidden,true);assert.equal(e.check.hidden,true);assert.equal(e.account.hidden,false);
});
test('unpaired account starts pairing and only shows confirmation action while pending',async()=>{
 const p=await popup([fail('NOT_PAIRED'),ok({pending:true}),ok({sender:'member@example.com'})]);
 assert.equal(p.elements.pair.hidden,false);assert.equal(p.elements.notice.hidden,true);
 await p.click('pair');assert.equal(p.elements.popup.dataset.state,'pending');assert.equal(p.elements.pair.hidden,true);assert.equal(p.elements.check.hidden,false);
 await p.click('check');assert.equal(p.elements.popup.dataset.state,'connected');assert.deepEqual(p.calls,['status','pair','exchange']);
});
test('reopened popup resumes an unexpired pairing without exposing its secret',async()=>{
 const p=await popup([fail('NOT_PAIRED')],{expires:Date.now()+60000,secret:'PRIVATE'});
 assert.equal(p.elements.popup.dataset.state,'pending');assert.ok(!JSON.stringify(p.elements).includes('PRIVATE'));
 const expired=await popup([fail('NOT_PAIRED')],{expires:Date.now()-1});assert.equal(expired.elements.popup.dataset.state,'unpaired');
});
test('expired or revoked access offers reconnect without claiming a verified connection',async()=>{
 for(const error of ['PAIR_EXPIRED','UNAUTHORIZED','FORBIDDEN']){
 const p=await popup([fail(error)]);assert.equal(p.elements.popup.dataset.state,'unpaired');assert.equal(p.elements.panel.hidden,true);assert.equal(p.elements.account.hidden,true);assert.equal(p.elements.notice.hidden,false);
 }
});
test('network failure offers retry and recovers through fresh server validation',async()=>{
 const p=await popup([new Error('offline'),ok({sender:'member@example.com'})]);assert.equal(p.elements.popup.dataset.state,'error');assert.equal(p.elements.retry.hidden,false);assert.equal(p.elements.panel.hidden,true);
 await p.click('retry');assert.equal(p.elements.popup.dataset.state,'connected');
});
test('disconnect clears account display even when server revocation fails',async()=>{
 for(const response of [ok({ok:true}),fail('SERVICE_UNAVAILABLE')]){
 const p=await popup([ok({sender:'member@example.com'}),response]);await p.click('disconnect');assert.equal(p.elements.popup.dataset.state,'unpaired');assert.equal(p.elements.sender.textContent,'');assert.equal(p.elements.disconnect.hidden,true);
 }
});
test('busy state prevents duplicate pairing requests',async()=>{
 const elements:any={};let resolve:any;let calls=0;
 const document={getElementById(id:string){return elements[id]??={hidden:false,dataset:{},setAttribute(){}}}};
 vm.runInNewContext(source,{document,Date,Error,chrome:{runtime:{sendMessage(){calls++;return new Promise(r=>resolve=r)}},storage:{local:{get:async()=>({})}}}});
 assert.equal(elements.pair.disabled,true);await elements.pair.onclick();assert.equal(calls,1);
 resolve(fail('NOT_PAIRED'));await new Promise(r=>setImmediate(r));assert.equal(elements.pair.disabled,false);
});
