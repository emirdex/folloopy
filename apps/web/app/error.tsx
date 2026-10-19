'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <div role="alert" style={{padding:40}}><h1>İşlem tamamlanamadı</h1><p>Bağlantıyı ve kullanım limitinizi kontrol edin. Gönderimi belirsiz kayıtlar otomatik tekrar gönderilmez.</p><button onClick={reset}>Görünümü yeniden yükle</button></div>}
