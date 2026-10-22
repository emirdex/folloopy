import NextLink from 'next/link';
import {NavigationHint} from './navigation-hint';
import type {ComponentProps} from 'react';
import {destinationHref} from '../../../packages/runtime/site-origins';
export default function Link(props:ComponentProps<typeof NextLink>){
 const href=typeof props.href==='string'?destinationHref(props.href,{NEXT_PUBLIC_SITE_URL:process.env.NEXT_PUBLIC_SITE_URL,NEXT_PUBLIC_APP_URL:process.env.NEXT_PUBLIC_APP_URL}):props.href;
 return <NextLink {...props} href={href}>{props.children}<NavigationHint/></NextLink>;
}
