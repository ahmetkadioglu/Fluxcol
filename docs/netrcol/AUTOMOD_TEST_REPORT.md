# AutoMod işlev testleri — 6 Ekim 2026

14 kural sınandı. **335 test geçti**: son çalıştırmada 255 API testi ve önceki çalıştırmada 80 panel/ayar testi. Aynı testlerin tekrar çalıştırılması ikinci kez sayılmaz. API kapsamı: 127 AutoMod algılama/yapılandırma/kuyruk testi, 50 gerçek işlem akışı, 7 wake-up ve 71 webhook/OAuth regresyon testi. Panel testlerinin 51'i AutoMod'a aittir.

## Ortam ve kapsam

255 API entegrasyonu geçici PostgreSQL 17 üzerinde, her senaryoda yeni hesaplar ve izole topluluklarla çalıştırıldı. Gerçek Fluxer HTTP yönlendiricileri, mesaj/üyelik/denetim yazımları, PostgreSQL outbox, AutoMod işlemcisi ve ilgili senaryolarda `ProcessAutoMod` worker görevi kullanıldı. Bu testlerin gateway, nesne depolama ve iş uyandırma adaptörleri test harness'inin test karşılıklarıdır. Canlı HTTP/WebSocket/JetStream ölçümleri ayrıca raporlanır; birim/entegrasyon sayısına eklenmez.

Canlı panel `localhost:8088 → Fluxcol → Uygulama ayarları → AutoMod` üzerinden ayrıca kontrol edildi. Fluxcol'a test yaptırımı uygulanmadı; geçici panel taslakları atıldı.

## Kural sonuçları

| Kural | Doğrulanan işlev | Sonuç |
| --- | --- | --- |
| Yasaklı kelimeler | Tam/kelime içi eşleşme, Unicode/harf normalleştirme, kapsamlar, silme/uyarı, kuyruktayken düzeltilmiş mesajın korunması | Geçti |
| Tekrarlanan metin | Aynı üyenin aynı normalleştirilmiş metni seçili kanallarda sayılır; diğer üyeler, düzenlemeler ve kapsam dışı kanallar sayılmaz | Geçti |
| Sunucu davetleri | Fluxer/Discord/davet adresleri, ortak URL öneki izin listesi, harf duyarlılığı ve mesajın silinmesi | Geçti |
| Dış bağlantılar | Alan/alt alan istisnası, benzer görünen alanların engellenmesi, URL öneki ve düzenlenmiş mesaj kontrolü | Geçti |
| Aşırı büyük harf | Minimum harf sayısı, yüzdelik eşit sınırın korunması, sınır aşımının silinmesi | Geçti |
| Aşırı emoji | Eşik; aile, ten rengi, bayrak, tuş ve özel emoji dizilerinin sayımı | Geçti |
| Aşırı spoiler | Tam/çok satırlı bölümler, kapanmamış bölüm, oluşturma/düzenleme, tek teslimat | Geçti |
| Aşırı etiketleme | Tekil kullanıcı/rol/@everyone/@here sayımı, aynı kullanıcının iki etiket biçimi, oluşturma/düzenleme | Geçti; yanlış pozitif düzeltildi |
| Zalgo | Ardışık birleştirme işaretleri, sıradan aksanlar ve çeşitli yazı sistemleri, kapsam, oluşturma/düzenleme | Geçti |
| Spam koruması | Aynı üyenin yeni mesajları, seçili kanallar, düzenlemelerin sayılmaması, 1–600 saniye ve pencere sınırları | Geçti |
| Karakter sınırı | Unicode kod noktaları, tam sınır/sınır aşımı, dört kapsam, oluşturma/düzenleme | Geçti |
| Medya spamı | Gerçek dosya ekleri/çıkartmalar; düzenlemeler, düz bağlantılar ve emojiler sayılmaz | Geçti |
| Anti Raid | Gerçek katılım dalgası → kalıcı sayaç → lockdown → sonraki katılım/mesajın engellenmesi; yaş sınırları, süre dolumu, sahip erişimi; worker katılım bildiriminden önce çalışınca da başarılı katılım | Geçti; katılım yarışı düzeltildi |
| Anti Nuke | 17 denetim türünün gerçek üreticileri, kayıt modu/yaptırım, aktör karantinası, sahip erişimi, topluluk sınırı ve süre dolumu | Geçti; üç atlatma yolu düzeltildi |

## Düzeltilen hatalar

