# NetrcolFLXR — Yerleşik Topluluk Platformu

> Durum: Olay kayıtları v2 ve 14 kurallı AutoMod çalışır. Mesaj denetimi, uyarı/silme/zaman aşımı, süreli baskın ve tahribat koruması; ortak işlem geçmişi ve 34 dil desteği. Üreticisi olmayan iki kayıt türü kapalıdır. Diğer modüller tasarım önizlemesidir.\
> Plan sürümü: 0.23 — 6 Ekim 2026
> Hedef: Fluxer deneyimini koruyan, topluluk araçlarını uygulama içinden yöneten bağımsız self-host dağıtımı.

## 1. Ürün vaadi

**Kendi Fluxer sunucunu kur; topluluğunu aynı uygulama içinden yönet, koru ve otomatikleştir.**

NetrcolFLXR, Fluxer tabanlı bağımsız bir açık kaynak dağıtımıdır. Karşılama, otomatik rol, olay kayıtları ve moderasyon uygulamanın içinden yapılandırılır. Kullanıcının bot davet etmesi, bot tokenı oluşturması, başka bir dashboard'a giriş yapması veya Netrcol merkezi altyapısına bağlanması gerekmez.

İlk hedef kullanıcı: Linux sunucusuna erişimi olan, bir veya birkaç topluluk işleten ve ayrı botların kurulum/bakım yükünü azaltmak isteyen operatör. Kurulumu operatör, günlük topluluk ayarlarını topluluk sahibi yönetir. Bu iki yetki alanı birbirinden ayrıdır.

İlk doğrulama, üç pilot operatörün kendi test topluluklarında kurulum, ilk otomasyon, kapatma ve güncelleme akışlarını tamamlamasıdır. Kullanıcı geri bildirimleri yeni modül sırasını belirler.

## 2. Kaynak tabanı ve repository kararı

| Alan | Başlangıç değeri |
| --- | --- |
| Resmî upstream | <https://github.com/fluxerapp/fluxer> |
| Alınan dal | `main` |
| Sabit başlangıç commit'i | `532e828fe697ad65caae475a4a8baa32c3a66b0e` |
| Commit tarihi | 2026-10-04T19:46:49+02:00 |
| Kaynağın alındığı tarih | 2026-10-05, Europe/Istanbul |
| Yerel geliştirme dalı | `netrcol/main` |
| Git remote | `upstream` |
| Repository düzeni | Fluxer kaynakları ile NetrcolFLXR ekleri aynı repository içinde |

Bu commit, indirme sırasında alınan güncel geliştirme tabanıdır; kararlı NetrcolFLXR sürümü anlamına gelmez. Upstream bileşen sürümleri ayrı yayımlanabilir; tek bir bileşenin `latest` etiketi bütün dağıtımın sürümü sayılmaz.

Makine tarafından okunabilir kayıt: [upstream.json](netrcol/upstream.json). Teknik başlangıç notları: [BOOTSTRAP.md](docs/netrcol/BOOTSTRAP.md).

Kaynak ilk indirmede sığ klonlanmıştır (`--depth 1`). Geçmiş veya merge tabanı gerekirse resmî upstream'den derinleştirilir. Kullanıcıya ait uzak repository henüz oluşturulmadı; yayınlama ve push yapılmadı.

## 3. İlk sürüm kapsamı

### Dahil

- NetrcolFLXR web istemcisi; masaüstü ve mobil tarayıcı düzenleri.
- Aynı Fluxer oturumunu kullanan, topluluk kapsamlı **Uygulama ayarları** ekranı.
- Karşılama ve otomatik rol.
- Seçilmiş topluluk olaylarının kayıtları.
- Mesaj yayımlandıktan sonra çalışan 14 kurallı AutoMod; modül ve kurallar başlangıçta kapalıdır.
- Yapılandırma sürümleme, işlem geçmişi, anlaşılır hata durumları.
- Tek paket olarak kurulum, doğrulanmış yedekleme ve belgelenmiş yükseltme.

### İlk sürüm dışında

- Özel native mobil uygulamalar, uygulama mağazası dağıtımı ve ayrı masaüstü istemci paketleri.
- Resmî Fluxer istemcilerinde yeni yönetim ekranlarının kendiliğinden görünmesi.
- Tickets, kayıt/doğrulama akışları, XP, oyunlar, müzik, starboard ve görsel otomasyon editörü.
- Üçüncü taraf kod çalıştıran plugin marketplace.
- Merkezi Netrcol hesabı, zorunlu telemetri, bulut veya lisans sunucusu bağımlılığı.
- Haricî platform desteği ve mevcut Netrcol botuyla tam özellik eşitliği.
- Mesaj yayımlanmadan engelleme, kapsamlı anti-raid/anti-nuke ve silinen kaynakları eksiksiz geri getirme garantisi.

Resmî istemcilerle temel sohbet uyumluluğu ayrıca test edilir; desteklenmiş kabul edilmez. Yeni mesaj/aktör gösteriminin eski istemcilerdeki davranışı bu testin parçasıdır.

## 4. Kullanıcı deneyimi

Topluluk menüsündeki **Uygulama ayarları** girişi, mevcut uygulama kabuğunda ve aynı oturumda topluluğa ait ekranı açar. Tarayıcı geri/ileri, doğrudan bağlantı, klavye erişimi ve mobil tarayıcı davranışları desteklenir.

Genel bakıştaki modül satırları Fluxer'ın ortak odak halkasını ve tema etkileşim renklerini kullanır. Kanal, kategori ve rol alanları ile seçenek türündeki örnek ayarlar mevcut `CompactComboboxRow` bileşeniyle gösterilir; önizleme alanları devre dışıdır. Mobil görünümde topluluk ayarlarının içerik genişliği, güvenli alt boşluğu, liste/ayrıntı başlıkları ve azaltılmış hareket tercihine uyan geçişler kullanılır. Modül listesinin kaydırma konumu ayrıntıdan dönüşte korunur.

