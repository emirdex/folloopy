import {FolloopyLogo} from '../../folloopy-brand';
import {redirect} from 'next/navigation';
import Link from '../../destination-link';
import {ShieldCheck,Activity} from 'lucide-react';
import {accountApi} from '../../account-api';
import {OwnerSetupForm} from '../forms';
export default async function Setup(){const status=await accountApi('/api/admin/setup-status') as {available:boolean;email:string|null};if(!status.available)redirect('/admin');return <main className="owner-setup"><Link href="/" className="admin-brand"><FolloopyLogo/></Link><section className="admin-surface"><ShieldCheck size={32}/><span className="admin-kicker">YALNIZCA SİTE SAHİBİ İÇİN</span><h1>Yönetim alanınızı açın.</h1><p>Tek kullanımlık kurulum anahtarınızla hesabınızı etkinleştirin. Bu işlemden sonra kurulum sayfası kapanır.</p><OwnerSetupForm email={status.email!}/></section></main>}
