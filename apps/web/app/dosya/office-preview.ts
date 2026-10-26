import {unzipSync,strFromU8} from 'fflate';
export function officePreview(bytes:Uint8Array,extension:string):{title:string;text:string}[]{
 let total=0,count=0;
 const entries=unzipSync(bytes,{filter:f=>{if(++count>2000)throw Error('Dosya çok fazla bileşen içeriyor.');const selected=/^(?:word\/document\.xml|ppt\/slides\/slide\d+\.xml|xl\/(?:sharedStrings\.xml|worksheets\/sheet\d+\.xml))$/.test(f.name);if(!selected)return false;total+=f.originalSize;if(f.originalSize>4*1024*1024||total>20*1024*1024)throw Error('İçerik önizleme sınırını aşıyor.');return true}});
 const xml=(name:string)=>{const b=entries[name];if(!b)throw Error('Bu belgenin içeriği önizlenemiyor.');const value=strFromU8(b);if(/<!DOCTYPE|<!ENTITY/i.test(value))throw Error('Belge güvenli biçimde önizlenemiyor.');const doc=new DOMParser().parseFromString(value,'application/xml');if(doc.getElementsByTagName('parsererror').length)throw Error('Belge içeriği okunamadı.');return doc};
 const nodes=(el:Document|Element,local:string)=>Array.from(el.getElementsByTagNameNS('*',local));
 const text=(el:Document|Element)=>nodes(el,'t').map(n=>n.textContent||'').join('');
 if(extension==='docx')return [{title:'Belge içeriği',text:nodes(xml('word/document.xml'),'p').map(text).join('\n').slice(0,300000)}];
 const ordered=(prefix:string)=>Object.keys(entries).filter(k=>k.startsWith(prefix)).sort((a,b)=>Number(a.match(/(\d+)\.xml$/)?.[1])-Number(b.match(/(\d+)\.xml$/)?.[1]));
 if(extension==='pptx')return ordered('ppt/slides/').slice(0,200).map((name,i)=>({title:'Slayt '+(i+1),text:nodes(xml(name),'p').map(text).join('\n').slice(0,50000)}));
 const strings=entries['xl/sharedStrings.xml']?nodes(xml('xl/sharedStrings.xml'),'si').map(text):[];
 return ordered('xl/worksheets/').slice(0,50).map((name,i)=>({title:'Çalışma sayfası '+(i+1),text:nodes(xml(name),'row').slice(0,1000).map(row=>nodes(row,'c').slice(0,100).map(cell=>{const value=nodes(cell,'v')[0]?.textContent||'';return (cell.getAttribute('r')||'')+': '+(cell.getAttribute('t')==='s'?strings[Number(value)]||'':cell.getAttribute('t')==='inlineStr'?text(cell):value)}).join(' | ')).join('\n').slice(0,300000)}));
}