```text
Uygulama ayarları
├── Genel bakış
├── Genel: liderlik tablosu, istatistikler, emoji, modül ayarları
├── Temel özellikler: karşılama ve uğurlama, tepki rolleri, seviyeler,
│   moderasyon, güvenlik, otomatik rol, yıldız panosu, AutoMod
├── Sunucu yönetimi: olay kayıtları, davet takibi, destek talepleri,
│   kayıt ve doğrulama, özel komutlar
├── Oyunlar ve eğlence: çekilişler, kelime oyunu, sayı sayma
├── Yardımcı araçlar: istatistik kanalları, RSS akışları, anketler,
│   geçici kanallar, doğum günleri
├── Sosyal bildirimler: YouTube, Twitch, Bluesky, Kick, X
└── İşlem Geçmişi
```

Sunucu kaynakları, servis sağlığı, instance ayarları, secret'lar, yedekler ve yükseltmeler yalnızca operatör alanındadır. Topluluk ekranı kendi modüllerinin durumunu ve topluluğa ait hataları gösterir.

İlk teknik denemede ayar değiştirme yalnızca topluluk sahibine açıktır. Genişletilmiş yetki delegasyonu, eylem bazlı izin tablosu tamamlandığında eklenir. `Manage Guild` tek başına rol dağıtma veya yaptırım tanımlama yetkisi değildir.

Her modül yükleniyor, boş, kapalı, etkin, kısıtlı ve hata durumlarını gösterir. Kaydedilmemiş değişiklikler, eksik kanal/rol referansları ve sürüm çakışmaları açıkça belirtilir. Önizleme gerçek eylem uygulamaz. Arayüz, Fluxer'ın mevcut bileşenlerini ve çeviri düzenini kullanır.

### İlk uygulanan arayüz kapsamı — 5 Ekim 2026

Başlık, sağ tık ve mobil topluluk menülerine dört kare simgeli **Uygulama ayarları** girişi eklendi. Menü, **Topluluk ayarları** satırının hemen altında bulunur. Statik `/channels/:guildId/application-settings` rotası mevcut oturum ve topluluk düzenini kullanır. Panel, Fluxer'ın topluluk ayarları penceresini kullanır: masaüstünde solda kaydırılabilir kategori menüsü, sağda seçilen modül vardır; topluluk ve kanal kenar çubukları arka planda korunur. Mobilde tam içerik alanında modül listesi ve ayrıntı ekranı arasında geçilir.

Self-hosted kurulum ve topluluk sahipliği hem menüde hem sayfada kontrol edilir. Sahiplik kaybolduğunda pencerenin yerini erişim açıklaması alır. Altı kategoride 31 modül ve genel bakış ekranı tasarım önizlemesi olarak sunulur. Olay kayıtları ve İşlem geçmişi işlevseldir. Kalan 29 modül **Henüz kullanılamıyor** durumundadır; bu modüllerin örnek etkinleştirme anahtarı ve ayar alanları devre dışıdır. Genel bakış, topluluk ayarlarındaki bölüm başlıkları ve ayırıcılarla gruplanmış sade modül satırlarını gösterir. Ayrı dashboard kartları, sayaçlar veya renkli bilgi kutusu kullanılmaz. Masaüstü başlığı/kapatma düğmesi `SettingsModalHeader`, topluluk adı `GuildSettingsModal` stilleri, içerik bölümleri ise `GuildOverviewTabSettingsSection` ile hazırlanır. Yan menü simgeleri topluluk ayarlarıyla aynı varsayılan ağırlığı kullanır. **İşlem geçmişi**, sabit alt alanda menünün kullanılabilir genişliğini dolduran düğmedir; mobil modül listesinde de alt düğme olarak bulunur. AI asistanı katalogdan çıkarılmıştır. Pencereyi kapatma, son seçilen erişilebilir kanala veya topluluk ana görünümüne gider. Seçim `?module=...` bağlantısıyla korunur; yenileme ve tarayıcı geri/ileri desteklenir. Modül adları, açıklamaları, örnek alanları ve erişim metinleri Fluxer'ın desteklediği 34 dilin tamamında çevrilmiştir; marka adları, sayısal örnekler ve şablon yer tutucuları korunur.

Çeviri verileri `netrcol/i18n/application-settings` altında tutulur. `node netrcol/scripts/application-settings-i18n.mjs` verileri Lingui kataloglarına uygular; `--check` tüm desteklenen dillerde kapsamı, yer tutucularını ve explicit ID eşleşmesini doğrular. İngilizce ABD kaynak metni kullanır, İngilizce Birleşik Krallık yazımı uyarlanır; Latin Amerika İspanyolcası ortak İspanyolca çevirilerini kullanır.

İlk gezinme adımı tamamlandı. Olay kayıtları ve İşlem geçmişi şimdi işlevsel; kalan 29 modülün alanları önizleme olarak devre dışı kalır. Yerel kaynak değişiklikleri `Start-Local.ps1 -Build` ile `netrcol/fluxer-app-proxy:local` ve `netrcol/fluxer-api:local` imajlarına derlenir. API ve worker aynı kaynak imajını kullanır; normal başlatma mevcut imajları kullanır.

Panel, ortak `ChannelRouteLayout` üzerinden gerçek kanal görünümünün üzerine açılır. Son seçilen erişilebilir kanalın başlığı, mesaj alanı ve üye listesi arka planda kalır; açma, modül değiştirme ve kapatma sırasında kanal bileşeni yeniden oluşturulmaz. Statik panel bağlantısı korunur. Doğrudan bağlantıda veya yenilemede son erişilebilir kanal kullanılır; silinmiş, başka topluluğa ait ya da erişimi kaybolmuş kanal arka planda gösterilmez.

## 5. Mimari ve entegrasyon sınırları

```text
Fluxer web istemcisi + Uygulama ayarları
                  │ mevcut oturum
Fluxer API + Netrcol yapılandırma/işlem geçmişi uçları
                  │
Kalıcı olay teslimi → Automation Worker
                          │ kimliği doğrulanmış, sınırlı eylemler
                 Fluxer alan servisleri
```

