import type {ReactNode} from 'react';
import {requirePanel} from '../account-api';
import {logoutAccount} from '../account-actions';
import {endPurchasePreview} from '../preview-actions';
import {Icon} from '../icons';
export const metadata={title:'Folloopy · Çalışma alanı',description:'Folloopy kişisel çalışma alanı'};
export default async function PanelLayout({children}:{children:ReactNode}){
 const user=await requirePanel();
 const names={individual:'Essential',team:'Signature',business:'Enterprise'};
 return <div className="member-panel-page"><div className="purchase-preview-bar"><span><Icon name="shield" size={13}/>{user?`${user.name} · ${names[user.plan!]} paketi · Kişisel çalışma alanınız.`:'Folloopy çalışma alanı'}</span><div className="panel-account-actions">{user?<a href="/paketler">Paketi yönet</a>:null}<form action={user?logoutAccount:endPurchasePreview}><button>{user?'Çıkış yap':'Çıkış yap'}<Icon name="close" size={13}/></button></form></div></div>{children}</div>;
}
