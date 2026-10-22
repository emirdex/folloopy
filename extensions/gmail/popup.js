const ui=Object.fromEntries(['popup','heading','description','connection-text','account','avatar','sender','notice','pair','check','retry','panel','disconnect','refresh','usage','requirement'].map(id=>[id,document.getElementById(id)]));
const messages={FORBIDDEN:'Üyelik veya hesap bilgileri değişmiş. Panelden bağlantınızı kontrol edin.',UNAUTHORIZED:'Bağlantınızın yenilenmesi gerekiyor.',PAIR_EXPIRED:'Onay süresi doldu. Hesabınızı yeniden bağlayın.',GMAIL_REFRESH_REQUIRED:'Panelden Gmail bağlantınızı yenileyin.',TOO_MANY_ATTEMPTS:'Çok fazla deneme yapıldı. Biraz bekleyip yeniden deneyin.'};
let state='loading',sender='',busy=false;
function render(next,notice=''){
  state=next;ui.popup.dataset.state=state;
  const copy={loading:['Kontrol ediliyor','Bağlantınız kontrol ediliyor','Hesap bilgileriniz doğrulanıyor.'],connected:['Bağlı','Gönderime hazırsınız','Gmail üzerinden gönderin, sonuçları panelinizden takip edin.'],unpaired:['Bağlı değil','Gmail’i Folloopy’ye bağlayın','Hesabınızı bir kez bağlayın, gönderilerinizi Gmail’den takip edin.'],pending:['Onay bekliyor','Son bir adım kaldı','Açılan Folloopy panelinde bağlantıyı onaylayın. Ardından buradan kontrol edin.'],error:['Kontrol gerekli','Bağlantı kontrol edilemedi','Bir sorun oluştu. Bağlantınızı yeniden kontrol edebilirsiniz.']}[state];
  ui['connection-text'].textContent=copy[0];ui.heading.textContent=copy[1];ui.description.textContent=copy[2];
  ui.sender.textContent=sender;ui.avatar.textContent=sender.charAt(0).toLocaleUpperCase('tr')||'F';
  for(const id of ['account','panel','disconnect','usage'])ui[id].hidden=state!=='connected';
  ui.pair.hidden=state!=='unpaired';ui.check.hidden=state!=='pending';ui.retry.hidden=state!=='error';ui.requirement.hidden=state!=='unpaired';
  ui.notice.textContent=notice;ui.notice.hidden=!notice;
}
function setBusy(value){busy=value;ui.popup.setAttribute('aria-busy',String(value));for(const id of ['pair','check','retry','disconnect','refresh'])ui[id].disabled=value;}
async function run(operation){
  if(busy)return;setBusy(true);ui.notice.hidden=true;
  try{
    const response=await chrome.runtime.sendMessage({operation});
    if(!response?.ok){const error=new Error(messages[response?.error]||'Servise ulaşılamadı. İnternet bağlantınızı kontrol edin.');error.code=response?.error;throw error;}
    const result=response.result;
    if(operation==='disconnect'){sender='';render('unpaired');}
    else if(result?.pending)render('pending');
    else if(result?.sender){sender=result.sender;render('connected');}
    else render('error','Bağlantı bilgileri alınamadı. Yeniden deneyin.');
  }catch(error){
    if(operation==='disconnect'){sender='';render('unpaired','Bu tarayıcıdaki bağlantı kaldırıldı. Sunucu erişimini panelden kontrol edebilirsiniz.');}
    else if(error.code==='NOT_PAIRED'){
      sender='';let pending=false;
      try{const {pair}=await chrome.storage.local.get('pair');pending=!!pair&&pair.expires>Date.now();}catch{}
      render(pending?'pending':'unpaired');
    }else if(error.code==='PAIR_PENDING')render('pending');
    else if(['PAIR_EXPIRED','UNAUTHORIZED','FORBIDDEN'].includes(error.code)){sender='';render('unpaired',error.message);}
    else render('error',error.code?error.message:'Servise ulaşılamadı. İnternet bağlantınızı kontrol edin.');
  }finally{setBusy(false);}
}
ui.pair.onclick=()=>run('pair');ui.check.onclick=()=>run('exchange');ui.disconnect.onclick=()=>run('disconnect');ui.retry.onclick=()=>run('status');ui.refresh.onclick=()=>run('status');
run('status');
