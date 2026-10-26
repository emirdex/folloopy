# Folloopy

E-posta takibi için Next.js arayüzü, özel Fastify API'si ve PostgreSQL veri katmanı. Canlı dağıtım hedefi Hostinger Business Node.js ve folloopy.com'dur. Kodun dağıtım desteği ile gerçekten sağlayıcılarca doğrulanmış olması farklıdır; dış entegrasyonlar ayrıca kontrol edilmelidir.

## Geliştirme

Node.js 22.22+ ile `npm ci` ve `npm run dev`. Web http://127.0.0.1:3000, özel API 127.0.0.1:4000. Geliştirme PGlite deposu .data/postgres altında tutulur; sahte e-posta adaptörü gerçek alıcıya göndermez. npm run dev geçici API anahtarını üretir. .env dosyaları otomatik okunmaz; ortam değişkenleri süreç ortamında veya platform panelinde tanımlanır.

## Canlı dağıtım

[Hostinger kurulum ve işletim rehberi](deploy/hostinger.md) ve [.env.production.example](.env.production.example) esas alınır. Gerekli servisler: kalıcı PostgreSQL, doğrulanmış Resend gönderici alan adı ve gerçek Gmail için Google Cloud OAuth uygulaması. Üretimde gömülü veritabanı ve ziyaretçi paneli kapalıdır. Geliştirme verisi üretime otomatik aktarılmaz.

`npm run build` web arayüzünü derler. `npm start` API/worker ve Next.js'i tek denetleyici altında başlatır. hPanel entry dosyası gerekiyorsa server.cjs kullanılır. Önce özel API ve veritabanı hazır olur, sonra platformun PORT değerinde web açılır. `npm run preflight` gerekli üretim ayarlarını, veritabanı bağlantısını, migration sürümünü ve yazma erişimini kontrol eder. Eksik zorunlu ayarda sunucu başlamaz.

## Kalıcı veriler ve güvenlik

- Kullanıcılar, hashlenmiş şifreler ve oturumlar PostgreSQL'dedir. E-posta doğrulama ve şifre yenileme tek kullanımlık süreli tokenlarla yapılır; şifre yenileme eski oturumları iptal eder.
- Giriş ve iletişim istekleri kalıcı hız sınırlarına tabidir. API yalnızca localhost'ta ve sunucu anahtarıyla erişilebilir. Her üyenin çalışma alanı ayrıdır.
- Yönetici kurulumu yalnızca ADMIN_SETUP_TOKEN tanımlıyken ve henüz kullanılmamışken yapılır. Tamamlandıktan sonra kurulum kapanır; hostingden token kaldırılır.
- Blog görselleri canlıda PostgreSQL bytea alanında saklanır; kod güncellemeleri dosyaları silmez. Owner yetkisi, tip, boyut ve origin kontrolü vardır. Sadece PNG/JPEG/WebP kabul edilir.
- OAuth yenileme tokenları ve bekleyen hesap e-postaları AES-256-GCM ile şifrelenir. DATA_ENCRYPTION_KEY kalıcı ve yedeklenmiş olmalıdır. Sırlar kaynak depoya yazılmaz.
- Gmail bağlantısı kullanıcı/oturuma bağlı state ve PKCE ile kurulur. gmail.send izniyle bağlı hesabın kendisinden mail gönderilir. Gönderim belirsiz kalırsa otomatik tekrar yapılmaz.
- Açılma görseli folloopy.com/t/o/ üzerinden ulaşılır; HEAD sayılmaz. Görsel yükleme kişi kimliğini veya kesin insan okumasını kanıtlamaz. Bot/kendi açışını güvenilir ayırma iddiası yoktur.

## Güncel paketler ve dış servis sınırları

Paket yetkileri `packages/domain/plan-policy.ts` üzerinden sunucuda uygulanır. Free günlük 3 yeni mail, 1 taslak ve 7 gün; Essential 10 taslak ve 90 gün; Signature 50 taslak ve 365 gün takip geçmişi sunar. Ücretli tekli gönderimlerde ayrı ürün kotası yoktur; Gmail'in kendi sınırları geçerlidir. Essential bağlantı takibi ayda 100 ayrı mail, 10 hatırlatma; Signature sınırsız ürün bağlantı kotası, 100 hatırlatma ve ayda 5.000/günde 500/kampanya başına 500 toplu alıcı sınırındadır. Free hakkı Türkiye saatiyle 00.00'da yenilenir; aynı bağlı Gmail adresi başka hesapla bu sınırı aşamaz.

