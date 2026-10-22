'use client';
import {useLinkStatus} from 'next/link';
export function NavigationHint(){const{pending}=useLinkStatus();return pending?<span className="navigation-feedback" role="status"><span className="navigation-feedback-bar"/><span className="navigation-feedback-label">Sayfa açılıyor…</span></span>:null}
