import {isMarketingMode} from '../../../../packages/runtime/app-mode';
import {posts} from '../../../api/blog-seed';
import {internalApiUrl} from '../internal-api';
export type BlogPost={id:string;slug:string;title:string;excerpt:string;body?:string;cover_image?:string;cover_alt?:string;seo_title?:string;meta_description?:string;focus_keyword?:string;category:string;status:string;read_minutes?:number;published_at:string;updated_at:string};
export async function publicBlog(path=''){
 if(isMarketingMode()){
  const rows=posts.map(p=>({...p,id:p.slug,status:'published',published_at:'2026-10-19T09:00:00Z',updated_at:'2026-10-19T09:00:00Z',read_minutes:Math.max(1,Math.ceil(p.body.length/900))}));
  if(path.startsWith('/'))return rows.find(p=>p.slug===decodeURIComponent(path.slice(1)))||null;
  const query=new URLSearchParams(path.replace(/^\?/,'')),q=(query.get('q')||'').toLocaleLowerCase('tr'),offset=Math.max(0,Number(query.get('offset'))||0);
  const filtered=rows.filter(p=>(p.title+' '+p.excerpt+' '+p.category).toLocaleLowerCase('tr').includes(q));return {rows:filtered.slice(offset,offset+24),total:filtered.length};
 }
const res=await fetch(internalApiUrl()+'/public/blog'+path,{cache:'no-store',signal:AbortSignal.timeout(10000)});if(res.status===404)return null;if(!res.ok)throw new Error('BLOG_UNAVAILABLE');return res.json()}
export const blogDate=(date:string)=>new Intl.DateTimeFormat('tr-TR',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Istanbul'}).format(new Date(date));
