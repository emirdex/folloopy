export type ConnectionState='checking'|'online'|'offline'|'unavailable'|'timeout'|'disconnected'|'session';
export const connectionLabels:Record<ConnectionState,string>={checking:'Bağlantı Bekleniyor',online:'Çevrimiçi',offline:'Çevrimdışı',unavailable:'Servise Ulaşılamıyor',timeout:'Bağlantı Zaman Aşımı',disconnected:'Bağlantı Kesildi',session:'Oturum Gerekli'};
export async function probeService(signal:AbortSignal,request:typeof fetch=fetch):Promise<ConnectionState>{
 try{
  const response=await request('/health',{cache:'no-store',signal,headers:{Accept:'application/json'}});
  if(response.status===401||response.status===403)return 'session';
  if(!response.ok)return 'unavailable';
  const body=await response.json();
  return body?.status==='ok'&&body?.mode!=='marketing'?'online':'unavailable';
 }catch{return signal.aborted&&signal.reason==='timeout'?'timeout':'disconnected'}
}