- Olay ve eylem adapter'ları Netrcol modüllerini upstream ayrıntılarından ayırır.
- Otomasyonlar çekirdek mesaj/üye/rol tablolarını doğrudan değiştirmez.
- Ayrı worker kullanılması tek başına izolasyon garantisi değildir: topluluk başına iş sınırı, kuyruk sınırı, zaman aşımı ve kaynak bütçesi gerekir.
- Mevcut Fluxer queue/worker altyapısı önce incelenir. İkinci bir mesajlaşma altyapısı gerekçe olmadan eklenmez.
- Uzun vadeli modül framework'ü ilk modülden önce tamamlanmaz; ortak altyapı pilot ihtiyaçlarıyla büyür.
- Önerilen iç olay adları (`member.joined` gibi) Netrcol sözleşmesidir; upstream'de hazır bulunduğu varsayılmaz.

## 6. Kimlik, yetki ve sistem aktörü

### İnsan erişimi

Her API okuması ve yazması sunucuda mevcut oturum, topluluk üyeliği ve ilgili yetkiyle denetlenir. Menü gizlemek güvenlik kontrolü değildir. Başka topluluğa ait kanal, rol, kural veya işlem kimliği reddedilir. İzin kaybı sonrası erişim kaldırılır; gizli kayıtlar salt okunur ekran üzerinden açık bırakılmaz.

### Sistem aktörü

Sistem aktörü kullanıcı olarak giriş yapamaz, normal üye listesinde bulunmaz ve bot tokenı gerektirmez. Worker'ın dahili API erişimi yine kimlik doğrulamalıdır; özel ağda bulunmak tek başına güven oluşturmaz.

Aktör yalnızca izin verilen eylemleri, belirli topluluk ve kaynaklar üzerinde çalıştırabilir. Mevcut sanal sistem hesabı (`0`), **Netrcol SYSTEM** adı ve Netrcol logosuyla gösterilir; gerçek bir kullanıcı adına mesaj üretilmez. API ve kullanıcı servisi aynı kimliği döndürür; web imajındaki logo sohbet, profil ve bildirimlerde kullanılır. Ayrıntılar [Sistem hesabı belgesindedir](docs/netrcol/SYSTEM_IDENTITY.md).

İlk denemede otomasyonlar mevcut topluluk sahibinin onayladığı politikaya bağlıdır. Sahiplik devrinde etkin kurallar yeni sahibin onayına kadar duraklatılır. İleride delege edilen kuralların yetkisi ve iptal davranışı ayrı tasarlanır; `updated_by` alanı yetki kaynağı sayılmaz.

### Karşılama/rol politikasının alt sınırı

- Yalnızca mevcut topluluğa ait, açıkça seçilmiş kaynaklar kullanılabilir.
- `@everyone`, yönetilen roller ve pilotta yönetim yetkisi taşıyan roller otomatik atanamaz.
- Hedef üyelik, seçilen rol ve kanal işlem anında yeniden doğrulanır.
- Yerleşik aktörün yetki sınırı ve rol hiyerarşisindeki karşılığı açıkça tanımlanmadan rol yazma yolu bağlanmaz.
- Karşılama mesajında toplu mention'lar varsayılan olarak kapalıdır.
- Bot katılımları varsayılan olarak kapsam dışıdır.
- Modül kapatılması ve instance genelindeki acil durdurma, yeni eylemleri engeller.

## 7. Olay teslimi ve eylem güvenilirliği

En az bir kez teslimat varsayılır. Olayın tekrar gelmesi, aynı işin iki worker tarafından alınması ve worker'ın eylem ortasında kapanması normal hata senaryolarıdır.

Olay zarfı en az `event_id`, `event_type`, `schema_version`, `guild_id`, `occurred_at`, `source`, `correlation_id`, `causation_id` ve payload taşır. Aynı kullanıcının ayrılıp yeniden katılması ayrı bir olaydır; yalnızca üye kimliğinden tekilleştirme anahtarı türetilmez.

Teslimatın başlangıcı, kalıcı alan değişikliğiyle uyumlu olmalıdır. Gateway yayını tek başına kalıcı kuyruk değildir. Transactional outbox veya aynı garantiyi sağlayan mevcut mekanizma Faz 0'da seçilir.

### Eylem yürütme

1. Olay, topluluk ve kural sürümü doğrulanır.
2. Eylem başına kalıcı kimlik/tekilleştirme anahtarı üretilir.
3. Eylem anında modül durumu, yetki ve kaynaklar yeniden kontrol edilir.
4. Sonuç eylem bazında kaydedilir; yalnızca başarısız/belirsiz adımlar ele alınır.
5. Eylem gerçekleşip sonuç kaydı yazılamadıysa körlemesine tekrar edilmez; alan servisindeki işlem kimliği veya uzlaştırma yoluyla sonuç belirlenir.

Rol verme ve mesaj gönderme tek atomik işlem varsayılmaz. Birinin başarılı olması diğerinin tekrarında başarılı adımı yeniden çalıştırmayı gerektirmez. Belirsiz sonuçlar operatöre gösterilir; uçtan uca garanti kanıtlanmadan “exactly once” iddiası kullanılmaz.

Yeniden denemeler sınırlı ve gecikmeli olur. Kalıcı hatalar başarısız iş kuyruğuna gider. Otomasyon kaynaklı olaylar kaynak/ebeveyn bilgisi ve zincir sınırı taşır; log mesajlarının tekrar log üretmesi engellenir.

Modül kapatılınca bekleyen işler iptal edilir. İşleme başlamış eylem tamamlanabilir; sonraki adım durumunu yeniden kontrol eder. Kural değişikliğinden sonra eski sürüme ait bekleyen eylemler atlanır. Bu yarış koşulları test edilir ve arayüzde açıklanır.

## 8. Veri ve işlem geçmişi

Başlangıç modeli:

| Kayıt | Ana alanlar |
| --- | --- |
| `guild_module_config` | guild, module, enabled, schema_version, revision, config, approved_by, updated_by, timestamps |
| `automation_run` | id, guild, module/rule, event_id, config_revision, policy_revision, status, decision_summary, timestamps |
| `automation_action` | id, run_id, action_key, idempotency_key, status, attempts, result_reference, error_code, timestamps |
| `automation_audit` | guild, human/system actor, module, run/action reference, safe change summary, reason, result, timestamp |

