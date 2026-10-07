# Otomatik roller

**Topluluk menüsü → Uygulama ayarları → Otomatik roller**, topluluğa yeni katılan üyelere başlangıç rolleri verir. Ayrı bot kurulumu veya bot tokenı gerekmez. Modül self-hosted PostgreSQL kurulumunda yalnızca topluluk sahibine açıktır ve başlangıçta kapalıdır.

## Kullanım

1. **Üye rolleri** veya **Bot rolleri** listesini açıp **Rol oluştur** düğmesine basın. Topluluk ayarlarının mevcut **Roller** ekranı açılır. Rol başarıyla oluşturulunca otomatik roller ekranına dönülür ve iki liste yenilenir. Kaydedilmemiş rol seçimleri, modül anahtarı ve gecikme taslağı korunur. Yeni rolü istediğiniz listeden seçin.
2. **Üye rolleri** alanında insan üyeler için rol seçin. Birden çok rol seçilebilir; her listede en fazla 20 rol vardır.
3. Botlara da rol vermek isterseniz **Bot rolleri** alanını ayrıca doldurun. Boş bırakıldığında botlara üye rolleri verilmez.
4. **Atama gecikmesi (saniye)** alanını 0–3600 arasında ayarlayın. 0 seçimi commit sonrası worker'ı hemen uyandırır; diğer değerler en erken atama zamanını belirtir. Gecikmeli işler 5 saniyelik kurtarma taramasında alınır, dolayısıyla zamanlama kesin bir saniye garantisi değildir.
5. Modülü etkinleştirin ve **Değişiklikleri kaydet** düğmesini kullanın. **Sıfırla** kaydedilen ayarlara döner. Sürüm çakışmasında taslak korunur; **Yenile** güncel ayarları alır.

Etkinleştirme mevcut üyelere geriye dönük rol dağıtmaz. Sonraki katılımlar seçilen listeyi kullanır. Kullanıcı ayrılıp yeniden katılırsa yeni katılım için yeni işlem oluşur. Kullanıcıya elle verilen veya zaten bulunan roller silinmez. Aynı rolün tekrar verilmesi ikinci bir rol değişikliği oluşturmaz.

`@everyone`, yönetilen ve `ElevatedPermissions` kapsamındaki yönetim/moderasyon izinlerine sahip roller otomasyon için uygun değildir. Bu sınır rol dağıtımını normal başlangıç rollerine indirger. Geçmişte seçilmiş bir rol sonradan silinirse veya bu izinleri kazanırsa panel eksik/geçersiz seçimi gösterir ve worker o rolü atlamış olarak kaydeder. Başka bir rol otomatik olarak seçilmez; kalan geçerli roller atanabilir.

## İşlem geçmişi ve kayıtlar

Modül sayfasındaki ve ortak **İşlem geçmişi** ekranındaki bölüm son 50 yapılandırma/atama sonucunu gösterir. Sonuçlar atanmış, atlanmış veya başarısız durumundadır. Atlanma gerekçesi ayar değişikliği, üyelik sona ermesi, geçersiz rol, seçilmiş rol olmaması veya operatör durdurması olabilir. Kısmi atamada tamamlanan roller geçmişte korunur.

Rol değişiklikleri Fluxer'ın kendi üyelik, gateway ve denetim yolunu kullanır. Sistem aktörü **Netrcol**'dur. Olay kayıtları modülünde **Üyenin rolleri değişti** etkinse normal Netrcol sistem embed'i o modülün kayıt kanalına gider; otomatik roller kendi başına yeni bir bildirim kanalı gerektirmez. Panel ve durum metinleri kişisel arayüz dilinde, kanal kayıtları topluluğun ortak Netrcol mesaj dilinde görünür. 34 dil desteklenir.

## Kalıcılık ve durdurma

Yeni üyelik yazımı ve otomatik rol outbox kaydı aynı PostgreSQL işleminde commit olur. Outbox yazılamazsa üyelik de commit olmaz. Commit sonrası JetStream bildirimi worker'ı uyandırır; bildirim kaybolursa kalıcı kayıt 5 saniyelik taramayla yeniden bulunur. İşler 60 saniyelik lease, en fazla altı deneme ve katılım kimliğinden üretilen sabit kaynak anahtarı kullanır.

Her rol yazımından önce güncel ayar sürümü, modül anahtarı, sahiplik onayı, üyenin aynı katılıma ait olması ve rolün uygunluğu kontrol edilir. Native rol yazımı sürüm kontrollü birleştirme yapar; ayrılmış üyeyi yeniden oluşturmaz. Kesintiden sonra mevcut rol korunur ve iş uzlaştırılır. Teslimat sonucu kalıcılaştırılmışsa geçmiş yazımı hatasında yeniden rol dağıtımı yerine sonuç uzlaştırılır. Mutlak exactly-once veya her kesintide denetim kaydının eksiksiz geri kurulması garantisi verilmez.

