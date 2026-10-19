import {currentAccount} from './account-api';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {Landing} from './landing';
import './landing.css';
export const metadata={title:'Folloopy · Tekliflerinizi takip edin, ilgiyi fırsata dönüştürün',description:'Soğuk satış e-postalarınızın ve tekliflerinizin etkileşimlerini takip edin. Müşteri ilgisini analiz edin, satış görüşmelerinizi önceliklendirin.'};
export default async function Home({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const params=await searchParams;
 if(params.view||params.id||params.filter||params.mode||params.q){const query=new URLSearchParams();for(const[k,v]of Object.entries(params))if(typeof v==='string')query.set(k,v);redirect('/panel?'+query.toString())}
 const store=await cookies();
 const user=await currentAccount();
 return <Landing hasPreview={!!user?.plan||(process.env.NODE_ENV!=='production'&&store.get('mail_tracking_preview')?.value==='active')} hasAccount={!!user}/>;
}
