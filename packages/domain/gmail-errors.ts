// Only fixed public reasons may cross the OAuth redirect. Never expose provider responses or tokens.
export const gmailConnectionErrors:Record<string,string>={
 INVALID_OAUTH_STATE:'Bağlantı isteğinin süresi doldu veya oturum değişti. Gmail Hesabını Bağla düğmesiyle yeniden başlayın.',
 GMAIL_PERMISSION_DENIED:'Google bağlantı izni onaylanmadı. Yeniden bağlanıp e-posta gönderme iznini onaylayın.',
 GMAIL_SCOPE_REQUIRED:'E-posta gönderme izni verilmedi. Yeniden bağlanırken Google ekranındaki e-posta gönderme iznini işaretleyin.',
 GMAIL_REFRESH_REQUIRED:'Google kalıcı bağlantı izni vermedi. Yeniden bağlanıp izin ekranını tamamlayın.',
 GMAIL_CLIENT_INVALID:'Google uygulamasının bağlantı bilgileri doğrulanamadı. Destek: info@folloopy.com',
 GMAIL_CODE_INVALID:'Google bağlantı kodu geçersiz veya süresi dolmuş. Gmail Hesabını Bağla düğmesiyle yeniden başlayın.',
 GMAIL_AUTH_FAILED:'Google bağlantı doğrulaması tamamlanamadı. Yeniden deneyin.',
 GMAIL_IDENTITY_FAILED:'Google hesabının e-posta bilgisi doğrulanamadı. Yeniden deneyin.',
 GMAIL_UNAVAILABLE:'Gmail bağlantı ayarları şu anda kullanılamıyor. Destek: info@folloopy.com',
 GMAIL_CONNECTION_TIMEOUT:'Google bağlantısı zamanında tamamlanamadı. Yeniden deneyin.',
};
export function gmailConnectionReason(error:unknown){
 const code=error instanceof Error?error.message:'';
 if(code==='TimeoutError'||(error instanceof Error&&error.name==='TimeoutError'))return 'GMAIL_CONNECTION_TIMEOUT';
 return Object.hasOwn(gmailConnectionErrors,code)?code:'GMAIL_CONNECTION_FAILED';
}