Kalıcı teslimat kaydı ayrıca seçilen altyapıya göre tasarlanır. Serbest biçimli görsel otomasyon kural modeli ilk pilotun zorunluluğu değildir.

Yapılandırma optimistic locking ile güncellenir. Export secret içermez; import şema ve kaynak eşleştirmesi doğrulandıktan sonra fark önizlemesiyle uygulanır. Başka instance'a taşınan kanal/rol kimlikleri otomatik olarak geçerli kabul edilmez.

Audit geçmişi ile kanal üzerinden gönderilen olay kayıtları ayrı amaçlara sahiptir. Mesaj gövdeleri varsayılan olarak kaydedilmez. Olay kayıtlarında topluluk sahibi metin kaydını açarsa özel kanalların metni de seçilen kayıt kanalına kopyalanır; görünürlük kayıt kanalının okuma izinlerine bağlıdır. Kaynak dosyalar arşivlenmez.

Pilot varsayılanı: başarılı/başarısız çalışma ayrıntıları 30 gün, yapılandırma ve yaptırım audit kayıtları 90 gün. Operatör sınırları belirler; topluluk bu sınırları aşamaz. Tekilleştirme kayıtlarının saklama süresi, kuyruk tekrar oynatma ve geri yükleme penceresinden kısa olamaz; süreler birlikte doğrulanır.

## 9. Pilot modüller

### Karşılama ve otomatik rol

Üye katılımında seçilmiş kanala önizlenebilir mesaj gönderir ve izin verilen rolü atar. İlk deneme, mevcut bir üyeye elle test gönderirken de aynı politikayı uygular. Rol veya kanal silinirse modül anlaşılır hata verir.

### Olay kayıtları

Olay kataloğu üyelik/profil, moderasyon, mesaj, tepki, kanal/kategori, kanal izinleri, roller, davetler, webhook/emoji/çıkartma, topluluk ve ses/görünen durum ailelerini kapsar. Fluxer'ın 35 denetim türü eşlenir. Kaynakta üreticisi olmayan toplu üye temizleme ve davet düzenleme etkinleştirilemez. Katalogda toplam 60 tür, 58 desteklenen seçim vardır.

Panelde 11 kategori yatay, altı çizili sekmelerle düzenlenir; yalnızca etkin kategorinin olay seçenekleri gösterilir. Arama kategoriler arasında çalışır; sekme değişiminde taslak seçimleri korunur. Dil seçimi panelden kaldırılmıştır; mevcut kayıt dili ayar şemasında korunur. Sekmeler mevcut Fluxer bileşeniyle hazırlanır, klavye gezinmesi ve mobilde yatay kaydırma desteklenir.

Modül self-hosted PostgreSQL kurulumunda topluluk sahibine açıktır. V2 ayarları varsayılan kanal, kategori kanalları, olay bazında etkinlik/kanal, 34 dil ve metin kaydı tercihini taşır. Kanal önceliği olay → kategori → varsayılandır; her etkin olay kendi topluluğundaki geçerli bir metin kanalına yönlenmelidir. Eski kanal, dil ve katılma/ayrılma seçimleri korunur; yeni türler kendiliğinden açılmaz. Kaydetme sürüm kontrolü kullanır; eşzamanlı değişiklikte 409 döner. Sahiplik devrinde yeni sahip ayarları tekrar kaydetmedikçe gönderim yapılmaz.

Yeni fiziksel tablo gerekmez: kayıtlar Fluxer'ın mevcut PostgreSQL KV katmanında saklanır. Denetim kayıtları, üyelik ve mesaj yazımları kendi outbox kayıtlarıyla aynı PostgreSQL işleminde commit olur. Mesaj silme işlem kaynağından, sabitleme denetim kaynağından üretilir; sonradan birleştirilen silme denetimleri yeniden teslimat oluşturmaz. Ses/presence geçişleri kimlik doğrulamalı dahili RPC üzerinden gelir; başlangıç, yeniden bağlantı ve değişmemiş durumlar olay sayılmaz. API'ye ulaşmadan kaybolan geçici gateway olayları için geri kurma garantisi yoktur. Commit sonrası JetStream bildirimi worker'ı hemen uyandırır; aynı anda oluşan bildirimler en fazla 200 olay kimliği taşıyan işlerde birleştirilir ve yeni kayıtlar kimlikleriyle doğrudan alınır. Bildirim hatası kaynak işlemi bozmaz; 5 saniyede en fazla 200 kaydı tarayan kurtarma imleci kesinti/eksik bildirim/yeniden denemeler için korunur. Her iki yol 60 saniyelik lease ve en fazla altı deneme kullanır. Kaynak kimliği tekrarları tekilleştirir; sabit mesaj kimliği kesinti sonrası uzlaştırılır. Gateway bildirimi yeniden yayınlanabilir; mutlak exactly-once garantisi verilmez.

Mesaj yazarı mevcut sistem aktörüdür (`0`); kayıt/test mesajları tekrar kayıt üretmez, mention bildirimleri oluşturmaz. Bot işlemleri ve özel kanallar kapsamdadır. Olay, zaman, bilinen aktör, hedef, kaynak kanal, gerekçe ve değişiklikler gösterilir; bilinmeyen aktör tahmin edilmez. Metin kaydı kapalıdır; açılırsa düzenleme öncesi/sonrası ve silinen içerik eklenir. Uzun metin/toplu silme dökümleri UTF-8 eki olur; kaynak dosyalardan yalnızca ad/tür/boyut tutulur. Kanal silinince başka kanal kendiliğinden seçilmez. `NETRCOL_AUTOMATIONS_ENABLED=false` API, worker ve gateway'e uygulanır.

