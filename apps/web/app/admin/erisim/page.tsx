import Link from 'next/link';
import {ShieldCheck} from 'lucide-react';
export default function Denied(){return <main className="owner-setup"><section className="admin-surface"><ShieldCheck size={32}/><h1>Bu alan site yöneticisine aittir.</h1><p>Üye hesabınız yönetim erişimi içermez.</p><Link href="/panel" className="admin-primary">Çalışma alanına dön</Link><Link href="/" className="admin-quiet">Web sitesine dön</Link></section></main>}
