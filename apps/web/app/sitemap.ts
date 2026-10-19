import type {MetadataRoute} from 'next';
import {publicBlog} from './blog/data';
import {legalDocuments} from './legal-content';
export const dynamic='force-dynamic';
export default async function sitemap():Promise<MetadataRoute.Sitemap>{const site=process.env.SITE_URL||'https://folloopy.com';const posts=await publicBlog().catch(()=>({rows:[]}));return [...['','/blog','/hakkimizda','/iletisim',...legalDocuments.map(d=>'/yasal/'+d.slug)].map(path=>({url:site+path})),...(posts?.rows||[]).map((p:{slug:string;updated_at:string})=>({url:site+'/blog/'+p.slug,lastModified:new Date(p.updated_at)}))]}
