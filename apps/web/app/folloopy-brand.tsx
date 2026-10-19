import type {CSSProperties} from 'react';
/** Original supplied logo, framed without modifying its pixels or proportions. */
export function FolloopyLogo({compact=false}:{compact?:boolean}){return <picture className={'folloopy-logo'+(compact?' folloopy-logo-compact':'')}><img src="/brands/folloopy/logo.png" width={1983} height={793} alt="Folloopy" draggable={false}/></picture>}
export function FolloopyMark({size=32}:{size?:number}){return <picture className="folloopy-mark" style={{'--folloopy-mark-size':`${size}px`} as CSSProperties}><img src="/brands/folloopy/logo.png" width={1983} height={793} alt="Folloopy" draggable={false}/></picture>}
