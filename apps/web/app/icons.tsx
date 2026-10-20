import type {CSSProperties} from 'react';
import {BookOpen,Eye,Mail,Activity,ArrowRight,Search,Plus,ChevronRight,Check,Clock3,Link2,Reply,ShieldCheck,Settings2,X,RefreshCw,Pause,ArrowUpRight,SlidersHorizontal,Send,LayoutDashboard,ChartNoAxesCombined,Info,Sparkles,UserRound} from 'lucide-react';
const icons={book:BookOpen,eye:Eye,mail:Mail,pulse:Activity,arrow:ArrowRight,search:Search,plus:Plus,chevron:ChevronRight,check:Check,clock:Clock3,link:Link2,reply:Reply,shield:ShieldCheck,settings:Settings2,close:X,refresh:RefreshCw,pause:Pause,external:ArrowUpRight,sliders:SlidersHorizontal,send:Send,overview:LayoutDashboard,chart:ChartNoAxesCombined,info:Info,sparkles:Sparkles,user:UserRound};
export type IconName=keyof typeof icons;
export function Icon({name,size=20,style}:{name:IconName;size?:number;style?:CSSProperties}){const Component=icons[name];return <Component size={size} strokeWidth={1.8} aria-hidden="true" style={style}/>}