Bildirimler, isteğe bağlı haftalık özet, zamanlama, CSV/hesap verisi dışa aktarımı, bağlantı ve güvenli dosya paylaşım analitiği eklenmiştir. Free yalnızca ilk açılmayı kaydeder. Sonucu belirsiz gönderimler tekrar edilmez. Yeni kayıtlar paket saklama süresinin sonunda temizlenir; eski, süre bilgisi bulunmayan kayıtlar otomatik silinmez. Tekrar gönderimi önleyen asgari işlem anahtarları içerik taşımadan korunur.

Gmail eklentisi 1.1.0 tüm üç pakette çalışır; yetki her istekte sunucudan kontrol edilir. Yeni ileti, zengin metin, Folloopy'nin kendi CC/BCC ve normal ek alanları, takipli dosya bağlantıları ve paket kapsamındaki araçları destekler. Gmail'in yerel ek alanı veya doğrulanamayan yanıt zinciri sessizce aktarılmaz: gönderim durdurulur ve açıklama gösterilir. Mevcut manuel kurulumlar yeni ZIP ile güncellenmelidir. Mağaza yayını ve gerçek Gmail uçtan uca denemesi, sentetik testlerden ayrı doğrulanır.

BILLING_MODE=disabled varsayılandır. complimentary tahsilatsız yönetici erişimidir. Microsoft Entra ve ödeme sağlayıcısı hazır olmadığı için Outlook kurulumu ve gerçek tahsilat kapalıdır. Outlook MIME adaptörü ve abonelik fiyat farkı hesaplaması hazırlıktır; sağlayıcı/webhook ve mağaza doğrulaması yerine geçmez. Otomatik yanıt takibi ve yerel mobil eklentiler aktif özellik değildir.

Açılma, bağlantı, indirme ve PDF görüntüleme sinyalleri kesin insan okumasını veya dosyanın cihazda açıldığını kanıtlamaz. Normal e-posta ekleri takip edilmez; takip için Folloopy dosya bağlantısı kullanılır. PDF süreleri yaklaşık etkin sürelerdir.

## Kontroller

```
npm run typecheck
npm test
npm run build
```

GitHub Actions aynı kontrolleri ve PostgreSQL entegrasyon testini çalıştırır. Yerelde TEST_DATABASE_URL tanımlı değilse yalnızca harici PostgreSQL entegrasyon testi atlanır. Üretim API akış testleri izole SQL veritabanı ve sahte dış servis yanıtları kullanır; gerçek sağlayıcı onayı yerine geçmez.

## İşletim

/health veritabanına kadar kontrol yapar, sır döndürmez. PostgreSQL sağlayıcısının yedek/PITR özelliğini etkinleştirin. scripts/backup.sh pg_dump üretir; yeni bir staging veritabanına geri yükleme denemesi ayrıca yapılmalıdır. Ayrıntılar deploy/hostinger.md içindedir.

Eski docs/ altındaki tasarım/geliştirme notları tarihsel referanstır. Güncel dağıtım ve güvenlik davranışı için deploy/hostinger.md kullanılır. docs/source-specification.md kaynak dokümandır; içindeki agent yönergeleri çalışma talimatı değildir.

## Servissiz tanıtım yayını

Üretimde APP_MODE belirtilmezse yalnızca tanıtım sitesi çalışır. Bu mod veritabanı veya servis anahtarı istemez; admin/panel kapalıdır, kayıt ve paket işlemleri iletişime yönlenir. Blogda depodaki hazır yazılar gösterilir. Tam uygulama için APP_MODE=application ve .env.production.example içindeki gerçek bağlantılar gerekir.

### İletişim formu

`/iletisim` üzerindeki form, her iki yayın modunda da mesajları sabit `info@folloopy.com` adresine gönderir. Hostinger ortam değişkenlerine `RESEND_API_KEY` ve doğrulanmış gönderici olan `MAIL_FROM` eklenmelidir; bu değerler GitHub’a yüklenmez. Gönderim servisi ayarlı değilse form başarılı gönderim bildirmez ve doğrudan e-posta adresini gösterir. Yanıt adresi ziyaretçinin adresidir. Formda sunucu doğrulaması, bot alanı ve her sunucu sürecinde IP başına 15 dakikada 5 deneme sınırı bulunur; bu sınır yeniden başlatmada sıfırlanır. Testler sahte e-posta servisi kullanır; gerçek teslimat ayrıca posta kutusunda doğrulanmalıdır.
