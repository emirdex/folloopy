'use client';
import Link from '../destination-link';
import type {ReactNode} from 'react';

export function ActivityFilterLink({filter,selected,children}:{filter:string;selected:boolean;children:ReactNode}){
 return <Link href={'/panel?view=activity&filter='+filter} aria-current={selected?'page':undefined} data-filter={filter} className={selected?'is-selected':''}>{children}</Link>;
}
