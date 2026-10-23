'use client';
import {useRouter} from 'next/navigation';
import {Search,ArrowRight} from 'lucide-react';
import {activityHref} from '../../../../packages/domain/activity-feed';
export function ActivitySearch({query,range,filter}:{query:string;range:string;filter:string}){
 const router=useRouter();
 return <form action="/panel" method="get" className="stream-search" role="search" aria-label="Etkinliklerde ara" onSubmit={event=>{
  event.preventDefault();const data=new FormData(event.currentTarget);
  const href=activityHref({q:String(data.get('q')||'').trim(),range:String(data.get('range')||'all'),filter});
  window.dispatchEvent(new CustomEvent('folloopy:panel-navigate',{detail:{href}}));router.push(href,{scroll:false});
 }}><input type="hidden" name="view" value="activity"/><input type="hidden" name="filter" value={filter}/>
 <label className="stream-search-field"><Search size={16} aria-hidden="true"/><input name="q" aria-label="Etkinliklerde mail konusu ara" placeholder="Mail konusuna göre ara…" defaultValue={query} maxLength={200}/></label>
 <label className="stream-range"><span>Tarih aralığı</span><select name="range" defaultValue={range}><option value="all">Tüm zamanlar</option><option value="7">Son 7 gün</option><option value="30">Son 30 gün</option><option value="90">Son 90 gün</option></select></label>
 <button type="submit">Uygula<ArrowRight size={15} aria-hidden="true"/></button></form>;
}

export function ActivityPageJump({page,pages,query,range,filter}:{page:number;pages:number;query:string;range:string;filter:string}){
 const router=useRouter();
 if(pages<2)return <span className="stream-page-number">{page} / {pages}</span>;
 return <form className="stream-page-jump" aria-label="Etkinlik sayfasına git" onSubmit={event=>{
  event.preventDefault();const value=Number(new FormData(event.currentTarget).get('page'));
  if(!Number.isInteger(value)||value<1||value>pages||value===page)return;
  const href=activityHref({q:query,range,filter,offset:(value-1)*10});
  window.dispatchEvent(new CustomEvent('folloopy:panel-navigate',{detail:{href}}));router.push(href,{scroll:false});
 }}><input type="number" name="page" aria-label="Etkinlik sayfa numarası" min={1} max={pages} step={1} required defaultValue={page}/><span>/ {pages}</span><button type="submit" aria-label="Girilen etkinlik sayfasına git"><ArrowRight size={13} aria-hidden="true"/></button></form>;
}