1. Karantinadaki yönetici `/webhooks/:webhook_id` üzerinden webhook değiştirebiliyordu. Doğrulanmış webhook topluluğunda işlem öncesi hold kontrolü eklendi; test 403 ve değişmemiş webhook doğruluyor.
2. Aynı yolun silme isteği karantinayı atlıyordu. Silme öncesi aynı kontrol eklendi; webhook korunuyor.
3. OAuth bot onayı topluluk kimliğini istek gövdesinde taşıdığı için route-parametre kontrolünü atlıyordu. Bot onayı OAuth yan etkilerinden önce hold kontrolünden geçiyor; test 403 ve botun topluluğa eklenmediğini doğruluyor.
4. `<@id>` ve `<@!id>` aynı kullanıcı için iki etiket sayılıyordu. Sayımdan önce iki biçim birleştirildi; hem algılama testi hem gerçek mesaj oluşturma/düzenleme akışı sınırdaki mesajı koruyor.
5. Canlı worker, üyelik yazımından hemen sonra Anti Raid kilidini başlatınca Fluxer'ın katılım bildirimi kullanıcı mesajı sayılıp engelleniyordu. Üyelik oluşmasına rağmen davet kabul isteği 403 dönüyordu. Yerleşik sistem bildirimleri hold kontrolünden ve AutoMod kuyruğundan çıkarıldı. Yarış durumu düzeltmeden önce gerçek API testinde 403 ile yeniden üretildi; düzeltmeden sonra katılım, bildirim, aktif kilit ve sonraki üye mesajının engellenmesi geçti. Ayrı testler katılım bildiriminin spam sayılmadığını ve gerçek yanıt mesajının hâlâ silindiğini doğruluyor.

Webhook/OAuth testleri süre dolunca işlemlerin yeniden yapılabildiğini, sahibin kurtarma işlemlerini ve başka topluluktaki yetkilerin etkilenmediğini de doğruluyor. Üye aktörü olmayan webhook token uçlarının davranışı değiştirilmedi.

## Ortak yaptırım ve dayanıklılık

- Devre dışı, yalnızca kayıt, uyarı, silme, silme + uyarı, zaman aşımı, silme + zaman aşımı ve lockdown gerçek mesaj/üyelik sonuçlarıyla sınandı.
- Üç kurala takılan mesaj için tek silme, tek zaman aşımı, tek geçmiş kaydı ve tek Netrcol sistem bildirimi oluştu. Mevcut daha uzun zaman aşımı kısaltılmadı.
- Sistem aktörü, embed, bildirim oluşturmayan mention ayarları ve ihlal metninin kopyalanmaması kontrol edildi. Sistemin kendi mesajları yeni AutoMod döngüsü başlatmadı.
- Süresi dolan worker lease'i yeniden alınıp iş tamamlandı. Bildirim kalıcılaştıktan sonra dispatch hatası enjekte edildi; yeniden deneme aynı mesaj kimliğini kullandı, ikinci mesaj oluşturmadı.
- Silinen bildirim kanalı için başka kanal seçilmedi; altı deneme sonunda geçmişe başarısız sonuç yazıldı. Gerçekleşen moderasyona rağmen teslimat hatası gizlenmedi.
- İptal edilen worker mesajları değiştirmedi. 55 mesajlık kuyruk birden fazla sayfada boşaldı; ikinci çalıştırma 0 iş yaptı ve 55 farklı sistem mesajı kaldı. Bu bir kapasite ölçümü değildir.
- PostgreSQL outbox yazım hatasında gerçek mesaj oluşturma ve düzenleme geri alındı; önceki metin korundu.
- Sahiplik devri, operatör durdurma anahtarı, ayar sürümü değişimi/çakışması, bot/üye/rol/kanal/kategori istisnaları ve eski kayıtlar sınandı.

## Panel, dil ve tip kontrolleri

80 panel/ayar testi geçti: alan doğrulaması, kayıt, sürüm çakışması, taslak koruma, kapsam ve paylaşılan listeler. Canlı tarayıcıda 14 ayar ekranı Enter ile açıldı, başlık odağı ve geri dönüşleri doğrulandı. Space ayrı izinleri açtı; alanlar düzenlenebilir oldu. Kelime Enter ile eklendi, Geri taslağı korudu ve Vazgeç değişiklikleri kaldırdı.

14 ekran 390 × 844 mobil görünümde açıldı; sayfa/yatay kaydırma genişliği 390 px idi. Geçici ekran boyutu sıfırlandı. 34 dil için 84 AutoMod metni, 6970 uygulama ayarı çevirisi ve 253 olay/alan/UI etiketi kontrolleri geçti. App/API tip kontrolleri, strict Lingui, Biome ve `git diff --check` geçti.

## Tekrar çalıştırma ve kanıt

Mevcut test imajlarıyla `.fluxer/local-bootstrap/check-automod-api.sh` ve `check-automod-app.sh` kullanılır. API konteynerine ayrı PostgreSQL adresi `NETRCOL_TEST_POSTGRES_URL` olarak verilmelidir. `kv_automod_flow` ve `kv_automod_unit` testler tarafından temizlenir; canlı veritabanı kullanılmamalıdır.

