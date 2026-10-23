import type {CSSProperties} from 'react';
import {brandLogo,brandLogoSources,brandLogoSizes} from './brand-assets';
/** Responsive copies of the supplied artwork retain its framing and proportions. */
export function FolloopyLogo({compact=false,lazy=false}:{compact?:boolean;lazy?:boolean}){return <picture className={'folloopy-logo'+(compact?' folloopy-logo-compact':'')}><img src={brandLogo} srcSet={brandLogoSources} sizes={brandLogoSizes} width={1983} height={793} alt="Folloopy" loading={lazy?'lazy':'eager'} decoding="async" draggable={false}/></picture>}
export function FolloopyMark({size=32}:{size?:number}){return <picture className="folloopy-mark" style={{'--folloopy-mark-size':`${size}px`} as CSSProperties}><img src={brandLogo} srcSet={brandLogoSources} sizes={`${Math.ceil(size*2.72)}px`} width={1983} height={793} alt="Folloopy" decoding="async" draggable={false}/></picture>}