İşlem geçmişi son 50 kaydı gösterir. Ayar değişiklikleri 90 gün, teslimat sonuçları 30 gün, kuyruk kayıtları 7 gün saklanır; bu süreler kanala gönderilmiş mesajları otomatik silmez. Taslak önizleme gönderim yapmaz. Test gönderimi seçilen, kaydedilmiş ve etkin olayın gerçek kanal yönlendirmesini kullanır. Panel, olay/alan adları ve kayıt mesajları 34 dilde yerelleştirilir. Yeni kanal kayıtları yerleşik rich embed biçimindedir: kişi/kanal adları, olay rengi, ilgili değişiklik alanları, önce/sonra metni ve olay zamanı kullanılır; tekrarlanan kimlikler ve boş varsayılan satırlar kaldırılır. Uzun içerik UTF-8 ekte korunur. Önceden gönderilmiş mesajlar değiştirilmez. Ayrıntılar [EVENT_LOGS.md](docs/netrcol/EVENT_LOGS.md) belgesindedir. Karşılama ve otomatik rol henüz önizlemedir.

### AutoMod

14 kuralın işlev doğrulaması tamamlandı: 127 algılama/yapılandırma/kuyruk, 50 gerçek işlem, 7 wake-up, 71 webhook/OAuth ve 80 panel testi; toplam 335 test geçti. Anti Nuke karantinasının webhook değiştirme/silme ve OAuth bot ekleme yollarından atlatılması kapatıldı. Etiket sayımında aynı kullanıcının iki mention biçimi birleştirildi. Canlıda bulunan Anti Raid katılım yarışında yerleşik katılım bildiriminin yanlış engellenmesi düzeltildi; sistem bildirimleri kullanıcı mesajı filtrelerine/sayaçlarına girmez, gerçek yanıtlar denetlenir. Masaüstü/mobil 14 ekran ve 34 dil kontrolleri doğrulandı. Ortam, kapsam sınırları ve senaryo sonuçları [işlev testi raporunda](docs/netrcol/AUTOMOD_TEST_REPORT.md) kayıtlıdır.

Yeni API/worker imajıyla gerçek yerel HTTP, PostgreSQL, JetStream, WebSocket gateway ve dosya yükleme zincirinde ayrıca 16 senaryo geçti: başlangıç, 14 kural ve 20 mesajlık eşzamanlı deneme. Tekil kural bildirimleri 41–133 ms içinde geldi; 20 silme ve 20 Netrcol bildirimi birer kez teslim edildi, silme gecikmesi p95 129 ms idi. Gateway kesintisi veya topluluğun kullanılamaz olması görülmedi. Bu deneme maksimum kapasite garantisi değildir. Test topluluğu silindi, geçici test hesaplarının silme süreci başlatıldı; Fluxcol ve mevcut hesap/volume'lar korundu. Tekrar çalıştırılabilir yerel test betiği `netrcol/scripts/verify-automod-live.mjs` eklendi.

Anti Raid ve Anti Nuke artık ortak Fluxer başlığı, Vazgeç/Kaydet ve kapat ve daraltılabilir Ek ayarlar ile ayrı sayfalardır; referanstaki gibi bu sayfalarda izin bölümü gösterilmez, kayıtlı ortak/özel kapsam korunur. Anti Raid katılım sınırı (1–1000), süre (1–300 saniye) ve yeni hesap yaşı (0–365 gün) sunar. 0 bütün hesapları sayar; pozitif değer katılım anında bu günden genç hesapları sayar. Yeni ayarlarda 7 gün gelir; eski kayıtlarda alan yoksa 0 kullanılarak mevcut sayım korunur. Anti Nuke aynı üyenin yönetim işlemlerini işlem sınırı/süre ile sayar; yalnızca kayıt açıkken geçmişe yazar ve üyeyi kısıtlamaz. Kapalıyken ana AutoMod sayfasının seçili işlemi uygulanır; devre dışı kural kendiliğinden açılmaz. Yeni ayarlarda yalnızca kayıt açık, eski kayıtlarda mevcut işlem korunacak şekilde kapalıdır. Kayıtlı eşik/süreler, 10/60 Raid ve 5/60 Nuke varsayılanları korunur; görseldeki 3/30 Nuke değeri girilebilir. Kurallar Güvenlik modülünden bağımsızdır; AutoMod ve kural etkinleştirilip kaydedilmelidir. Form ve açıklamalar 34 dilde desteklenir; yaş filtresi mevcut kalıcı sayaca eklenen kullanıcı kimliğiyle çalışır, yeni tablo veya uç yoktur.

Medya spamının ayrı ayar ekranı ortak veya kurala özel kullanıcı/rol/kanal/kategori kapsamı, medya sınırı (1–100) ve süre (5–600 saniye) kaydırıcılarını kullanır. Önceden kaydedilmiş 100 üstü sınırlar ve 5 saniyeden kısa süreler değiştirilmeden okunur; mevcut 5 öğe/10 saniye varsayılanı korunur. Aynı üyenin kapsamdaki kanallara gönderdiği dosya ekleri ve çıkartmalar birlikte sayılır; toplam sınıra ulaştığında seçili işlem tetiklenir. Düzenlemeler, düz bağlantılar ve emojiler sayılmaz. Spam korumasıyla aynı native Fluxer formu, taslak/sürüm koruması, odak dönüşü, klavye/mobil davranışı ve 34 dil desteği kullanılır. API medya spamında 600 saniyeyi kabul eder; mevcut kalıcı sayaç bu pencereyi kapsar. Yeni tablo veya uç yoktur; diğer kuralların sınırları ve kayıtlı ayarları korunur.

Spam korumasının ayrı ayar ekranı ortak veya kurala özel dört izin kapsamı ile mesaj sınırı ve süre kaydırıcılarını sunar. Mesaj kaydırıcısı 1–100, süre 1–600 saniyedir; önceki 100 üstü mesaj sınırları değiştirilmeden daha geniş aralıkla okunur. Varsayılan 5 mesaj/10 saniye korunur. Aynı üyenin kapsam içindeki kanallara gönderdiği yeni mesajlar birlikte sayılır; eşik karşılanınca seçili işlem uygulanır, düzenlemeler yeni gönderim sayılmaz. Sayaç saklama penceresi 600 saniyelik ayarı kapsar; medya spamı da 600 saniyeyi destekler, kalan kuralların 300 saniyelik üst sınırı korunur. Yeni API veya veritabanı tablosu yoktur. Yerel web ve API/worker kaynak imajları güncellenir; hesaplar ve volume'lar korunur. Ekran, taslak/sürüm koruması, odak dönüşü ve klavye/mobil davranışlarıyla 34 dilde desteklenir.

