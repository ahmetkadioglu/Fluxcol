# Yerel Fluxer'ı açma

## Mevcut durum

5 Ekim 2026 tarihinde WSL 2.7.13 ve Docker Desktop 4.93.0 kuruldu. Windows'un Virtual Machine Platform özelliği etkinleştirildi ve kullanıcı Windows'u yeniden başlattı. Docker'ın Linux motoru çalışıyor; Windows'ta bekleyen yeniden başlatma kalmadı.

Yerel Compose servisleri başlatıldı ve sağlık kontrolleri geçti. Web/API/gateway/media, discovery ve ana sayfa HTTP 200 döndü; HTML'nin yüklediği JavaScript ve CSS dosyaları da doğru içerik türüyle erişilebilir. İlk kurulumdan sonra oluşturulan **KDGL** hesabı ve **Fluxcol** topluluğu korundu. Uygulama ayarları paneli mevcut oturumda açıldı; masaüstü, sağ tık ve mobil menü girişleri doğrulandı. Olay kayıtları kanal teslimatıyla çalışır; ses olaylarının gateway/RPC akışı test edilir. Fiziksel mikrofon, kamera ve LiveKit medya aktarımı bu modül testlerinin kapsamına girmez.

İlk denemedeki `Virtual Machine Platform not enabled` hatası, Windows'un **Yeniden başlat** seçeneğiyle giderildi. Ardından bulunan boş ekran sorunu için `app-proxy` servisinin CDN override'ı boş bırakıldı; JavaScript/CSS dosyaları self-hosted imajdan sunuluyor. API tarafındaki localhost CDN adresi korunuyor.

## Başlatma

Docker Desktop'ın Linux container motorunun açılmasını bekle. Proje klasöründe:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Start-Local.ps1
```

Başlatıcı:

1. Eksikse yerel yapılandırma ve rastgele anahtarlar üretir; mevcut anahtarları korur.
2. Docker Desktop kapalıysa açmayı dener.
3. `netrcol-local` adlı bağımsız Compose projesini başlatır.
4. Web için `netrcol/fluxer-app-proxy:local`, API/worker için `netrcol/fluxer-api:local`, gateway için `netrcol/fluxer-gateway:local` kullanır; diğer servislerin eksik upstream imajlarını indirir.
5. Container sağlık durumlarını, altı HTTP uç noktasını ve giriş JavaScript/CSS dosyalarını kontrol eder.
6. Kontroller geçince tarayıcıda **<http://localhost:8088>** adresini açar.

Tarayıcıyı otomatik açmamak için `-NoBrowser` eklenebilir. İlk ekranda yerel hesabını oluştur ve instance kurulum sihirbazını tamamla. Buradaki hesap ve veriler bu yerel instance'a aittir.

İlk kurulumda veya web/API/worker/gateway kaynaklarını değiştirdikten sonra yerel imajları derle:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Start-Local.ps1 -Build
```

`-Build`, web, API/worker, gateway, kullanıcı ve mesaj servislerinin Dockerfile'ları üzerinden Linux container içinde derleme yapar. İlk derleme internet bağlantısı, disk alanı ve birkaç dakika gerektirir. Başarılı olana kadar mevcut servisler çalışır. Normal başlatma yeniden derlemez; yerel imaj eksikse önce `-Build` kullanılmalıdır. Hesaplar ve Docker volume'ları korunur.

Yerleşik sistem mesajlarının göndereni **Netrcol SYSTEM** olarak görünür ve Netrcol logosunu kullanır. Kullanıcı ve mesaj servisleri/shard'ları kaynak imajlarına geçirilmiştir; mesaj geçmişi, yeni otomasyon kayıtları ve sistem bildirimleri aynı kimliği kullanır. Ayrıntılar [Sistem hesabı belgesindedir](SYSTEM_IDENTITY.md).

Windows checkout'unda kaynak metinler LF satır sonuyla tutulmalıdır; Linux betiklerinin ve kaynakta tam metin eşleştiren üretim kontrollerinin çalışması buna bağlıdır. Upstream `.gitattributes` değiştirilmez; bunun yerine repository'ye özel git ayarı kullanılır:

```powershell
git config core.autocrlf false
git config core.eol lf
```

