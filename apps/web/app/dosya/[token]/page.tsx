import {FileViewer} from '../viewer';
export const dynamic='force-dynamic';
export const metadata={title:'Folloopy · Dosya paylaşımı',robots:{index:false,follow:false},referrer:'no-referrer'};
export default async function SharedFilePage({params}:{params:Promise<{token:string}>}){const {token}=await params;return <FileViewer token={token}/>}