Karakter sınırı kuralının ayrı ayar ekranında ortak veya kurala özel kullanıcı/rol/kanal/kategori kapsamı ve En fazla karakter alanı (1–10000 tam sayı) bulunur. Mevcut değerler ve varsayılan 2000 korunur; görseldeki 500 değeri seçilebilir. Unicode kod noktaları, boşluklar ve satır sonları dahil mesaj metni sayılır; sınırla eşit uzunluk korunur, sınırı aşan oluşturma/düzenleme seçili işlemi tetikler. Birleşik emoji veya aksan dizileri birden fazla karakter sayılabilir. Mevcut denetim, API ve şema kullanılır. Native Fluxer formu, taslak/çakışma koruması, odak dönüşü, klavye/mobil kullanım ve 34 dil desteği ortaktır.

Zalgo kuralının ayrı ayar ekranı görseldeki gibi yalnızca ortak veya kurala özel kullanıcı/rol/kanal/kategori izinlerini içerir. Kaydet ve kapat, Vazgeç, taslak/çakışma koruması, odak dönüşü, klavye/mobil kullanım ve 34 dil desteği diğer kurallarla ortaktır. Kayıtlı Zalgo hassasiyeti korunur; yeni ayarlarda art arda üçten fazla Unicode birleştirme işareti kuralı tetikler. Yeni API veya veri şeması gerekmez.

Aşırı spoiler kuralının ayrı ayar ekranında ortak veya kurala özel dört izin grubu ve spoiler etiketi sınırı (1–10000 tam sayı) bulunur. Kayıtlı değerler ve varsayılan 5 sınırı korunur. Mesaj metnindeki tamamlanmış `||…||` bölümleri sayılır; çok satırlı bir bölüm tek sayılır. 5 sınırında 5 bölüm serbest, 6 bölüm seçili işlemi tetikler. Native Fluxer bileşenleri, taslak/çakışma koruması, klavye/mobil kullanım ve 34 dil desteği kullanılır.

Aşırı etiketleme kuralının ayrı ayar ekranında aynı dört izin grubu ve etiketleme sınırı (1–10000 tam sayı) bulunur. Kayıtlı değerler ve varsayılan 5 sınırı korunur. Farklı kullanıcı/rol etiketleri ile `@everyone` ve `@here` sayılır; aynı etiketin tekrarı tek sayılır. 5 sınırında 5 farklı etiket serbest, 6 farklı etiket seçili işlemi tetikler. Mesaj oluşturma ve düzenleme aynı kontrolü kullanır. Native Fluxer bileşenleri, taslak/çakışma koruması, klavye/mobil kullanım ve 34 dil desteği ortaktır.

Aşırı emoji kuralının ayrı ayar ekranında ortak veya kurala özel dört izin grubu ve emoji sınırı (1–10000 tam sayı) bulunur. Kayıtlı değerler ve yeni ayarların varsayılan 10 sınırı korunur. Unicode ve özel emojiler sayılır; birleşik diziler tek sayılır. 12 sınırında 12 emoji serbest, 13 emoji seçili işlemi tetikler. Native Fluxer bileşenleri, taslak/çakışma koruması, klavye/mobil kullanım ve 34 dil desteği kullanılır.

Aşırı büyük harf kuralının ayrı ayar ekranında ortak veya kurala özel dört izin grubu, minimum karakter sayısı (1–10000) ve en yüksek büyük harf oranı (1–100%) bulunur. Mevcut değerler korunur; yalnızca büyük/küçük harf biçimleri olan harfler sayılır ve yüzde sınırı aşıldığında kural tetiklenir. Native Fluxer form bileşenleri, taslak/çakışma koruması, odak dönüşü ve 34 dil desteği kullanılır.

Dış bağlantıların ayrı ayar ekranı Sunucu davetleri ile ortak URL izin listesini kullanır; dört kapsam seçimi her kurala özel kaydedilebilir. Eski dış bağlantı alan adı istisnaları korunur. Her iki ekranda aynı liste, taslak koruması, sürüm kontrolü, Vazgeç/Kaydet ve kapat, klavye/mobil kullanım ve 34 dil desteği bulunur.

Sunucu davetlerinin ayrı ayar ekranı ortak veya kurala özel dört izin grubunu kullanır. Davet ve dış bağlantı filtreleri için ortak URL öneki izin listesi vardır: 100 öğe, HTTP(S), 2048 karakter; protokol, yol ve harf büyüklüğü dikkate alınır. Eski kurala özel alan adı istisnaları korunur; eksik yeni alan boş liste okunur. Enter/virgül, tek tek silme, sayaç, taslak koruması, Vazgeç ve Kaydet ve kapat ile 34 dil desteği bulunur. İzinli bağlantılar diğer kuralları veya aynı mesajdaki başka bağlantıları muaf tutmaz.

14 kural: yasaklı kelime, tekrarlanan metin, davet, dış bağlantı, büyük harf, emoji, spoiler, etiketleme, Zalgo, spam, karakter sınırı, medya spamı, Anti Raid ve Anti Nuke. Sahip her kuralın işlemini ve eşiğini, ortak süreyi, kullanıcı/rol/kanal/kategori kapsamını ve bot politikasını yapılandırır. Yasaklı kelimenin ayrı ekranında tam/kısmi kelime listeleri bulunur. Tekrarlanan metnin ayrı ekranında tekrar sayısı ve süre penceresi düzenlenir; mevcut değerleri korunur. Her iki ekran ortak veya kurala özel izinler, Vazgeç ve Kaydet ve kapat sunar. Kullanıcı için açık seçim rol sonucundan önceliklidir; eski listeler ve istisnalar korunur. Başlangıçta modül/kurallar kapalıdır. Mesaj kuralları yalnızca kaydetme, uyarı, silme ve zaman aşımı sunar. Anti Raid/Nuke süreli kilitleme sunar; tamamlanan işlemleri geri almaz. Otomatik ban yoktur.