Yeni bir klonda bu ayar ilk checkout'tan önce yapılmalıdır (`git clone -c core.autocrlf=false -c core.eol=lf ...`). `Start-Local.ps1` her başlatmada bu ayarı ve CRLF'ye dönmüş kaynak dosyaları kontrol eder: normal başlatmada uyarır, `-Build` ile derlemeyi başlamadan durdurur.

Topluluk sahibi, başlık menüsünde **Topluluk ayarları → Uygulama ayarları** sırasını görür. Aynı giriş topluluğa sağ tık menüsünde ve mobil menüde bulunur. `/channels/:guildId/application-settings` sayfası yalnızca self-hosted kurulumda topluluk sahibine açılır. Topluluk ayarları görünümündeki pencere, altı kategori ve 31 modülün tasarım önizlemesini sunar. Başlık/kapatma düğmesi, topluluk adı, yan menü simgeleri ve bölüm stilleri mevcut topluluk ayarları bileşenlerini kullanır. Genel bakışta kartlar yerine bölümlere ayrılmış sade modül satırları vardır. Soldaki modül seçimi sağdaki örnek ayarları değiştirir; mobilde liste ve ayrıntı arasında geçilir. **İşlem geçmişi** düğmesi masaüstünde sol menünün altındadır ve menünün kullanılabilir genişliğini doldurur; mobil modül listesinin altında da bulunur. AI asistanı kaldırılmıştır. Modül adları, açıklamaları ve örnek ayar metinleri desteklenen 34 dilin tamamında çevrilmiştir. `?module=tickets` gibi bağlantılar seçimi yenilemede korur. Olay kayıtları, AutoMod ve İşlem geçmişi işlevseldir; kalan 28 modül önizlemedir. 14 kontrol ve yaptırım sınırları için [AutoMod belgesine](AUTOMOD.md) bakın. 11 kategoride 60 olay seçeneği, olay/kategori/varsayılan kanal önceliği, isteğe bağlı mesaj metni, kayıt dili ve test teslimatı için [Olay kayıtları belgesine](EVENT_LOGS.md) bakın.

**AutoMod → Yasaklı kelimeler → Ayarlar**, ortak veya kurala özel kullanıcı/rol/kanal/kategori kapsamı ile iki kelime listesi sunar: tam kelime ve kelime içinde eşleşme. Enter/virgülle ekleme, tek tek silme, açıklamalı örnekler, Vazgeç ve Kaydet ve kapat vardır. Açık kullanıcı seçimi rol seçiminden önceliklidir; kanal ve kategori sınırları korunur. Mevcut listeler ve istisnalar yükseltmede korunur. Yeni metinler desteklenen 34 dilde çevrilmiştir.

**AutoMod → Tekrarlanan metin → Ayarlar** aynı düzende ayrı bir ekran açar. Ortak veya kurala özel dört kapsam seçiminin yanında tekrar sayısı ve süre penceresi bulunur. Mevcut değerler korunur; varsayılan 3 mesaj/10 saniyedir. Aynı üyenin kapsama dahil kanallardaki aynı metinleri birlikte sayılır. Vazgeç, Kaydet ve kapat, taslak koruması ve 34 dil desteği bu ekranda da bulunur.

Masaüstünde uygulama ayarları açıkken gerçek kanal görünümü arka planda korunur: `#general` başlığı, sohbet ve üye listesi panel başlığına dönüşmez. Normal kanaldan açıldığında aynı kanal bileşeni korunur; doğrudan bağlantı/yenileme son seçilen erişilebilir kanalı arka plana getirir. Kanal yoksa veya erişilemiyorsa kanal içeriği gösterilmez.

Klavye ile kullanımda `Tab` ve `Shift+Tab` paneldeki alanlar arasında dolaşır; masaüstü yan menüsünde `↑`/`↓` modülleri, `Home`/`End` ilk ve son öğeyi seçer. `Enter` veya `Space` seçimi açıp odağı içerik alanına taşır. Genel bakıştaki modül satırı ayrıntı ekranıyla değiştirildiğinde de odak içerikte kalır. `Escape` pencereyi kapatır; topluluk menüsünden açılmışsa odak o menünün düğmesine geri döner. Henüz kullanılamayan ayar alanları Tab sırasına girmez.

