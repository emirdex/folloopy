import type {ReactNode} from 'react';
import type {Viewport} from 'next';
import './style.css';
import './folloopy-brand.css';
export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover'};
export const metadata={metadataBase:new URL(process.env.SITE_URL||process.env.NEXT_PUBLIC_SITE_URL||'https://folloopy.com'),title:'Folloopy · E-posta takibi',description:'Folloopy ile e-postalarınızın açılma ve içerik etkileşimlerini takip edin',applicationName:'Folloopy'};
export default function Layout({children}:{children:ReactNode}){return <html lang="tr"><body>{children}</body></html>}
