'use client';
import {useEffect,useState} from 'react';
import './live-clock.css';
const formatter=new Intl.DateTimeFormat('tr-TR',{timeZone:'Europe/Istanbul',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
export function LiveClock({initialAt}:{initialAt:string}){
 const [time,setTime]=useState(()=>formatter.format(new Date(initialAt)));
 useEffect(()=>{
  let timer:ReturnType<typeof setTimeout>|undefined;
  const update=()=>{
   clearTimeout(timer);
   if(document.hidden)return;
   setTime(formatter.format(new Date()));
   // The display has minute precision; wake at its next visible change only.
   timer=setTimeout(update,60000-Date.now()%60000);
  };
  update();document.addEventListener('visibilitychange',update);
  return ()=>{clearTimeout(timer);document.removeEventListener('visibilitychange',update)};
 },[]);
 return <time className="turkey-live-clock" dateTime={time} aria-label={'Türkiye saatine göre güncel saat: '+time}>{time}</time>;
}
