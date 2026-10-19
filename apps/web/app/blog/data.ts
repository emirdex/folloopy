import {internalApiUrl} from '../internal-api';
export type BlogPost={id:string;slug:string;title:string;excerpt:string;body?:string;cover_image?:string;cover_alt?:string;seo_title?:string;meta_description?:string;focus_keyword?:string;category:string;status:string;read_minutes?:number;published_at:string;updated_at:string};
export async function publicBlog(path=''){const res=await fetch(internalApiUrl()+'/public/blog'+path,{cache:'no-store',signal:AbortSignal.timeout(10000)});if(res.status===404)return null;if(!res.ok)throw new Error('BLOG_UNAVAILABLE');return res.json()}
export const blogDate=(date:string)=>new Intl.DateTimeFormat('tr-TR',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Istanbul'}).format(new Date(date));
