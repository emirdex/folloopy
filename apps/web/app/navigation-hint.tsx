'use client';
import {useLinkStatus} from 'next/link';
import {createPortal} from 'react-dom';
import {FolloopyLoading} from './folloopy-loading';
export function NavigationHint(){const{pending}=useLinkStatus();return pending&&typeof document!=='undefined'?createPortal(<FolloopyLoading/>,document.body):null}
