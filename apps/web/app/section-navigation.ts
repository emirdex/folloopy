/** Only an existing section of the current page may replace normal navigation. */
export function samePageSectionId(href:string,currentHref:string):string|null{
 try{
  const current=new URL(currentHref),target=new URL(href,current);
  if(target.origin!==current.origin||target.pathname!==current.pathname||!target.hash)return null;
  if(target.search&&target.search!==current.search)return null;
  return decodeURIComponent(target.hash.slice(1))||null;
 }catch{return null}
}
