# Folloopy Outlook entegrasyonu — başlangıç durumu

Henüz kurulabilir, doğrulanmış Outlook eklentisi yoktur. Manifest yalnızca eski hazırlık şablonudur; kuruluma veya mağazaya gönderilmemelidir. Panelin mevcut tasarımı ve Gmail akışı değişmez. Gerçek alıcılara test e-postası gönderilmesi henüz yetkilendirilmemiştir.

## Kullanıcının hazırlaması gerekenler

1. Microsoft Entra uygulama kaydı oluşturabilen bir hesap/dizin. Microsoft 365 iş hesabı varsa önce mevcut erişim kontrol edilmeli; sırf bu hazırlık için ücretli ürün satın alınması gerekmez.
2. Outlook eklenti denemesi için Exchange Online posta kutusu olan bir Microsoft 365 test hesabı. Kişisel Outlook.com desteği ayrıca kendi uyumluluk testinden geçmelidir.
3. Microsoft Entra > App registrations > New registration: **Folloopy**. Hedef: **Accounts in any organizational directory and personal Microsoft accounts** (`AzureADandPersonalMicrosoftAccount`).
4. İleride uygulanacak sunucu OAuth dönüş adresi: `https://panel.folloopy.com/api/oauth/microsoft/callback`. Platform **Web** olacak. Bu adres henüz çalışan bir callback değildir; kullanıcı bağlantısı açılmadan önce geliştirilecek.
5. İlk kapsam için delegated izinler: `User.Read`, `Mail.Send`; OIDC için `openid`, `profile`, yenileme için `offline_access`. `Mail.Read`, `Mail.ReadWrite` veya application düzeyinde tüm posta kutularına erişim istenmez. İlave özellik bunu gerçekten gerektirirse ayrı değerlendirilir.
6. Client ID, client secret ve son kullanma tarihi sunucu ortamına girilir. Secret sohbetten, tarayıcı kodundan, manifestten, Git'ten veya ekran görüntüsünden paylaşılmaz. Secret yenileme sorumlusu ve süresi takip edilir.

Microsoft hesabı/parolası ve organizasyon izin onaylarını hesap sahibi tamamlar. Uygulama kaydı veya mağaza kabulü kendiliğinden oluşmaz. Microsoft 365 yöneticisi tenant politikasına göre onay isteyebilir.

## Hazırlanan teknik parçalar

- Graph MIME gönderim adaptörü: sabit Microsoft endpoint'i; 15 saniye sınırı; yönlendirme takibi yok; açık ret ile sonucu belirsiz gönderim ayrı; otomatik yeniden gönderim yok.
- `202 Accepted` yalnızca kabul olarak döner. Teslimat/açılma veya gerçek provider mesaj kimliği uydurulmaz.
- Sır içermeyen yapılandırma kontrolü: `node --import tsx scripts/outlook-preflight.ts`. Eksik ayarlar varsa çıkış kodu 1. Ayarlar tam olsa dahi `available:false`; özellik kendiliğinden açılmaz.
- İzole testler: `node --import tsx --test tests/outlook.test.ts tests/subscription-policy.test.ts`. Microsoft'a istek veya e-posta gitmez.

## Sonraki geliştirme sırası

1. Resmî MSAL Node ile authorization code + PKCE akışı. Tek kullanımlık, süreli state; doğrulanmış Folloopy oturumuna bağlama; dönüş adresi sabit; hata ekranı güvenli. Microsoft bağlantısı Folloopy girişinin yerine geçmez.
2. Provider'a göre ayrılmış hesap/tablo ve şifreli token cache. Yenileme kilidi, iptal, bağlantı kaldırma ve tüm oturum güvenlik olayları. Mevcut Gmail bağlantısı üzerine yazılmaz.
3. Graph gönderim yaşam döngüsünü mevcut idempotency, kota ve paket denetimlerine bağlama. Mevcut `MailProvider` gerçek mesaj/thread kimliği beklediğinden adaptör bugün doğrudan ona takılamaz; Graph'ın 202 davranışı için kabul/teslimat modeli açıkça geliştirilmeli. Rastgele kimlik üretip gönderildi sayılmamalı.
4. Outlook görev bölmesi: eşleştirme, paket/limit durumu, aktif mailin takip geçmişi, kullanıcı tarafından başlatılan takip işlemi. Office.js capability kontrolü; desteklenmeyen istemciye açık durum.
5. Outlook içinden gönderim ayrı yoldur: gövdeye takip bileşeni ekleme, gönderim öncesi olay, gönderim sonucu uzlaştırma. Aynı e-posta Graph ile ikinci kez gönderilmez. CC/BCC kişisi veya dosya indirme/açılma bilgisi ölçülemiyorsa kesin ölçüm gösterilmez.
6. Web/yeni Windows/klasik Windows/Mac uyumluluk matrisi; gerçek hesapla izinli test; Free günlük 3, Essential ve Signature sunucu kontrolleri; iki oturumlu kota/yenileme testleri. Mobil Smart Alerts desteklenmediğinden bu kapsam için aktif vaat yok.
7. Pilot sideload ve kuruluş dağıtımı; Microsoft Marketplace yayını ayrı kabul sürecidir. Hesap bağlantısı doğrulanmadan, eklenti tüm hedef istemcilerde test edilmeden ve geri alma planı olmadan aktif kurulum düğmesi yok.

## Resmî kaynaklar

- [Uygulama kaydı ve hesap türleri](https://learn.microsoft.com/en-us/graph/auth-register-app-v2)
- [OAuth authorization code, PKCE ve MSAL önerisi](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow)
- [Graph MIME sendMail ve 202 kabul yanıtı](https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0)
- [Smart Alerts, istemci desteği ve mağaza sınırları](https://learn.microsoft.com/en-us/office/dev/add-ins/outlook/onmessagesend-onappointmentsend-events)