Mesaj oluşturulduktan/düzenlendikten sonra değerlendirme yapılır; silinene kadar içerik görülebilir. Worker kesintisinde sohbet devam eder; beş dakikadan eski yaptırımlar atlanır. Atomic outbox, süreçler arası sayaç, kaynak tekilleştirme, sınırlı yeniden deneme, uyarı uzlaştırması, sahiplik/sürüm ve operatör durdurma kontrolleri uygulanır. Önizleme yaptırım uygulamaz. Panel ve uyarılar 34 dilde yerelleştirilir. Ayrıntılar [AUTOMOD.md](docs/netrcol/AUTOMOD.md) belgesindedir.

## 10. Kurulum ve geliştirme ortamı

Dağıtım hedefi Linux üzerinde Docker Compose'dur. Domain/DNS, HTTPS, portlar, kalıcı depolama ve başlangıç secret'ları ön kontrol/sihirbazla hazırlanır; `docker compose up -d` ancak bu hazırlıktan sonra çalıştırma adımıdır.

İlk yönetici kaydı, kurulum sahibine ait tek kullanımlık bootstrap yetkisiyle korunur; internete açık ilk gelenin yönetici olduğu akış kullanılmaz. Kurulum tamamlanınca bootstrap kapanır.

Geliştirmede upstream `.devcontainer` önceliklidir. Güncel dosya Node 26, pnpm 11.27.0, Erlang 28.5.0.6 ve Rust tabanlı araçları kullanıyor. Bunlar üretim minimum donanım vaadi değildir.

Windows makinede kaynak düzenleme mümkündür. Platformu çalıştırmak için Linux container ortamı gerekir. Mevcut makinenin gerçek durumu başlangıç notlarında ve ön kontrol çıktısında tutulur. Docker/WSL kurulmadan platformun çalıştığı iddia edilmez.

## 11. Güncelleme, yedek ve geri dönüş

- Her NetrcolFLXR sürümü upstream SHA, Netrcol sürümü, imaj digest'leri ve şema sürümlerini kaydeder.
- Kararlı dağıtım hareketli `latest` etiketlerine bağlanmaz.
- Veritabanı, uygulama verileri/medya, secret'lar ve kuyruk durumu için tutarlı yedek stratejisi belirlenir.
- Yedek varlığı yeterli değildir; geri yükleme ayrı bir instance'ta sınanır.
- Geriye uyumlu şemada önceki uygulama imajına dönüş mümkündür.
- Uyumsuz şemada geri dönüş doğrulanmış yedekten yapılır; kesinti ve yedek sonrasındaki veri etkisi açıklanır. Otomatik, koşulsuz rollback sözü verilmez.
- Geri yüklemede worker duraklatılır; eski işlerin güncel veri üzerinde yeniden eylem üretmesi uzlaştırma/tekilleştirme ile denetlenir.

## 12. Upstream bakım politikası

Netrcol değişiklikleri sınırlı dosyalardaki UI, olay ve eylem bağlantılarıyla tutulur. Kapsamlı upstream refactor'larıyla aynı değişiklikte ürün modülü geliştirilmez. Upstream README ve lisans bilgileri korunur.

Normal senkronizasyon için haftalık inceleme hedeflenir. Güvenlik duyuruları öncelikli değerlendirilir; kullanıcıya garanti edilen yama süresi kararlı sürümden önce bakım kapasitesine göre yazılır. Otomatik merge/yayın yapılmaz.

Faz 0'da ilk prototip bir sonraki uygun upstream commit'e taşınarak çatışma ve yeniden doğrulama maliyeti kaydedilir. Event, action, migration, temel sohbet ve istemci uyumluluğu kontrolleri sürüm kapılarıdır.

## 13. Aşamalar ve çıkış ölçütleri

### Faz 0 — Teknik keşif ve ilk uçtan uca deneme

- [x] Güncel upstream kaynağını indir ve başlangıç SHA'sını kaydet.
- [x] Güncellenmiş ürün/teknik planı repository'ye ekle.
- [x] UI menüsü/route, üyelik olayı, rol eylemi, mesaj yazarı, audit ve queue noktalarını kaynak kod üzerinden haritala.
- [x] Windows için WSL/Docker kur; localhost başlatıcısı, kalıcı yerel yapılandırma ve Compose katmanını hazırla. Yeniden başlatma tamamlandı ve Docker Linux motoru doğrulandı.
- [x] Hazır upstream imajlarını Docker Linux motorunda başlat; HTTP, giriş JS/CSS dosyaları ve tarayıcıda ilk kurulum ekranını doğrula.
- [x] Uygulama ayarları menüsünü, owner-only statik rotayı ve üç bilgilendirme kartını ekle; yerel kaynak imajı için `-Build` seçeneğini hazırla.
- [x] Paneli topluluk ayarları görünümüne taşı; altı kategori, 31 modül, genel bakış ve devre dışı örnek ayar alanlarıyla modül menüsünü genişlet.
- [x] AI asistanını kaldır; İşlem geçmişini tam genişlikli alt düğmeye taşı ve modül metinlerini 34 dilde yerelleştir.
- [x] Linux container içinde web/app-proxy kaynak derlemesini, mevcut KDGL/Fluxcol oturumunu ve Uygulama ayarları gezinmesini doğrula; tip/çeviri ve panel testlerini çalıştır.
- [x] İlk çalışan Olay kayıtları modülünü, PostgreSQL üyelik outbox'ını, sürümlü ayar kaydını, sistem aktörüyle test mesajını ve İşlem geçmişini uygula; yetki, kesinti, kanal ve dil kontrollerini doğrula.
- [x] Olay kayıtlarını v2'ye genişlet: 35 denetim türü, 60 olay seçeneği, 11 kategori, gerçek işlem kaynakları, gateway RPC, kanal öncelikleri, isteğe bağlı metin kaydı ve 34 dil.
- [ ] Gerçek mesajlaşma ve ses akışlarını ayrıca doğrula.
- [ ] Sistem aktörü ve kalıcı eylem tekilleştirmesi kararlarını küçük prototiple sınayarak yaz.
- [ ] Aynı oturumda karşılama ayarını kaydet; gerçek katılımda rol/mesaj/audit üret.
- [x] Olay kayıtları için worker kesintisi, tekrar teslimat, yetki kaybı, sahiplik devri ve modül kapatma senaryolarını doğrula. Diğer modüller kendi eylem testlerini ekleyecek.
- [ ] Prototipi sonraki uygun upstream commit üzerinde tekrar doğrula.

