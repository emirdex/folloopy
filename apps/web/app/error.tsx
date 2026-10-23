'use client';
import {useEffect} from 'react';
export default function ErrorPage({error,reset}:{error:Error;reset:()=>void}){
 const assetFailure=error.name==='ChunkLoadError'||/Loading chunk \S+ failed/.test(error.message);
 useEffect(()=>{if(assetFailure)window.dispatchEvent(new Event('folloopy:asset-failure'))},[assetFailure]);
 return <div role="alert" className="recovery-error"><h1>İşlem tamamlanamadı</h1><p>Bağlantıyı ve kullanım limitinizi kontrol edin. Gönderimi belirsiz kayıtlar otomatik tekrar gönderilmez.</p><button onClick={()=>assetFailure?window.location.replace(window.location.href.split('#')[0]):reset()}>Görünümü yeniden yükle</button></div>;
}
