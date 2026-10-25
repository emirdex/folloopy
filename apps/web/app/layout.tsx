import type {ReactNode} from 'react';
import type {Viewport} from 'next';
import {brandLogo,brandLogoSources,brandLogoSizes} from './brand-assets';
import {assetRecoveryScript} from './asset-recovery';
import './style.css';
import './folloopy-brand.css';
import './mobile.css';
export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover'};
export const metadata={metadataBase:new URL(process.env.SITE_URL||process.env.NEXT_PUBLIC_SITE_URL||'https://folloopy.com'),title:'Folloopy · E-posta takibi',description:'Folloopy ile e-postalarınızın açılma ve içerik etkileşimlerini takip edin',applicationName:'Folloopy',icons:{icon:[{url:'/favicon.ico?v=folloopy-eyes-2',type:'image/x-icon',sizes:'any'},{url:'/icon.png?v=folloopy-eyes-2',type:'image/png',sizes:'256x256'}],shortcut:'/favicon.ico?v=folloopy-eyes-2',apple:[{url:'/apple-icon.png?v=folloopy-eyes-2',sizes:'180x180',type:'image/png'}]}};
export default function Layout({children}:{children:ReactNode}){return <html lang="tr"><head><script type="module" async dangerouslySetInnerHTML={{__html:assetRecoveryScript}}/><link rel="preload" as="image" href={brandLogo} imageSrcSet={brandLogoSources} imageSizes={brandLogoSizes} fetchPriority="high"/><link rel="preload" as="font" href="/fonts/satoshi-regular.woff2" type="font/woff2" crossOrigin="anonymous"/><link rel="preload" as="font" href="/fonts/gabarito-medium.woff2" type="font/woff2" crossOrigin="anonymous"/></head><body>{children}</body></html>}
