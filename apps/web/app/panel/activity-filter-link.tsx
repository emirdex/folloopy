'use client';
import Link,{useLinkStatus} from 'next/link';
import type {ReactNode} from 'react';

function PendingAccent(){
 const {pending}=useLinkStatus();
 return pending?<span className="stream-filter-pending" aria-hidden="true"/>:null;
}

export function ActivityFilterLink({filter,selected,children}:{filter:string;selected:boolean;children:ReactNode}){
 return <Link href={'/panel?view=activity&filter='+filter} scroll={false} aria-current={selected?'page':undefined} data-filter={filter} className={selected?'is-selected':''}>{children}<PendingAccent/></Link>;
}
