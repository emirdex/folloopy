import type {ReactNode} from 'react';
import {Package,LayoutDashboard} from 'lucide-react';
import {requirePanel} from '../account-api';
import Link from '../destination-link';
import './account-bar.css';
import {AccountMenu} from './account-menu';
export const metadata={title:'Folloopy · Çalışma alanı',description:'Folloopy kişisel çalışma alanı'};
export default async function PanelLayout({children}:{children:ReactNode}){
 const user=await requirePanel();
 const names:Record<string,string>={individual:'Essential',team:'Signature',business:'Enterprise'};
 const plan=user?.plan?names[user.plan]||'Paketim':null;
 return <div className="member-panel-page"><div className="workspace-account-bar"><div className="workspace-account-context"><LayoutDashboard size={14} aria-hidden="true"/><span>Çalışma alanı</span>{plan?<Link href="/panel?view=account" className="workspace-plan-pill" aria-label={`${plan} paketimin ayrıntıları`}><Package size={12} aria-hidden="true"/>{plan}</Link>:null}</div><AccountMenu name={user?.name} email={user?.email} preview={!user}/></div>{children}</div>;
}
