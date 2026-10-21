import test from 'node:test';
import assert from 'node:assert/strict';
import {ownerSetupIssue} from '../packages/domain/owner-setup';
function form(overrides:Record<string,string>={}){const f=new FormData();for(const[k,v]of Object.entries({name:'Site Sahibi',token:'a'.repeat(43),password:'Şifre!ğü',confirmation:'Şifre!ğü',...overrides}))f.set(k,v);return f;}
test('Owner setup gives a specific visible error for missing fields and mismatched passwords',()=>{
 assert.equal(ownerSetupIssue(form({name:' '}))?.field,'name');
 assert.equal(ownerSetupIssue(form({token:''}))?.field,'token');
 assert.equal(ownerSetupIssue(form({password:'abcdefgh'}))?.field,'password');
 assert.equal(ownerSetupIssue(form({confirmation:'Farklı!a'}))?.field,'confirmation');
 assert.equal(ownerSetupIssue(form({name:' Site Sahibi ',token:' '+ 'a'.repeat(43)+' '})),null);
 assert.equal(ownerSetupIssue(form()),null);
});
