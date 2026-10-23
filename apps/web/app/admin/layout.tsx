import type {ReactNode} from 'react';
import {PanelNavigation} from '../panel/panel-navigation';
import './admin.css';
import './workspace.css';
export const metadata={title:'Site yönetimi · Folloopy',robots:{index:false,follow:false}};
export default function AdminLayout({children}:{children:ReactNode}){return <div className="admin-root"><PanelNavigation/>{children}</div>}
