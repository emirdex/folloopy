import {WorkspaceShell} from './workspace-shell';
import {MessageDrawerProvider} from './message-drawer';
import type {ReactNode} from 'react';
import {Package,Gem,Sparkles} from 'lucide-react';
import {requirePanel} from '../account-api';
import Link from '../destination-link';
import './account-bar.css';
import {AccountMenu} from './account-menu';
import {PanelNavigation} from './panel-navigation';
export const metadata={title:'Folloopy · Çalışma alanı',description:'Folloopy kişisel çalışma alanı'};
export default async function PanelLayout({children}:{children:ReactNode}){
 const user=await requirePanel();
 const names:Record<string,string>={free:'Free',individual:'Essential',team:'Signature',business:'Enterprise'};
 const plan=user?.plan?names[user.plan]||'Paketim':null;
 return <div className="member-panel-page"><PanelNavigation/><div className="workspace-account-bar"><div className="workspace-account-context">{plan?<Link href="/panel?view=account" className={'workspace-plan-pill'+(user?.plan==='team'?' is-signature':' is-essential')} aria-label={`${plan} paketimin ayrıntıları`}><span className="workspace-plan-symbol" aria-hidden="true">{user?.plan==='team'?<Gem size={14}/>:<Package size={12}/>}</span><span className="workspace-plan-label">{plan}</span>{user?.plan==='team'?<Sparkles className="workspace-plan-sparkle" size={11} aria-hidden="true"/>:null}</Link>:null}</div><AccountMenu plan={plan||undefined} name={user?.name} email={user?.email} preview={!user} owner={user?.role==='owner'}/></div><MessageDrawerProvider key={user?.id||'preview'}><WorkspaceShell user={user}>{children}</WorkspaceShell></MessageDrawerProvider></div>;
}
