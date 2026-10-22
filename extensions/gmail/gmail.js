(()=>{
 const text=(node,message)=>{node.textContent=message};
 function currentSender(){
  // Gmail also renders the account switcher as a button (including Workspace).
  // Read only account controls, never message text or the selected recipient.
  const selectors=['[aria-label*="Google Hesabı:"][aria-label*="@"]','[aria-label*="Google Account:"][aria-label*="@"]','a[href*="accounts.google.com/SignOutOptions"]','[role="banner"] [aria-label*="Google"][aria-label*="@"]'];
  for(const selector of selectors){
   const account=document.querySelector(selector);
   const label=(account?.getAttribute('aria-label')||'')+' '+(account?.getAttribute('data-email')||'');
   const email=label.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)?.[0]?.toLowerCase();
   if(email)return email;
  }
 }
 function attach(body){
  const compose=body.closest('[role="dialog"]');if(!compose||compose.querySelector('.folloopy-compose'))return;
  const toolbar=compose.querySelector('[role="button"][data-tooltip*="Send"], [role="button"][data-tooltip*="Gönder"], [role="button"][aria-label^="Send"], [role="button"][aria-label^="Gönder"]');if(!toolbar)return;
  const wrap=document.createElement('div');wrap.className='folloopy-compose';
  const button=document.createElement('button');button.type='button';button.textContent='Folloopy ile gönder ↗';
  const note=document.createElement('span');note.setAttribute('role','status');note.setAttribute('aria-live','polite');note.className='folloopy-compose-status';
  button.title='Bu mesajı Folloopy takibiyle gönderin. Bağlı hesap ve paket gönderim sırasında doğrulanır.';
  wrap.append(button,note);
  // Keep our control outside Gmail's native split Send button.
  const mount=toolbar.closest?.('td')||toolbar.parentElement.parentElement||toolbar.parentElement;
  mount.append(wrap);
  let key=crypto.randomUUID(),fingerprint='',locked=false;
  button.onclick=async()=>{
   if(locked)return;button.disabled=true;
   try{
    const subject=compose.querySelector('input[name="subjectbox"]')?.value?.trim(),message=body.innerText?.trim();
    const chips=[...compose.querySelectorAll('[email]')].map(n=>n.getAttribute('email')).filter(Boolean);
    const typed=[...compose.querySelectorAll('input[name="to"],input[peoplekit-id]')].map(n=>n.value.trim()).filter(Boolean);
    const recipients=[...new Set([...chips,...typed])];
    const unsupported=compose.querySelector('[name="cc"][value]:not([value=""]),[name="bcc"][value]:not([value=""]),.aQH .aZo,.aQH .aV3,.dL,[data-attachment-id],.gmail_quote');
    const attachmentArea=compose.querySelector('.aQH');
    if(unsupported||attachmentArea?.childElementCount||body.querySelector('img,table')||compose.querySelector('input[name="subjectbox"]')===null)throw Error('Bu mesajda ek, görsel, CC/BCC veya yanıt zinciri olabilir. İlk sürüm tek alıcılı yeni düz metin mesajları destekler.');
    if(recipients.length!==1||!subject||!message)throw Error('Bir alıcı, konu ve mesaj girin. Gönderim için Gmail’in yeni mesaj penceresini kullanın.');
    const from=currentSender();if(!from)throw Error('Gmail hesabı doğrulanamadı. Google hesap simgenizin görünür olduğunu kontrol edin.');
    const payload={from,to:recipients[0],subject,text:message,tracking:true};const next=JSON.stringify(payload);if(fingerprint&&fingerprint!==next)key=crypto.randomUUID();fingerprint=next;
    if(!confirm(from+' hesabından '+payload.to+' adresine Folloopy takibiyle DÜZ METİN olarak gönderilecek. Biçimlendirme korunmaz. Onaylıyor musunuz?'))return;
    text(note,'Gönderiliyor… Tekrar tıklamayın.');locked=true;
    const r=await chrome.runtime.sendMessage({operation:'send',payload:{...payload,idempotencyKey:key}});
    if(!r.ok){locked=false;throw Error(r.error==='FORBIDDEN'?'Signature üyeliğinizi, bağlı Gmail hesabınızı ve eklenti eşleştirmesini kontrol edin.':r.error==='LIMIT_REACHED'?'Gönderim limitinize ulaştınız.':'Gönderim yapılamadı: '+r.error)}
    const result=r.result;note.replaceChildren();const a=document.createElement('a');a.href='https://panel.folloopy.com/panel?id='+encodeURIComponent(result.id);a.target='_blank';a.rel='noreferrer';a.textContent=result.state==='sent'?'Gönderildi · Takibi aç ↗':'Sonuç belirsiz · Panelden kontrol et ↗';note.append(a);button.textContent=result.state==='sent'?'Gönderildi ✓':'Tekrar göndermeyin';
    // Keep the draft visible; never click Gmail’s native Send or delete user content.
    if(result.state==='sent')note.append(document.createTextNode(' · Bu Gmail taslağını tekrar göndermeyin; kapatabilirsiniz.'));
   }catch(e){text(note,e.message||'Bağlantı kesildi. Yeniden göndermeden önce Folloopy panelini kontrol edin.');if(locked){button.textContent='Panelden kontrol edin';note.append(document.createTextNode(' Tekrar göndermeyin.'))}}finally{button.disabled=locked}
  };
 }
 let timer;const scan=()=>document.querySelectorAll('[contenteditable="true"][role="textbox"]').forEach(attach);new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(scan,300)}).observe(document.body,{childList:true,subtree:true});scan();
})();
