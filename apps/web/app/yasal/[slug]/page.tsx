import {notFound} from 'next/navigation';
import {legalDocuments} from '../../legal-content';
import {LegalView} from '../../legal-view';
export function generateStaticParams(){return legalDocuments.map(d=>({slug:d.slug}))}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const doc=legalDocuments.find(d=>d.slug===slug);return {title:doc?doc.title+' · Folloopy':'Belge bulunamadı',description:doc?.description}}
export default async function LegalPage({params}:{params:Promise<{slug:string}>}){const{slug}=await params;const doc=legalDocuments.find(d=>d.slug===slug);if(!doc)notFound();return <LegalView document={doc}/>}
