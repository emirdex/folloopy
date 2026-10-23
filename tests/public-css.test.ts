import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const {publicCss}=require('../scripts/build/public-css-loader.cjs');
const postcss=require('postcss');

test('public CSS preserves shared, interactive and animation rules in their original order',()=>{
 const source='.button:hover{color:red}@media(max-width:650px){.member-panel-page .button{padding:9px}.site-header .button{padding:8px}.message-table,.site-plans{display:grid}}@keyframes dot-breathe{0%{opacity:0}100%{opacity:1}}.folloopy-loading-eyes{animation:dot-breathe 2s}.metricology{color:blue}';
 assert.equal(publicCss(source),'.button:hover{color:red}@media(max-width:650px){.site-header .button{padding:8px}.message-table,.site-plans{display:grid}}@keyframes dot-breathe{0%{opacity:0}100%{opacity:1}}.folloopy-loading-eyes{animation:dot-breathe 2s}.metricology{color:blue}');
});

test('public sheets keep every surviving declaration and keyframe unchanged',()=>{
 for(const file of ['style.css','mobile.css']){
  const source=readFileSync(new URL('../apps/web/app/'+file,import.meta.url),'utf8');
  const original=postcss.parse(source),filtered=postcss.parse(publicCss(source));
  const rules=new Set<string>();original.walkRules((rule:any)=>rules.add(rule.toString()));
  filtered.walkRules((rule:any)=>assert.ok(rules.has(rule.toString()),file+': changed design rule '+rule.selector));
  const keyframes=(root:any)=>{const frames:string[]=[];root.walkAtRules(/keyframes$/,(rule:any)=>frames.push(rule.toString()));return frames};
  assert.deepEqual(keyframes(filtered),keyframes(original),file+': animation changed');
 }
});

test('landing demo keeps the metric colors shared with the account panel',()=>{
 const source='.metric-blue{background:blue}.metric-mint>small{color:green}.metric>strong{font-size:48px}';
 assert.equal(publicCss(source),'.metric-blue{background:blue}.metric-mint>small{color:green}');
});
