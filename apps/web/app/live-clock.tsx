'use client';
import {useEffect,useState} from 'react';
import './live-clock.css';
const formatter=new Intl.DateTimeFormat('tr-TR',{timeZone:'Europe/Istanbul',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
export function LiveClock({initialAt}:{initialAt:string}){
 const [time,setTime]=useState(()=>formatter.format(new Date(initialAt)));
 useEffect(()=>{
  const update=()=>setTime(formatter.format(new Date()));
  update();const timer=window.setInterval(update,1000);
  document.addEventListener('visibilitychange',update);
  return ()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',update)};
 },[]);
 return <time className="turkey-live-clock" dateTime={time} aria-label={'Türkiye saatine göre güncel saat: '+time}>{time}</time>;
}