Modül satırları Fluxer'ın `FocusRing` bileşeniyle odaklanır; hover ve basılı durumları tema değişkenlerini kullanır. Kanal, kategori, rol ve seçenek türündeki alanlar topluluk ayarlarındaki `CompactComboboxRow` ile çizilir. Mobil ayrıntı ekranı topluluk ayarlarının 43,5 rem azami içerik genişliği ve güvenli alt boşluğunu kullanır. Başlık 80 ms, içerik 150 ms geçişle değişir; azaltılmış hareket tercihinde geçişler devre dışıdır. Modül listesine dönüldüğünde önceki kaydırma konumu geri yüklenir.

**AutoMod → Sunucu davetleri → Ayarlar** aynı izin gruplarıyla ayrı ekran açar. Bağlantı izin listesine en fazla 100 HTTP(S) URL öneki eklenebilir; bu liste hem davet hem dış bağlantı filtresinde geçerlidir. Protokol, yol ve büyük/küçük harf dikkate alınır. Enter/virgül, öğe kaldırma, sayaç, taslak koruması, Vazgeç ve Kaydet ve kapat desteklenir. Eski alan adı istisnaları korunur; yeni metinler 34 dilde çevrilmiştir. Ayrıntılar [AutoMod belgesindedir](AUTOMOD.md).

**AutoMod → Dış bağlantılar → Ayarlar** aynı düzende ayrı ekran açar. Ortak veya bu kurala özel dört izin grubu düzenlenebilir; davet filtresiyle paylaşılan URL izin listesi iki ekranda da aynı kaydı kullanır. Eski dış bağlantı alan adı istisnaları korunur. Vazgeç, Kaydet ve kapat, taslak koruması, klavye/mobil kullanım ve 34 dil desteği bulunur.

## Durdurma ve durum

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Stop-Local.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\netrcol\scripts\local.ps1 -Action Status
powershell -NoProfile -ExecutionPolicy Bypass -File .\netrcol\scripts\local.ps1 -Action Logs
```

Durdurma, hesapları, mesajları ve yüklenen dosyaları silmez. Betikler `down -v`, volume silme veya Windows yeniden başlatma işlemi yapmaz.

## Yerel erişim ve veri

- Web/API/gateway: `http://localhost:8088`, host üzerinde yalnızca `127.0.0.1` dinlenir.
- Ses için `7881/tcp` ve `7882/udp` de yalnızca loopback'e bağlanır. Ses çalışması ayrıca doğrulanmalıdır.
- İnternete yayın, router port yönlendirmesi, DNS veya public TLS sertifikası gerekmez.
- Yerel anahtarlar: `.fluxer/local/.env`; Git tarafından dışlanır ve ekrana yazdırılmaz.
- Kalıcı veriler: `netrcol-local` Compose projesinin Docker volume'ları.
- Yapılandırma: upstream `deploy/self-hosting/docker-compose.yml` + `netrcol/local/compose.yml`.
- SMTP kapalıdır; yerel test için e-posta gönderilmez.

Bu ayarlar tek bilgisayarda geliştirme içindir. LAN veya internet erişimi için adres, TLS, yetki ve bootstrap koşulları ayrıca ele alınmalıdır.

## Doğrulama

```powershell
node --test netrcol/scripts/prepare-local.test.mjs
powershell -NoProfile -ExecutionPolicy Bypass -File .\netrcol\scripts\local.ps1 -Action Check
node netrcol/scripts/verify-local.mjs
node netrcol/scripts/application-settings-i18n.mjs --check
node netrcol/scripts/event-log-i18n.mjs --check
```

Testler gerekli Compose değerlerini, VAPID anahtar çiftini, rastgele anahtar üretimini ve tekrar çalıştırmada anahtarların korunmasını doğrular. `Check` servis başlatmadan Compose şemasını kontrol eder. `verify-local.mjs` çalışan instance üzerinde HTTP ve giriş JS/CSS erişimini kontrol eder; hesabın ve sesin çalıştığını tek başına kanıtlamaz.

