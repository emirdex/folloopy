import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {MouseEvent} from 'react';
import Link from '../apps/web/app/destination-link';

test('all panel destinations use browser links independent of pending RSC navigation',()=>{
 for(const href of ['/panel','/panel?view=drafts','/panel?view=setup','/panel?view=extensions','/panel?view=account#billing','/panel?id=example','https://panel.folloopy.com/panel?view=compose']){
  const link=Link({href,className:'nav-item',children:'Hedef',prefetch:false,scroll:false,'aria-current':'page'});
  assert.equal(link.type,'a',href);
  assert.equal(link.props.href,href);
  assert.equal(link.props.className,'nav-item');
  assert.equal(link.props['aria-current'],'page');
  assert.equal(link.props.prefetch,undefined);
  assert.equal(link.props.scroll,undefined);
  const event=click();link.props.onClick(event);
  assert.equal(event.defaultPrevented,false,'the browser owns navigation; no router interception or delayed fallback');
 }
 for(const href of ['/blog','/#planlar','/admin?view=members','/panel-other','mailto:info@folloopy.com'])assert.notEqual(Link({href}).type,'a',href);
});

function click(overrides:Record<string,unknown>={}){
 const event={button:0,metaKey:false,ctrlKey:false,shiftKey:false,altKey:false,defaultPrevented:false,currentTarget:{target:'',hasAttribute:()=>false},preventDefault(){this.defaultPrevented=true},...overrides};
 return event as unknown as MouseEvent<HTMLAnchorElement>;
}

test('panel links retain click animations, cancellation, keyboard and new-tab behavior',()=>{
 let clicks=0,navigations=0;
 const link=Link({href:'/panel?view=compose',onClick:()=>clicks++,onNavigate:()=>navigations++});
 for(const event of [click(),click({ctrlKey:true}),click({metaKey:true}),click({shiftKey:true}),click({button:1}),click({currentTarget:{target:'_blank',hasAttribute:()=>false}}),click({currentTarget:{target:'',hasAttribute:()=>true}})])link.props.onClick(event);
 assert.equal(clicks,7);assert.equal(navigations,1);
 const cancelled=click();Link({href:'/panel',onClick:e=>e.preventDefault(),onNavigate:()=>navigations++}).props.onClick(cancelled);
 assert.equal(cancelled.defaultPrevented,true);assert.equal(navigations,1);
 const guarded=click();Link({href:'/panel',onNavigate:e=>e.preventDefault()}).props.onClick(guarded);
 assert.equal(guarded.defaultPrevented,true);
});
