import {isMarketingMode} from '../../../../packages/runtime/app-mode';
import {JournalHeader} from './journal-header';
import {SiteFooter} from '../site-footer';
import type {ReactNode} from 'react';
import './journal.css';
export function JournalShell({children}:{children:ReactNode}){const marketing=isMarketingMode();return <div className="journal-page" id="main"><JournalHeader marketing={marketing}/>{children}<SiteFooter marketing={marketing}/></div>}