Son modül arayüzü doğrulamasında 23 panel/rota testi, tam tip kontrolü, Biome ve 34 dilin strict Lingui derlemesi geçti. Çeviri kontrolü 5.882 girdinin kapsamını ve yer tutucularını doğruladı. Kaynak imajı yeniden oluşturuldu; mevcut KDGL/Fluxcol oturumuyla masaüstü ve 390 px mobil görünümde İşlem geçmişi düğmesi açıldı. Alt düğmenin genişliği masaüstünde 295 px, mobilde 356 px ölçüldü; her iki durumda kendi alt alanıyla aynı genişlikteydi. Japonca ve Arapça dil seçimi üzerinden modül metinleri kontrol edildi. Derlemede mevcut sekiz CSS sıralama uyarısı devam ediyor; derleme ve HTTP/JS/CSS kontrolleri başarılı.

Klavye doğrulamasında, genel bakıştan modül açıldığında oluşan odak kaybı giderildi ve bu geçiş için regresyon testi eklendi. Toplam 24 panel/rota testi, tam tip kontrolü, Biome, kaynak derlemesi ve HTTP/JS/CSS kontrolleri geçti. `localhost:8088` üzerindeki Fluxcol topluluğunda menüden klavyeyle açma, görünür odak, ileri/geri Tab, ok tuşları, Home/End, Enter/Space, İşlem geçmişi ve Escape dönüşü doğrulandı. 390 px görünümde liste–ayrıntı geçişinde odak panel içinde kaldı.

Tasarım uyumu güncellemesinde 28 panel/rota testi, tam tip kontrolü, Biome, çeviri kontrolü, kaynak derlemesi ve HTTP/JS/CSS kontrolleri geçti. Gerçek Fluxcol oturumunda açık/koyu tema, ortak odak halkası ve devre dışı kanal/rol seçimleri doğrulandı. 390 px mobil görünümde listeden modüle geçip dönünce kaydırma konumu 946 px olarak korundu; odak panel içinde kaldı. 195 px dar yerleşimde ve Almanca uzun metinlerle yatay taşma görülmedi. Test sırasında değiştirilen dil, tema ve ekran genişliği eski değerlerine döndürüldü. Modüller tasarım önizlemesi olarak kaldı; ayar yazma işlemi eklenmedi.

Docker çalışmıyorsa önce Windows yeniden başlatmasının tamamlandığını ve Docker Desktop'ın Linux container modunda olduğunu kontrol et. Kurulum kaydı `.fluxer/local-bootstrap/runtime-install.json` dosyasındadır.

İlk Olay kayıtları sürümünde 23 PostgreSQL modül testi, 34 panel/form/rota testi, dört başlatma yapılandırması testi, API ve uygulama tip kontrolleri ve 34 dilde strict Lingui derlemesi geçti. 6.970 çeviri girdisi kontrol edildi. Web ve API/worker kaynak imajları yerel kuruluma uygulandı; HTTP/JS/CSS kontrolleri başarılı. Mevcut Fluxcol oturumunda `#general` kanalı ve Türkçe kayıt dili kaydedildi; test mesajı Fluxer System yazarıyla kanala ulaştı ve işlem geçmişinde **Gönderildi** durumu oluştu. Mesaj bağlantısı, Tab ile seçimler, kaydedilmemiş değişiklikte Escape koruması, 390 px mobil form/geçmiş ve servis yeniden başlatıldıktan sonra kalıcılık doğrulandı. Modül etkin bırakıldı.

Kapsamlı v2 sürümünde 11 kategoride 60 olay seçeneği ve gerçek kanal teslimatı eklendi. 45 API, 37 panel/form/rota/Checkbox, 3.190 gateway ve 4 başlatıcı testi geçti. API/app tip kontrolleri, 34 dil, Biome, kaynak derlemeleri ve HTTP/JS/CSS kontrolleri başarılı. Web, API/worker ve gateway yerel kaynak imajları kullanıyor. Son Fluxcol kontrolünde mevcut ayarlar korunmuştu; yeni olaylar ve mesaj metni kaydı kapalıydı. Türkçe test mesajı `#general` kanalına ulaştı ve geçmişte **Gönderildi** oldu. Masaüstü/mobil panel, arama, kısmi seçim, klavye, odak geri dönüşü, yenileme ve geri/ileri gezinme doğrulandı. Gerçek API mesaj işlemleri ve gateway/RPC olayları test edilir; fiziksel ses/kamera ve LiveKit medya aktarımı ayrıca doğrulanmalıdır. Ayrıntılı sonuçlar ve ekran görüntüleri [EVENT_LOGS.md](EVENT_LOGS.md) dosyasındadır.
