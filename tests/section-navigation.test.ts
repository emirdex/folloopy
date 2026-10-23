import {test} from 'node:test';
import assert from 'node:assert/strict';
import {samePageSectionId} from '../apps/web/app/section-navigation';

test('homepage sections can scroll without replacing the current address or campaign query',()=>{
 const current='https://folloopy.com/?utm_source=campaign';
 for(const href of ['#planlar','/#planlar','https://folloopy.com/#planlar'])assert.equal(samePageSectionId(href,current),'planlar');
 assert.equal(samePageSectionId('#nas%C4%B1l',current),'nasıl');
 assert.equal(samePageSectionId('https://folloopy.com/#planlar','https://folloopy.com/#planlar'),'planlar');
});

test('real page changes, other sites and malformed fragments retain normal navigation',()=>{
 for(const href of ['/blog','/kayit','https://panel.folloopy.com/kayit','https://example.com/#planlar','mailto:info@folloopy.com','/?view=activity#planlar','#%E0%A4%A','#'])assert.equal(samePageSectionId(href,'https://folloopy.com/'),null,href);
 assert.equal(samePageSectionId('/#planlar','https://folloopy.com/blog'),null);
 assert.equal(samePageSectionId('/blog#article','https://folloopy.com/'),null);
});