**Çıkış:** Kullanıcı bot oluşturmadan çalışan tek akış ve bakım maliyetine ilişkin ölçülmüş kanıt. Sadece şema, menü veya mock çıktı bu kapıyı geçirmez.

### Faz 1 — Özel alpha

Üç pilot modül, sınırlı ortak altyapı, işlem geçmişi ve operatör durdurma kontrolü. Kurulum, yedekleme ve yeniden başlatma pilot ortamlarda doğrulanır. Framework kapsamı pilotların ihtiyaçlarıyla sınırlıdır.

### Faz 2 — Public beta

Aynı üç modül korunur. Kurulum sihirbazı, anlaşılır dokümantasyon, sürüm uyumluluğu, yükseltme ve geri dönüş sağlamlaştırılır. Yeni operatörün yardım almadan kurup ilk otomasyonu çalıştırması ve güncellemesi çıkış koşuludur. Tickets veya seviye sistemi beta önkoşulu değildir.

### Faz 3 — İlk kararlı dağıtım

Desteklenen platform/kaynak aralığı, migration testleri, izin incelemesi, lisans/marka kontrolleri, güvenlik yamaları ve destek politikası tamamlanır.

### Sonraki sürümler

Tickets, zamanlanmış işlemler, reaction roles, kayıt/doğrulama, geçici kanallar, starboard ve katılım özellikleri pilot talebiyle sıralanır. Haricî URL/webhook eylemleri eklenirken ağ çıkış politikası, hedef doğrulama ve secret yönetimi birlikte ele alınır. Görsel editör, gerçek kullanım örüntüleri olgunlaşınca değerlendirilir.

## 14. MVP kabul ölçütleri

- Tek dağıtım ve aynı kullanıcı oturumuyla topluluk araçlarına erişim.
- Bot hesabı, bot tokenı ve haricî dashboard gerektirmeyen üç pilot modül.
- Topluluk izolasyonu; seçilen kanal/rol ve işlem anındaki yetki kontrolleri.
- Sistem mesajlarının web istemcisinde doğru yazarı/gösterimi; diğer istemcilerin destek durumu belgeli.
- Her ayar değişikliği ve otomatik eylemin izlenebilir sonucu.
- Tekrarlanan teslimat, eşzamanlı worker ve eylem sonrası çökme testlerinde çift yan etki oluşmaması; belirsiz sonuç için uzlaştırma.
- Worker durunca sohbetin devam etmesi; otomasyon arızasının görünmesi.
- Kuyruk/medya/veritabanı tutarlılığı gözetilen yedekleme ve geri yükleme denemesi.
- Doğrulanmış yükseltme yolu ve koşulları belirtilmiş geri dönüş.
- Upstream sürümü, kaynak kod ve lisans bilgilerinin kullanıcıya açık olması.

Ölçümler: kurulum süresi, ilk modüle ulaşma süresi, hata oranı, olay gecikmesi, kuyruk yaşı, yinelenen yan etki sayısı ve audit eksikliği. Performans eşikleri seçilen test makinesi ve yük profiliyle birlikte Faz 0 sonunda belirlenir. Merkezi telemetri zorunlu değildir; pilot ölçümleri yerel tanılama ve gönüllü geri bildirimle toplanır.

## 15. İlk akış ve test senaryoları

```text
Topluluk sahibi → Uygulama ayarları → Olay kayıtları
  → Olaylar, kanal yönlendirmeleri, dil ve metin kaydı seç → Önizle → Kaydet
  → Gerçek topluluk işlemi / gateway geçişi → Kalıcı outbox → Worker
  → Sahiplik/sürüm/kanal kontrolü → Sistem mesajı ve gerekiyorsa UTF-8 eki
  → Eylem sonuçları ve audit → Aynı uygulamada işlem geçmişi
```

Zorunlu hata denemeleri: aynı olayın iki teslimi; aynı üyenin yeniden katılması; başka topluluğa ait rol; silinmiş kanal; bot katılımı; rol başarılıyken mesaj hatası; mesajdan hemen sonra worker çökmesi; kapatılmış modüle ait kuyruk işi; eski ayar sürümü; sahiplik devri; geri yüklenmiş kuyruk işi.

## 16. Açık teknik kararlar

1. Sistem mesajı yazarı/audit aktörünün upstream veri modeli ve resmî istemcilerle temsili.
2. Kalıcı üyelik olayı üretimi, teslim mekanizması ve eylem sonrası çökme aralığının kapatılması.
3. Sistem aktörünün kaynak sınırları, rol hiyerarşisi ve izin delegasyonu.
4. Mevcut worker altyapısının ayrı kuyruk/iş yükü sınırları için yeterliliği.
5. İlk desteklenen Linux/CPU mimarisi, donanım ve yük profili.
6. Netrcol botundan yeniden kullanılabilecek modüllerin gerçek kaynak/lisans envanteri. Mevcut bot koduna erişim veya yeniden kullanım henüz doğrulanmış değildir.
7. Kamuya açık ad ve görsel kimlik; bağımsız dağıtım ilişkisinin nasıl anlatılacağı.

Bu kararların kaynak incelemesi ve deney sonuçları [teknik başlangıç notlarında](docs/netrcol/BOOTSTRAP.md) tutulur.

## 17. Lisans ve marka

Upstream kaynak lisansı `AGPL-3.0-or-later` olarak korunur. Değiştirilmiş sürümün karşılık gelen kaynaklarına erişim, dağıtımın parçası olarak hazırlanır. Üçüncü taraf bileşenler ve sanat varlıkları kendi lisanslarıyla izlenir.

`NetrcolFLXR` çalışma adıdır. İlk kamuya açık yayından önce Fluxer'ın ad/marka politikası ve kullanılan varlıklar incelenir; ürün resmî Fluxer sürümü olarak sunulmaz. Bu kontrol geliştirmeye başlamanın değil, kamuya açık dağıtımın çıkış koşuludur.
