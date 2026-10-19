import {isMarketingMode} from '../../../../packages/runtime/app-mode';
import {FolloopyLogo} from '../folloopy-brand';
import Link from 'next/link';
import {Activity,ArrowUpRight} from 'lucide-react';
import {SiteFooter} from '../site-footer';
import type {ReactNode} from 'react';
import './journal.css';
export function JournalShell({children}:{children:ReactNode}){return <div className="journal-page" id="main"><header className="journal-header"><Link className="commerce-brand" href="/"><FolloopyLogo/></Link><nav aria-label="Blog gezinme"><Link href="/">Ürün</Link><Link href="/#planlar">Paketler</Link><Link href="/blog" aria-current="page">Blog</Link></nav><Link href={isMarketingMode()?"/iletisim":"/giris"} className="journal-login">{isMarketingMode()?"Bize ulaşın":"Çalışma alanına geç"}<ArrowUpRight size={15}/></Link></header>{children}<SiteFooter marketing={isMarketingMode()}/></div>}