Günlükler: `.fluxer/local-bootstrap/automod-live-api-final.log` (255 API), `automod-functional-app.log` (80 panel), `automod-live-regression-before.log` (düzeltmeden önce 403).

## Canlı HTTP, gateway ve worker — 6 Ekim 2026

Yeni imajla `localhost:8088` üzerindeki gerçek HTTP API, JSON WebSocket gateway, PostgreSQL, JetStream worker ve dosya depolama kullanıldı. Yeni bir test topluluğu ve iki geçici hesapla **16 senaryo geçti, 0 hata**: gateway başlangıcı, 14 kural ve eşzamanlı mesaj denemesi. Çalıştırma kimliği `3150586de044`, UTC 15:56:40–15:56:59.

- Dokuz içerik/sayı kuralında sınırdaki veya eşleşmeyen mesaj korundu; ihlal mesajı silindi, Netrcol sistem embed'i gateway üzerinden alınıp HTTP ile kalıcı mesaj ve işlem geçmişi doğrulandı. Tekrarlanan metin, spam ve gerçek multipart dosya yüklemelerinde sayaç eşiği sınandı.
- Anti Nuke gerçek yönetici kanal değişikliğinden tetiklendi; sonraki yönetici isteği 403 döndü, sahip kurtarma isteği geçti. Anti Raid gerçek çıkış/yeniden katılmada tetiklendi; katılım 200 döndü ve yerleşik katılım bildirimi geldi. Kilit üye mesajını engelledi, sahibin mesajına izin verdi; süre dolunca üye yeniden yazabildi.
- 14 kuralın tekil denemelerinde HTTP işlem başlangıcından sistem bildiriminin gateway'de alınmasına kadar **41–133 ms** ölçüldü. Bunlar bu yerel testin ölçümleridir; genel gecikme garantisi değildir.
- 20 mesaj, dörder eşzamanlı istekle beş grupta gönderildi. 20 farklı mesaj için tam 20 silme olayı, 20 farklı Netrcol bildirimi ve 20 başarılı geçmiş kaydı görüldü; tekrar teslimat oluşmadı. Silme olayının gateway'e ulaşma süresi: minimum 55 ms, medyan 98 ms, p95 129 ms, maksimum 135 ms. Gateway yeniden bağlanma/geçersiz oturum/kesinti ve topluluğun `unavailable` olması görülmedi. Bu sınırlandırılmış deneme maksimum kapasite ölçümü değildir.
- Test topluluğu gerçek silme ucuyla kaldırıldı; iki test hesabı için normal Fluxer silme süreci başlatıldı. Hesapların bekleme süresi nedeniyle anında fiziksel silinmesi iddia edilmez. Önceki başarısız denemelerin test toplulukları da temizlendi ve test hesapları için silme istekleri kabul edildi. Mevcut kullanıcılar, Fluxcol ayarları ve Docker volume'ları değişmedi.

Yerel kayıt CAPTCHA istediğinden, yalnızca iki yeni test hesabı ve oturumunun standart PostgreSQL satırları oluşturuldu. Kayıt/CAPTCHA akışı bu testin kapsamına alınmadı; sonrasındaki tüm topluluk, mesaj, dosya, yönetim ve temizleme işlemleri gerçek API üzerinden yapıldı. Token/parolalar rapora veya günlüğe yazılmaz.

Yeniden çalıştırma: depo kökünde `node netrcol/scripts/verify-automod-live.mjs --run --seed-local-fixtures`. Betik yalnızca sabit `localhost:8088` kurulumunu kullanır, kendi test topluluğunu oluşturup temizler. Sonuç: `.fluxer/local-bootstrap/automod-live-results.json`; günlük: `automod-live.log`. Düzeltme öncesi canlı hata: `automod-live-results-before-fix.json`.

## Yerel uygulama ve son doğrulama

API kaynak imajı başarıyla derlendi ve `api` ile `worker` servislerine uygulandı. İki servis de aynı yeni imajı (`7e586ad56ce3…`) kullanıyor ve Docker sağlık kontrolleri `healthy` döndü. Kaynak derleme/deploy günlükleri: `automod-live-build-final.log`, `automod-live-deploy.log`.

`node netrcol/scripts/verify-local.mjs` geçti: web, API, gateway ve medya sağlık uçları; Fluxer keşif belgesi; giriş HTML'i, CSS ve JavaScript dosyaları doğrulandı. Günlük: `automod-live-health.log`. Canlı gateway teslimatı yukarıdaki 16 senaryoda ayrıca sınandı. Son API tip kontrolü, Biome, betik sözdizimi ve `git diff --check` geçti.

Yalnızca bu çalışma için oluşturulan, volume kullanmayan geçici PostgreSQL konteyneri ve etiketli test ağı kaldırıldı. Yerel hesaplar ve mevcut Docker volume'ları korundu.
