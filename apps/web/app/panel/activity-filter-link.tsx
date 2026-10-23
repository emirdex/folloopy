'use client';
import Link from '../destination-link';
import type {ReactNode} from 'react';

export function ActivityFilterLink({filter,selected,children,href}:{filter:string;selected:boolean;children:ReactNode;href?:string}){
 return <Link href={href||'/panel?view=activity&filter='+filter} scroll={false} aria-current={selected?'page':undefined} data-filter={filter} className={selected?'is-selected':''}>{children}</Link>;
}
