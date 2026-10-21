import Link from 'next/link';
import {ArrowLeft} from 'lucide-react';
export function SecurityReturnLink(){return <Link className="security-return-link" href="/giris"><span aria-hidden="true"><ArrowLeft size={17}/></span>Giriş Ekranına Dön</Link>}