Modülü kapatmak ya da ayarı değiştirmek bekleyen eski sürüm işlerini iptal eder; yeni ayar mevcut kuyruğa geriye dönük uygulanmaz. Sahiplik devrinde modül duraklar; yeni sahip ayarları yeniden kaydetmelidir. Operatörün `NETRCOL_AUTOMATIONS_ENABLED=false` anahtarı yeni otomasyonları durdurur. Tamamlanmış rol atamalarını geri almaz.

Yapılandırma kalıcıdır; ayar geçmişi 90 gün, atama sonuçları 30 gün, kuyruk ve tamamlanma işaretleri 7 gün saklanır. Rol atamalarının ömrü bu saklama süreleriyle sınırlı değildir. Yeni fiziksel veritabanı tablosu veya volume sıfırlaması gerekmez; kayıtlar mevcut PostgreSQL KV katmanında tutulur.

## API ve doğrulama

- `GET/PUT /guilds/:guild_id/application-settings/automatic-roles`
- `GET /guilds/:guild_id/application-settings/automatic-roles/history`

PUT gövdesi `enabled`, `member_role_ids`, `bot_role_ids`, `delay_seconds` ve `revision` taşır. Eski sürüm 409, uygunsuz rol veya aralık dışı gecikme 400, sahip olmayan erişim 403 döner.

Çeviri kontrolü: `node netrcol/scripts/automatic-roles-i18n.mjs --check`. Kaynak imajlarını güncellemek için `Start-Local.ps1 -Build` kullanın; hesaplar ve volume'lar korunur.

Entegrasyon testleri yeni katılım, ayrı bot listeleri, gecikme, mevcut rollerin korunması, tekrar, ayrılma/yeniden katılma, sahiplik devri, rol silinmesi/izin yükselmesi, sürüm çakışması, operatör durdurması, worker kesintisi ve gerçek PostgreSQL hata enjeksiyonunu kapsar. Yerel HTTP/gateway/worker denemesi ayrı hesap ve topluluk oluşturup temizler:

```powershell
node netrcol/scripts/verify-automatic-roles-live.mjs --run --seed-local-fixtures
```

`--seed-local-fixtures` yalnızca sahip olunan loopback geliştirme kurulumunda yeni test hesapları oluşturur. Mevcut hesapları değiştirmez; kayıt/CAPTCHA akışı bu testin kapsamına girmez. Kimlik doğrulama bilgileri rapora yazılmaz. Sonuçlar `.fluxer/local-bootstrap/automatic-roles-live-results.json` içinde tutulur.

6 Ekim 2026 doğrulamasında 18 otomatik rol entegrasyon testi, Netrcol API regresyonunun toplam 266 testi ve panel/ortak seçicinin 95 testi geçti. Yedi canlı senaryo gerçek HTTP → PostgreSQL → JetStream worker → gateway/kanal mesajı zincirinde doğrulandı: sahip kontrolü, insan üye ataması, gecikme ve mevcut rolün korunması, ayar değişikliği, ayrılma, ayrı bot listesi, sürüm çakışması ve silinen rol. Test topluluğu ile OAuth uygulamaları temizlendi, geçici hesapların silme süreci başlatıldı. Kaynak API/worker ve web derlemeleri, tip kontrolleri, 34 dil ve HTTP/JS/CSS kontrolleri geçti.

7 Ekim'deki son panel kontrolünde Tab/Shift+Tab, Space, Enter, taslak koruması ve 390 piksel mobil görünüm doğrulandı. Ortak rol seçicisinde Escape'in tüm ayar penceresini kapatması düzeltildi: ilk Escape listeyi kapatır ve odağı seçiciye döndürür. Kaydedilmiş ayarlar değiştirilmedi. [Masaüstü](../screenshots/automatic-roles-settings.jpg) ve [mobil](../screenshots/automatic-roles-mobile.jpg) görüntüler çalışan uygulamadan alındı.

7 Ekim'de rol oluşturma kısayollarıyla birlikte panel ve ortak seçicinin 101 testi geçti. İzole toplulukta üye ve bot listelerinden mevcut Roller ekranı açılıp üç gerçek rol oluşturuldu; başarılı işlemden sonra otomatik dönüş ve iki listenin yenilenmesi masaüstünde ve 390 × 844 mobil görünümde doğrulandı. Önceki seçimler ile 37 ve 23 saniyelik gecikme taslakları korundu; rol oluşturma ayarları otomatik kaydetmedi. Taslak değiştiğinde modal kapatma korumasının açık listenin Escape önceliğini bozması da giderildi. App tip kontrolü, web derlemesi, 34 dil ve HTTP/JS/CSS kontrolleri geçti. Test topluluğu ve cihazdaki geçici oturum temizlendi; test hesabının silme süreci başlatıldı. Fluxcol ayarları değiştirilmedi. [Rol oluşturma menüsü](../screenshots/automatic-roles-create-role.jpg) ve [mobil menü](../screenshots/automatic-roles-create-mobile.jpg) doğrudan çalışan uygulamadan alındı.
