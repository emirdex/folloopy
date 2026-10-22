import type {LucideIcon} from 'lucide-react';
import {FileText,BookOpen,Send,Activity,Search,Pause,UserCheck,Link2,Layers,Puzzle,ShieldCheck,LifeBuoy} from 'lucide-react';
import {commercialPlans} from '../../../../packages/domain/commercial-plans';
import {BULK_MAX_RECIPIENTS,BULK_CSV_LIMIT} from '../../../../packages/domain/bulk-mail';
import {PASSWORD_HELP} from '../../../../packages/domain/password-policy';
const essential=commercialPlans.find(plan=>plan.id==='individual')!,signature=commercialPlans.find(plan=>plan.id==='team')!;
export {essential,signature};
export const guideCsvExample='email,ad,soyad,sirket,hitap\ndeniz@example.com,Deniz,Yılmaz,Atlas,Hanım\nmert@example.com,Mert,Kaya,Nova,Bey';
export const guideSubjectExample='{{sirket}} için iş birliği önerimiz';
export const guideMessageExample='Merhaba {{ad}} {{hitap}},\n\n{{sirket}} için hazırladığımız öneriyi sizinle paylaşmak isteriz.\n\nİyi çalışmalar.';
type Chapter={id:string;nav:string;title:string;icon:LucideIcon;body:string;steps:string[];href:string;action:string};
export const guideChapters:Chapter[]=[
 {id:'hesap-dogrulama',nav:'Kayıt ve doğrulama',title:'Hesabınızı oluşturun, e-posta adresinizi doğrulayın',icon:UserCheck,body:'Üyelik, giriş ve hesap işlemleri panel.folloopy.com üzerinden yürütülür. Üyelik e-posta adresiniz ile gönderim için bağlayacağınız Gmail adresi farklı olabilir.',steps:[
 'Hesap oluştur ekranındaki ayrı Ad ve Soyad alanlarını, e-posta adresini ve şifreyi doldurun. '+PASSWORD_HELP,
 'Kayıtlı adresinize gönderilen son altı haneli kodu doğrulama ekranına girip Onayla düğmesine basın. Kodun gönderildiği adres ekranda görünür.',
 'Kod gelmezse spam klasörünü kontrol edin. Kodu yeniden göndermek için ekrandaki bekleme süresinin dolmasını bekleyin; yeni istekten sonra son gelen kodu kullanın.',
 'Doğrulama sonrasında paket durumunuza göre panele veya ilk paket seçimine geçersiniz. Doğrulanmamış hesapla gönderim yapılamaz.'
 ],href:'/panel?view=account',action:'Hesap detaylarını aç'},
 {id:'paketler',nav:'Paketler ve kullanım hakları',title:'Paketinizi ve kalan gönderim hakkınızı kontrol edin',icon:Layers,body:`Essential panelden tekli gönderim, açılma takibi ve ${essential.draftLimit} kayıtlı taslak sunar. Signature bunlara ${signature.draftLimit} kayıtlı taslak, CSV ile toplu gönderim ve Gmail Chrome eklentisi erişimi ekler. Kullanılabilir gönderim hakkınız hesabınızda gösterilir.`,steps:[
 'Hesap Detayları bölümünden mevcut paketi, kullanılan hakkı ve işlem geçmişini inceleyin. Paketleri İncele bağlantısıyla güncel seçenekleri açın.',
 'Fiyatlar e-posta hesabı başınadır. Aylık veya yıllık dönemi seçin; yıllık fiyatlar aylık karşılığıyla gösterilir, 12 aylık tutar peşin hesaplanır. Etkinleştirme ekranındaki gerçek işlem koşullarını ayrıca kontrol edin.',
 'Zaten etkin olan paketinizi seçtiğinizde Mevcut paketiniz bilgisi ve Hesap detaylarına dön düğmesi görünür. Hesap → Paket → Tamamla göstergesi yalnızca ilk üyeliğini tamamlayan hesaplarda gösterilir.',
 'Paket değişikliği kullanılmış gönderim hakkını sıfırlamaz. Daha düşük pakette sınırı aşan taslaklar korunur ancak kilitlenebilir. Paket etkinleştirmesi tahsilatla aynı şey değildir; ücretsiz erişim kaydı ödenmiş fatura olarak değerlendirilmez.'
 ],href:'/paketler',action:'Paketleri incele'},
 {id:'gmail-baglantisi',nav:'Gönderen hesabı ve platformlar',title:'Gönderim yapacağınız Gmail hesabını bağlayın',icon:Link2,body:'Şu anda Gmail ve Google Workspace ile gönderim desteklenir. Outlook, Eklentiler sayfasında planlanan platform olarak görünür; henüz Outlook bağlantısı veya indirilebilir Outlook eklentisi sunulmaz.',steps:[
 'Bağlı Hesaplar bölümünde Gmail hesabını bağlama düğmesini kullanın. Google ekranında gönderim yapmak istediğiniz hesabı seçin.',
 'İstenen gönderim iznini inceleyip onaylayın. Folloopy gelen kutunuzdaki diğer e-postaları okumak için izin istemez. Google erişimi kısıtlarsa görünen hata mesajıyla desteğe başvurun.',
 'Panele döndüğünüzde Bağlı durumunu ve görünen Gmail adresini kontrol edin. Üyelik adresinizden farklı olsa da gönderim bu bağlı adres üzerinden yapılır.',
 'Bağlantıyı kaldırdığınızda yeniden gönderim için tekrar bağlamanız gerekir. Hesap değiştirdikten sonra eklenti eşleştirmesini ve varsa toplu gönderim kuyruğunu da kontrol edin.'
 ],href:'/panel?view=setup',action:'Bağlı hesapları aç'},
 {id:'calisma-alani',nav:'Panel ve mobil gezinme',title:'Panelde aradığınız bölüme ulaşın',icon:BookOpen,body:'Üstteki Üyelik alanı mevcut paketi, logo yanındaki E-posta takibi alanı ürün bölümünü gösterir. Arama ile Yeni mail arasında bulunan Çevrimiçi göstergesi Folloopy servis bağlantısına aittir; Gmail bağlantısının açık olduğunu tek başına göstermez.',steps:[
 'Masaüstünde sol menüyü, telefonda üstteki yatay menüyü kullanın. Mobil menüyü sağa veya sola kaydırarak diğer bölümlere ulaşabilirsiniz; açık bölüm görünür alana getirilir.',
 'Genel Bakış gönderim, takip ve açılma özetini sunar. Son Gönderimler alanında en fazla 10 mail görünür; Tümünü Gör bağlantısı mail listesine götürür.',
 'Genel bakış, mail listesi ve konu araması son 50 kaydı kullanır. Etkinlik Akışı son 12 mailin hareketlerini birleştirir; bu özetler hesabın tüm geçmişi olarak yorumlanmamalıdır.',
 'Yeni mail düğmesi tekli mesaj hazırlamayı açar. Üstteki Hesabım menüsünden hesap ayarlarına, fatura bilgilerine, paketlere ve çıkış işlemine ulaşabilirsiniz. Telefonda formlar sayfayla birlikte kayar; geniş tablolar kendi alanlarında yatay kaydırılabilir.'
 ],href:'/panel',action:'Genel bakışı aç'},
 {id:'ilk-mail',nav:'Panelden tekli gönderim',title:'Panelden tek alıcılı mail gönderin',icon:Send,body:'Yeni Mail ekranı, kendi bağlı Gmail hesabınızdan tek alıcıya metin mesajı göndermek içindir. Göndermeden önce hesabın bağlı, paketinizin uygun ve gönderim hakkınızın yeterli olduğundan emin olun.',steps:[
 'Yeni mail düğmesine basın; Kime alanına tek bir e-posta adresi, Konu alanına başlık ve mesaj alanına içeriğinizi yazın.',
 'Açılma takibi anahtarını gönderimden önce belirleyin. Kapalı gönderilen maile takip görseli eklenmez. Konu veya içerikte {{ad}} gibi değişkenler kaldıysa bunları gerçek bilgilerle doldurun; otomatik kişiselleştirme için Toplu Gönderim kullanın.',
 'Gönder düğmesini kullanıp işlem tamamlanana kadar bekleyin. Açılan mail ayrıntısında gönderim durumunu, gönderim kanalını ve takip durumunu inceleyin.',
 'Gönderim onayı, alıcının maili teslim aldığının veya okuduğunun kanıtı değildir. Sonuç belirsizse aynı maili hemen yeniden göndermeden önce mevcut kaydı kontrol edin. Taslak Kaydet seçeneği ise mail göndermez.'
 ],href:'/panel?view=compose',action:'Yeni mail oluştur'},
 {id:'taslaklar',nav:'Taslak oluşturma ve düzenleme',title:'Tekrar kullanacağınız içerikleri taslak olarak saklayın',icon:FileText,body:`Taslaklar bölümündeki Yeni Taslak, gönderim ekranından ayrı bir şablon editörü açar. Essential için ${essential.draftLimit}, Signature için ${signature.draftLimit} kayıtlı taslak hakkı vardır. Taslak kaydetmek gönderim hakkı tüketmez.`,steps:[
 'Taslaklar → Yeni Taslak yolunu izleyin. Taslak adını girin; konu ve mesajı hazırlayın. Konu veya mesajı henüz tamamlamadan da taslağı kaydedebilirsiniz.',
 'Taslağı kaydet düğmesine basın. Kayıt sürerken hareketli ikon görünür; işlem başarılı olduğunda düğme yeşil Kaydedildi onayına dönüşür. Hata mesajı varsa taslak kaydedilmiş sayılmaz.',
 'Kayıtlı taslakta Taslağı aç bağlantısını kullanın. İçeriği değiştirdiğinizde kaydedilmemiş değişiklikler bilgisi görünür; Değişiklikleri kaydet ile güncelleyin. Alıcı önizlemesindeki örnek bilgiler gerçek gönderim oluşturmaz.',
 'Uygun paketiniz varsa Toplu gönderimde kullan bağlantısıyla taslağı aktarın. Değişkensiz içerikleri tekli gönderimde de kullanabilirsiniz. Sınıra ulaşırsanız mevcut taslağı düzenleyin veya yer açın; gönderim yapmak kayıtlı taslağı silmez.'
 ],href:'/panel?view=drafts',action:'Taslakları aç'},
 {id:'degiskenler',nav:'Kişiselleştirme değişkenleri',title:'Konu ve mesajı her alıcıya göre kişiselleştirin',icon:FileText,body:'Değişkenler toplu gönderimde CSV satırındaki bilgilerle doldurulur. Ad, Soyad, Firma, Hitap ve E-posta düğmelerini taslak editöründe ve toplu gönderim ekranında kullanabilirsiniz.',steps:[
 'Önce konuya veya mesaj alanına tıklayın; ardından değişken düğmesine basın. Alan, imlecin bulunduğu yere eklenir. Konuda {{sirket}}, mesajda {{ad}} ve {{hitap}} birlikte kullanılabilir.',
 'CSV başlığındaki email zorunludur. ad, soyad, sirket ve hitap sütunları kişiselleştirme içindir. {{eposta}} değişkeni email sütunundaki adresi kullanır.',
 'Hitap otomatik tahmin edilmez. {{hitap}} kullanıyorsanız her alıcı satırına Bey, Hanım veya tercih ettiğiniz ifadeyi yazın. Kullandığınız diğer alanların da doğru ve dolu olduğunu kontrol edin.',
 'Taslak editöründeki örnek alıcı gerçek CSV listeniz değildir. Göndermeden önce Toplu Gönderim önizlemesindeki kişiselleştirilmiş konu ve mesaj örneklerini ayrıca inceleyin.'
 ],href:'/panel?view=bulk',action:'Kişiselleştirmeyi aç'},
 {id:'toplu-gonderim',nav:'CSV ile toplu gönderim',title:'Alıcı listenize ayrı ayrı mail gönderin',icon:Send,body:`Toplu Gönderim Signature erişimi gerektirir. Bir işlemde en fazla ${BULK_MAX_RECIPIENTS} alıcı ve ${BULK_CSV_LIMIT/1024} KB CSV dosyası kabul edilir. Her alıcı ayrı bir mail alır; alıcılar birbirlerinin adreslerini görmez. Her alıcı için bir gönderim hakkı gerekir.`,steps:[
 'CSV şablonunu indirin ve her satıra bir alıcı ekleyin. Virgül veya noktalı virgülle ayrılmış CSV yükleyebilir ya da CSV metnini yapıştır veya düzenle alanını kullanabilirsiniz. Tekrarlanan adresler tekilleştirilir; hatalı satırları ekrandaki açıklamalara göre düzeltin.',
 'Gönderim adını, konuyu ve mesajı hazırlayın. İsterseniz kayıtlı taslağı aktarın. Açılma takibi tercihini ve kişiselleştirme alanlarını gözden geçirin.',
 'Alıcıları ve İçeriği Kontrol Et düğmesiyle önizlemeyi açın. Gönderen hesabı, alıcı sayısını, kalan hakkı ve kişiselleştirilmiş örnekleri kontrol edin. Onay kutusunu işaretledikten sonra gönderimi başlatın.',
 'İşlem başladığında gerekli haklar ayrılır ve sayfa kapansa da sunucudaki kuyruk devam eder. Gönderimi duraklatabilir, kalan alıcılara devam edebilir veya bekleyenleri iptal edebilirsiniz. İptal, gönderilmiş maili geri almaz; o anda süren bir gönderim tamamlanabilir.',
 'Alıcı sonuçlarını ve mail ayrıntılarını inceleyin; Sonuçları indir ile CSV raporu alın. Sonucu belirsiz alıcıya otomatik tekrar gönderilmez. Gmail bağlantısı, paket veya hesap güvenliği değişirse kuyruk duraklayabilir; ekrandaki neden bilgisini izleyin.'
 ],href:'/panel?view=bulk',action:'Toplu gönderimi aç'},
 {id:'chrome-eklentisi',nav:'Chrome eklentisini kurma',title:'Gmail eklentisini mevcut kurulum yöntemiyle yükleyin',icon:Puzzle,body:'Folloopy’nin Chrome Web Store kaydı henüz yayınlanmış değildir. Yayıncı hesabının açılmış olması, eklentinin mağaza incelemesinden geçtiği anlamına gelmez. Şu anda Eklentiler sayfasındaki manuel kurulum rehberi kullanılabilir; eklenti için Signature erişimi gerekir.',steps:[
 'Eklentiler → Gmail bölümünde Manuel kurulum rehberini açın. Kurulum paketini indirin, ZIP dosyasını kalıcı bir klasöre çıkarın. Klasörü kurulumdan sonra silmeyin veya taşımayın.',
 'Masaüstü Chrome’da chrome://extensions adresini açın. Geliştirici modu anahtarını etkinleştirin; Paketlenmemiş öğe yükle düğmesiyle manifest.json dosyasının bulunduğu klasörü seçin. ZIP dosyasını doğrudan seçmeyin.',
 'Buradaki Geliştirici modu, mağaza dışı manuel kurulumun gereğidir. Mağaza yayını açıldığında mağazadan kurulum için bu adıma gerek kalmaz; Chrome’un gösterdiği Uzantıyı ekle onayını kullanıcı verir.',
 'Güncel paketi yeniden indirdiğinizde kullandığınız klasördeki dosyaları güncelleyin ve chrome://extensions sayfasındaki Folloopy kartından Yeniden yükle düğmesini kullanın. Ardından Gmail sekmesini yenileyin. Chrome eklentisini mobil Chrome’da kullanamazsınız; telefonunuzdan Folloopy paneline erişebilirsiniz.'
 ],href:'/panel?view=extensions',action:'Kurulum rehberini aç'},
 {id:'eklenti-eslestirme',nav:'Eklenti hesabını eşleştirme',title:'Chrome eklentisini hesabınıza bağlayıp gönderin',icon:Link2,body:'Eklentinin kurulması ile Gmail hesabı bağlantısı ve tarayıcı eşleştirmesi ayrı adımlardır. Eklentiyi kullanmak için aktif Signature erişimi, bağlı Gmail hesabı ve geçerli Folloopy oturumu gerekir.',steps:[
 'Chrome araç çubuğundan Folloopy’yi açıp Hesabı bağla düğmesini kullanın. Açılan Folloopy penceresinde görünen Gmail adresini kontrol ederek bağlantıyı onaylayın.',
 'Eklentiye dönüp Onayı kontrol et düğmesine basın. Bağlantı doğrulandığında bağlı adres ve Paneli aç düğmesi görünür. Bağlantıyı yenile ikonu güncel durumu kontrol eder.',
 'Gmail sekmesini yenileyin. Gmail’de açık gönderen hesabı Folloopy’de bağlı adresle aynı olmalıdır. Tek alıcı, konu ve düz metin içeren yeni mesaj hazırlayın; Folloopy ile gönder düğmesini kullanıp gönderen ve alıcıyı onaylayın.',
 'Gmail’in normal Gönder düğmesi Folloopy takibi eklemez. Eklenti ek, görsel, biçimlendirme, CC/BCC ve yanıt zinciri desteklemez. Gönderim sonrası Gmail taslağı açık kalırsa tekrar göndermeyin; sonucu panelden inceleyin.',
 'Tarayıcı erişimini Eklentiler bölümünden veya eklenti penceresindeki Bağlantıyı kaldır ile kaldırabilirsiniz. Aynı anda tek tarayıcı eşleştirmesi kullanılır. Çıkış, paket veya Gmail hesabı değişikliği erişimi etkileyebilir; gerekirse yeniden eşleştirin.'
 ],href:'/panel?view=extensions',action:'Eklenti bağlantısını aç'},
 {id:'etkinlikler',nav:'Gönderim ve açılma kayıtları',title:'Takip durumunu ve açılma zamanlarını yorumlayın',icon:Activity,body:'Gönderim durumu, açılma kaydı ve takip ayarı farklı bilgilerdir. Açılma sinyali, mailin bir insan tarafından kesin okunduğunu kanıtlamaz; görsel engelleme, önbellek, güvenlik taramaları ve gizlilik özellikleri ölçümü etkileyebilir.',steps:[
 'Etkinlik Akışında Tüm Etkinlikler, Gönderimler ve Açılmalar sekmelerini kullanın. Bir mailin konusunu açarak o mailin kendi zaman çizelgesine geçin.',
 'Mail ayrıntısında gönderim kanalını, gönderim bilgisini, ilk/son açılma zamanlarını ve Aktif Takip durumunu inceleyin. Sonraki açılmalar 2. Açılma Algılandı, 3. Açılma Algılandı gibi numaralanır.',
 'Birbirine yakın görsel yüklemeleri aynı açılma grubunda toplanabilir. Açılma kaydı yoksa mailin okunmadığını; birden çok kayıt varsa farklı kişilerin okuduğunu varsaymayın.',
 'Yeşil Takip Açık rozeti yeni açılmaların izlenebildiğini, kırmızı durdurulmuş takip rozeti takibin kapatıldığını gösterir. Bunlar teslim veya okunma onayı değildir. Saatler Türkiye saatine göre gösterilir; Kayıtları yenile ile son durumu alın.'
 ],href:'/panel?view=activity',action:'Etkinlik akışını aç'},
 {id:'arama',nav:'Arama ve liste filtreleri',title:'Mail kaydını konuya göre bulun',icon:Search,body:'Üst başlıktaki Maillerde ara düğmesi veya ⌘/Ctrl + K kısayolu arama penceresini açar. Telefonda aynı arama ikonunu kullanabilirsiniz. Arama son 50 kayıtta mail konusuna göre yapılır.',steps:[
 'Konuya ait bir kelime yazıp Ara düğmesine basın. Alıcı adresi veya mesaj gövdesinde arama bu ekranda sunulmaz.',
 'Takip Edilen Mailler bölümünde Tüm mailler, Takip Açık, Açılma Algılanan ve Durdurulan filtrelerini kullanın. Dar ekranda filtreleri yatay kaydırabilirsiniz.',
 'Arama ve filtre birlikte uygulanabilir. Beklediğiniz kayıt yoksa arama kelimesini veya filtreyi temizleyin. Listenin son 50 kayıt kapsamını dikkate alın.'
 ],href:'/panel?view=messages',action:'Mail kayıtlarını aç'},
 {id:'durdurma',nav:'Bir mailin takibini durdurma',title:'Yeni açılma kaydı toplanmasını durdurun',icon:Pause,body:'Takibi durdur yalnızca seçtiğiniz mailin gelecekteki açılma kayıtlarını kapatır. Önceki kayıtlar korunur; mail silinmez veya geri çağrılmaz.',steps:[
 'İlgili mailin ayrıntısını açıp Takibi durdur düğmesine basın ve işlemin tamamlanmasını bekleyin.',
 'Durdurulmuş takip durumunu kontrol edin. Bu sürümde durdurulan takibi yeniden açma seçeneği yoktur. Gönderirken takibi kapalı bıraktığınız maile sonradan takip eklenmez.',
 'Hesaptan çıkmak, Gmail yetkisini kaldırmak veya eklentiyi ayırmak daha önce gönderilmiş maillerin takibini kendiliğinden kapatmaz. Toplu gönderimi duraklatmak da gönderilmiş maillerin takibini durdurmaz.'
 ],href:'/panel?view=messages',action:'Takip edilen mailleri aç'},
 {id:'hesap-guvenligi',nav:'Profil, adres ve fatura',title:'Hesap bilgilerinizi ve işlem geçmişinizi yönetin',icon:ShieldCheck,body:'Hesap Detayları mevcut paketi, kullanım hakkını, profilinizi, fatura profilini ve ödeme/paket geçmişini bir araya getirir. Üyelik e-posta adresini değiştirmek bağlı Gmail adresini değiştirmez.',steps:[
 'Profil Bilgileri bölümündeki Ad Soyad alanını düzenleyip Bilgileri Kaydet ile saklayın. Mevcut paketinizin ayrıntıları için üstteki paket rozetini de kullanabilirsiniz.',
 'Fatura Bilgileri bölümünü açıp bireysel veya kurumsal profili seçin. İstenen kimlik/şirket ve Adres alanlarını tamamlayıp kaydedin. Fatura profili kaydetmek tahsilat veya fatura oluşturma işlemi değildir.',
 'Üyelik adresini değiştirmek için yeni e-postayı ve mevcut şifreyi girin. Hem eski hem yeni adrese gönderilen bağlantılar onaylandığında değişiklik tamamlanır; yeni adresle tekrar giriş yapın.',
 'Ödeme ve Paket Geçmişi son 50 işlemi gösterir. Tahsilat Yok veya Ücretsiz Erişim Tanımı kayıtlarını ücretli ödeme olarak yorumlamayın. Bağlı Gmail adresini değiştirmek için Bağlı Hesaplar bölümünü kullanın.'
 ],href:'/panel?view=account',action:'Hesap detaylarını aç'},
 {id:'sifre-oturum',nav:'Şifre ve oturum güvenliği',title:'Şifrenizi yenileyin ve oturumunuzu koruyun',icon:ShieldCheck,body:'Giriş ekranındaki Şifremi unuttum veya Hesap Detayları içindeki Şifremi Yenile bağlantısıyla kayıtlı üyelik adresinize yenileme bağlantısı isteyebilirsiniz.',steps:[
 'Şifrenizi yenileyin ekranında üyelik e-posta adresinizi yazıp Bağlantı gönder düğmesini kullanın. Animasyon sürerken tekrar basmayın; ekrandaki sonucu bekleyin.',
 'Gelen son yenileme bağlantısını açıp yeni şifreyi iki kez girin. '+PASSWORD_HELP+' Bağlantı geçersiz veya süresi dolmuşsa yeni bir istek başlatın.',
 'Şifre yenileme ve tamamlanan e-posta değişikliği eski oturumları kapatır. Yeniden giriş yapın, gerekirse Chrome eklentisini eşleştirin ve varsa toplu gönderim kuyruğunu kontrol edin.',
 'Paylaşılan cihazda Hesabım → Çıkış yap yolunu kullanın. Şifrenizi, doğrulama kodunuzu, yenileme bağlantınızı veya Google izin/onay bilgilerinizi başkalarıyla paylaşmayın.'
 ],href:'/sifremi-unuttum',action:'Şifre yenileme ekranını aç'},
 {id:'yardim',nav:'Sorun giderme ve destek',title:'Bir işlem tamamlanmadığında önce durumunu kontrol edin',icon:LifeBuoy,body:'Önce ekrandaki açıklamayı okuyun. Özellikle gönderim sonucu belirsizse aynı işlemi hemen yeniden başlatmayın; kaydın veya alıcının son durumunu inceleyin.',steps:[
 'Servise ulaşılamıyorsa: üstteki bağlantı göstergesini ve internetinizi kontrol edin. Oturum Gerekli görünüyorsa yeniden giriş yapın. Çevrimiçi göstergesi, Gmail gönderim izninin açık olduğuna dair bir onay değildir.',
 'Gmail bağlantısı kurulamıyorsa: doğru Google hesabını ve gönderim iznini kontrol edin. Google erişim kısıtı veya Erişim reddedildi hatası varsa mesajı not edip desteğe başvurun.',
 'Eklenti göndereni doğrulayamıyorsa: bağlı Gmail adresini, aktif Signature erişimini ve Gmail’de açık hesabı karşılaştırın. Gmail sekmesini yenileyin; gerekiyorsa Hesabı bağla → Onayı kontrol et adımlarını tekrarlayın.',
 'CSV önizlemesi açılmıyorsa: belirtilen satırları, email başlığını, kullanılan değişkenleri ve eksik hitap alanlarını düzeltin. Taslak kilitliyse paket sınırınızı kontrol edin. Outlook kurulumu veya mağazadan yükleme şu anda kullanılamaz.',
 'Destek için info@folloopy.com adresine veya İletişim sayfasına ilgili ekranı, işlem zamanını ve hata mesajını iletin. Ekran görüntüsündeki gereksiz kişisel bilgileri gizleyin; şifre, doğrulama kodu ve yenileme bağlantısı göndermeyin.'
 ],href:'/iletisim',action:'İletişim sayfasını aç'},
];
