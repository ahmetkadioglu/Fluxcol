# Olay kayıtları — sürüm 2

Self-hosted PostgreSQL kurulumlarında topluluk sahibine açıktır. Yerel kurulum bu backend'i kullanır. Cassandra'da modül kapalıdır. AutoMod, ortak modül ayarları ve işlem geçmişi de işlevseldir; kalan modüller tasarım önizlemesidir.

## Kullanım

**Fluxcol → Uygulama ayarları → Olay kayıtları** ekranında modülü ve varsayılan metin kanalını seçin. Kayıt dili, **Uygulama ayarları → Modül ayarları → Netrcol mesaj dili** alanından değiştirilir ve AutoMod bildirimleriyle ortaktır. Mevcut kayıt dili yükseltmede korunur; kişisel arayüz dili değişmez. Sol menüde tek modül bulunur; 11 olay kategorisi içerik alanında yatay, altı çizili sekmelerle seçilir. Yalnızca etkin sekmenin seçenekleri gösterilir ve sekme değiştirmek taslak seçimlerini değiştirmez. Dar ekranlarda sekme çubuğu yatay kaydırılır.

Arama bütün kategorilerde çalışır; eşleşen kategoriler sekmelerde kalır ve etkin sekmede sonuç yoksa ilk eşleşen kategori gösterilir. Arama temizlenince bütün sekmeler geri gelir. Kısmi kategori seçimi, bütün desteklenen olayları kapsayan **Tümünü seç** ve **Seçimi temizle** kullanılabilir. Sekmelerde Sol/Sağ ok, Home ve End gezinmesi; Tab/Shift+Tab ile içerik alanına geçiş desteklenir.

Her olay ayrı seçilir. Kanal önceliği **olay → kategori → varsayılan kanal**dır. Boş özel seçim üstteki seçimi kullanır. Kaydetme, etkin olayların aynı toplulukta bulunan, silinmemiş metin kanallarına yönlenmesini zorunlu kılar. Silinen hedef için başka kanal kendiliğinden seçilmez.

**Mesaj metnini kaydet** başlangıçta kapalıdır. Açılırsa oluşturulan/silinen mesajın metni ve düzenlemede önceki/sonraki metin tutulur. Özel kanal metni de kayıt kanalına kopyalanır; o kanalı okuyabilen herkes metni görebilir. Kaynak dosyalar arşivlenmez; yalnızca ad, tür ve boyut gösterilir. Uzun içerik ve toplu silme dökümleri `event-log.txt` UTF-8 eki olur. Metin kaydı kapalı toplu silmede döküm yalnızca kimlikler ve dosya bilgilerini taşır.

**Önizleme** taslağı gösterir ve gönderim yapmaz. **Test mesajı gönder**, seçilen kaydedilmiş etkin olayın gerçek hedef kanalına test olarak işaretli sistem mesajı yollar. Taslak varken test kapalıdır. Sürüm çakışırsa taslak korunur; **Yenile** yeniden yükler. Tab/Shift+Tab, Space/Enter, Escape, odak geri dönüşü ve kaydedilmemiş değişiklik koruması mevcut Fluxer ayar ekranını kullanır.

## Katalog

| Kategori | Olaylar |
| --- | --- |
| Üyelik/profil | Katılma, ayrılma, bot ekleme; takma ad/topluluk profili ve herkese görünen kullanıcı profili |
| Moderasyon | Atma, ban/unban, zaman aşımı, sunucu susturma/sağırlaştırma, moderatörün ses taşıması/bağlantı kesmesi |
| Mesajlar | Oluşturma, düzenleme, silme, toplu silme, sabitleme/kaldırma, duyuru yayımlama |
| Tepkiler | Ekleme, kaldırma, bir emojiyi ve bütün tepkileri temizleme |
| Kanal/kategori | Oluşturma, güncelleme, silme; özellik/sıralama değişiklikleri |
| Kanal izinleri | Rol/kullanıcı geçersiz kılmalarını oluşturma, güncelleme, kaldırma |
| Roller | Oluşturma, güncelleme, silme; izin/sıralama ve üye rol değişiklikleri |
| Davetler | Oluşturma, silme, davetle katılma |
| Webhook/ifadeler | Webhook, emoji, çıkartma oluşturma/güncelleme/silme |
| Topluluk | Ayarlar, görünür özellikler, özel davet adresi ve sahiplik |
| Ses/görünen durum | Giriş/çıkış/kanal değiştirme; kişisel susturma/sağırlaştırma, kamera, paylaşım, bastırılma, giriş sesi, görünür çevrimiçi/özel durum |

60 türün 58'i desteklenir. Fluxer'ın 35 denetim türü eksiksiz eşlenir. **Toplu üye temizleme** ve **davet düzenleme** kaynakta üretici bulunmadığından kapalıdır. Yeni denetim türü eşlenmeden katalog testi geçmez. Yükseltmede yeni türler kendiliğinden etkinleşmez. İlk kurulumda yalnızca katılma/ayrılma seçilidir ve modül kapalıdır.

Bot işlemleri ve özel kanallar kapsamdadır. DM'ler, hesap sırları, operatör servis kayıtları kapsam dışıdır. Kanal/kategori istisnaları henüz eklenmedi. Görünmez kullanıcı Fluxer'ın sunduğu gibi çevrimdışı görünür.

## Teslimat ve saklama

Yeni kayıtlar Fluxer'ın yerleşik **rich embed** mesajları olarak gönderilir. Olay başlığı ve renk, ilgili kişi/hedef adı, tek kaynak kanal bağlantısı ve alt bölümde olay zamanı kullanılır. Oluşturma yeşil, silme/ayrılma ve yaptırımlar kırmızı, değişiklikler sarı, görünen durum değişiklikleri gri, test mesajları mor renktedir. Mesaj olaylarının başlığı, kaynak mesaj hâlâ var olabilecekse o mesaja bağlanır; silinmiş mesaj veya kanal için yeni bir bağlantı üretilmez.

Embed başlığındaki aynı kuruluma ait kanal ve mesaj bağlantıları normal tıklama veya Enter ile mevcut sekmede açılır. Bilinen kaynak mesaja Fluxer'ın yerleşik kaydırma/vurgulama akışıyla gidilir; kanal erişim onayı korunur. Ctrl/Cmd+tıklama ve orta tuş tarayıcının yeni sekme davranışını kullanır. Başka kurulumların ve dış sitelerin bağlantıları dış bağlantı olarak kalır; güvenilmeyen alan adı uyarısı korunur.

Kişi adında topluluk takma adı, ardından görünen ad ve kullanıcı adı kullanılır. Silinen rol/kanal/ifade için mevcut denetim anlık görüntüsündeki ad kullanılabilir. Ad veya aktör çözülemezse **Bilinmiyor** gösterilir; kimlik yalnızca bulunamayan hedefin ayırt edilmesi için kalır. Aynı kişi iki kere yazılmaz. Tek mesaj için adet, tekrarlanan kanal/yazar/hedef kimlikleri, boş metin değişikliği ve oluşturma/silme anlık görüntüsünün gereksiz varsayılan satırları gösterilmez.

Metin kaydı açıksa mesaj metni **Mesaj**, düzenlemede **Önce / Sonra** alanlarında gösterilir. İzin bitleri okunabilir izin adlarına ve eklenen/kaldırılan izinlere dönüştürülür. Rol ve kanal referansları da adlarıyla gösterilir. Dosyalarda ad, tür ve okunabilir boyut kalır; dosya içeriği yeniden yüklenmez. Kullanıcı metninin Markdown/mention karakterleri etkisizleştirilir. Embed başlığı/alanları ve toplam UTF-16 uzunluğu yerel mesaj sınırlarını aşmaz; uzun içerik ve toplu silme dökümünün tamamı UTF-8 `event-log.txt` ekinde korunur.

Bu sunum değişikliği ayar şemasını, kayıt seçimlerini veya metin kaydı tercihini değiştirmez. Daha önce kanala gönderilmiş düz metin kayıtları ve mevcut teslimat kimlikleri korunur; kesinti sonrası uzlaştırma aynı mesajı ikinci kez oluşturmaz.

- Denetim kaydı ile outbox; üyelik ve mesaj yazımları ile kendi outbox kayıtları aynı PostgreSQL işlemindedir. Mesaj silme işlem kaynağından, sabitleme denetim kaynağından gelir. Sonradan birleştirilen silme denetimleri ikinci teslimat oluşturmaz.
- Ses/presence gateway'den mevcut `x-fluxer-rpc-auth` doğrulamalı `/internal/rpc` üzerinden gelir. İlk yükleme, yeniden bağlantı ve değişmemiş durumlar olay sayılmaz. API kabulünden sonra kalıcılaştırılır; API'ye ulaşmadan kesilen geçici olayların eksiksiz geri kurulacağı garanti edilmez.
- Kaynak kimliği tekrarları tekilleştirir. Outbox aktör, hedef türü/kimliği, kaynak kimliği ve yük taşır. Bilinmeyen aktör açıkça gösterilir. Hesap sırrı, webhook tokenı ve ses dosyası URL'si alınmaz.
- Yazar sistem hesabı `0`dır; mention bildirimi oluşmaz. Kayıt/test mesajları ve tepki/düzenleme/silme işlemleri yeni kayıt üretmez. Varsayılan türdeki ayrılmış sistem otomasyon mesajları, geçmiş saklama süresi dolduktan sonra da bu korumayı kullanır.
- Outbox yazımı başarıyla commit olduktan sonra mevcut JetStream worker'ına hemen bildirim gönderilir. Aynı anda oluşan bildirimler, en fazla 200 olay kimliği taşıyan işlerde birleştirilir; yeni olaylar eski kuyruk taramasını beklemeden kendi kimlikleriyle alınır. Bildirim işi ayar/metin yükü taşımaz ve ikinci bir iş geçmişi kaydı oluşturmaz. Kuyruk broker'ı ulaşılamıyorsa yazılmış olay kaybolmaz ve kaynak işlem hata sayılmaz.
- Worker'ın 5 saniyede en fazla 200 kaydı, devam eden imleçle inceleyen kurtarma taraması korunur. Kesinti, eksik bildirim ve zamanı gelen yeniden denemeler bu yoldan alınır. Lease 60 saniye; en fazla 6 deneme, en çok 5 dakikalık geri çekilme vardır. Hızlı teslimat da aynı sahiplik/sürüm/kanal, durdurma, lease ve uzlaştırma kontrollerini kullanır. Sabit mesaj kimliği kesinti sonrası uzlaştırılır. Gateway bildirimi yeniden yayınlanabilir; mutlak exactly-once garantisi verilmez.
- Modül kapatma, ayar sürümü veya sahiplik değişmesi eski işleri atlar. Yeni sahip yeniden kaydetmelidir. Silinmiş kanal açık hata oluşturur; yeni ayarlar geçmişi yeniden oynatmaz.
- İşlem geçmişi son 50 kaydı gösterir. Ayar değişiklikleri 90 gün, teslimat sonuçları/tekilleştirme 30 gün, kuyruk 7 gün saklanır. Bu süreler **kanal mesajlarını otomatik silmez**.

Operatör `NETRCOL_AUTOMATIONS_ENABLED=false` değerini API, worker ve gateway'e uygulayabilir. Yerel overlay üçünü de yapılandırır. `.fluxer/local/.env` değişikliğinden sonra `Start-Local.ps1 -NoBrowser` servisleri yeni ortamla oluşturur. Bekleyen işler atlanır; tekrar etkinleştirme eski işleri geri getirmez.

## Yükseltme ve kaynaklar

V1 ayarları ve eski bekleyen kayıtlar okunur. Fluxcol'un `#general`, Türkçe kayıt dili ve katılma/ayrılma seçimleri korunur. V2, `schema_version/category_channels/event_channels/capture_message_content` ekler; eski `enabled/channel_id/events/language` korunur. Mevcut GET/PUT uçları kullanılır; test gövdesi `{"event_type":"message_delete"}` kabul eder.

`Start-Local.ps1 -Build -NoBrowser`, web, API/worker ve gateway kaynak imajlarını oluşturur. Normal başlatma hazır imajları kullanır. Hesaplar ve Docker volume'ları korunur.

Ortak katalog `packages/constants/src/EventLogConstants.ts`, üreticiler `fluxer_api/src/api/netrcol/EventLogSources.ts`, gateway geçişleri `fluxer_gateway/src/guild/guild_event_log.erl` içindedir. Panel ve gönderilen olay/alan/durum metinleri aynı 34 dil kataloğunu kullanır. Çeviriler Fluxer'ın yerelleştirilmiş terimleri ve ayrıca düzenlenmiş alan metinlerinden üretilir:

```powershell
node netrcol/scripts/application-settings-i18n.mjs --check
node netrcol/scripts/event-log-i18n.mjs --check
```

## Doğrulama

`EventLogFlow.test.ts` gerçek HTTP işlemlerini PostgreSQL outbox'tan sistem kanal mesajına kadar sınar: özel mesajlar, düzenleme/silme/toplu silme, sabitleme, tepkiler, kanal/kategori/izin/rol, profil, davet, moderasyon, bot, duyuru, webhook/emoji/çıkartma, giriş sesi ve kimlik doğrulamalı ses/presence RPC. Hata enjekte edilerek denetim ve mesaj yazımlarının geri alınması doğrulanır.

`EventLog.test.ts` yükseltme, yetki, kaynak kapsamı, kanal önceliği, desteklenmeyen seçim, sürüm, lease, tekrar deneme, kesinti sonrası uzlaştırma ve yoğun kuyruk ilerlemesini sınar. `EventLogCatalog.test.ts` denetim kapsamı, üreticiler, 34 dil, uzun metin ve durum geçişlerini denetler. `NETRCOL_TEST_POSTGRES_URL` yalnızca bağımsız test veritabanına verilmelidir; testler `kv_event_logs_test` ve `kv_event_log_flows` tablolarını temizler.

Panel/rota/form testleri, API/app tip kontrolleri, strict Lingui derlemesi ve gateway EUnit kontrolleri kullanılır. Yıkıcı gerçek işlem testleri Fluxcol yerine izole topluluklarda yürütülür. Son arayüz kontrolü `http://localhost:8088` üzerinde mevcut Fluxcol oturumuyla yapılır.

### 5 Ekim 2026 doğrulama sonucu

45 API testi (27 PostgreSQL modül testi, 8 gerçek işlem akışı, 6 katalog testi, 4 tepki izin testi), 37 panel/form/rota/Checkbox testi, tam gateway EUnit paketindeki 3.190 test ve 4 başlatıcı testi geçti: toplam **3.276 test**. API/app tip kontrolleri, 34 dilde strict Lingui, iki çeviri üreticisinin kapsam/yer tutucu kontrolleri, ilgili Biome kontrolleri ve `git diff --check` başarılı. Uzun emoji değişiklikleri UTF-16 mesaj sınırına sığar; tam içerik UTF-8 ekte korunur.

Web, API/worker ve gateway kaynak imajları `Start-Local.ps1 -Build -NoBrowser` ile oluşturuldu ve yerel kuruluma uygulandı. HTTP/discovery ve giriş JS/CSS kontrolleri geçti. Mevcut KDGL/Fluxcol oturumunda menü → panel → Olay kayıtları, yenileme/doğrudan bağlantı, tarayıcı geri/ileri, gönderilen mesaj bağlantısı, arama, Space, Tab/Shift+Tab, Escape koruması ve odağın menü düğmesine dönmesi doğrulandı. 390 px mobil görünümde yatay taşma olmadı; kısmi kategori seçimi her iki klavye odağında `mixed` olarak bildirildi. Test taslakları sıfırlandı ve ekran genişliği eski değerine döndürüldü.

Fluxcol'un `#general`, Türkçe kayıt dili, etkin modül ve katılma/ayrılma seçimleri korundu. Yeni türler ve metin kaydı kapalı kaldı. Son test mesajı 12:02'de sistem hesabından **Test mesajı · Üye katıldı** olarak kanala ulaştı; geçmişte **Gönderildi** durumunu aldı. Hesaplar, mevcut mesajlar ve üretim volume'ları korunurken yalnızca izole test PostgreSQL container'ı/volume'u temizlendi.

Gerçek API işlem testlerinin harness'i gateway ve dosya deposunu test hizmetleriyle sağlar. Tam gateway testleri geçmiştir; fiziksel mikrofon, kamera, giriş sesi oynatımının duyulması ve LiveKit medya aktarımı bu doğrulamanın kapsamında değildir.

[Panel ekranı](event-logs-panel.jpg) · [Gerçek kanal teslimatı](event-logs-delivery.jpg)

### 5 Ekim 2026 — sistem mesajı teslimatındaki topluluk çökmesi

Canlı gateway, sistem hesabının `"0"` yazar kimliğini `guild_user_data` üye önbelleğinde normal bir snowflake olarak ayrıştırırken `invalid_snowflake` hatasıyla topluluk sürecini sonlandırıyordu. Topluluk yeniden açılıncaya kadar istemcide kısa süreli “Topluluk geçici olarak kullanılamıyor” ekranı görünüyordu. Önceki API testlerinin test gateway'i bu gerçek mesaj dağıtımı yolunu kapsamıyordu.

Ayrılmış sistem hesabı artık mesaj oluşturma ve düzenlemede üye önbelleği güncellemesinden hariç tutulur. Normal kimlik doğrulaması ve kanal izinleri değişmez. Dört yeni regresyon testi, `"0"` ve `0` kimlikleriyle gerçek gateway mesaj dağıtımını, yazarın korunmasını, son mesaj kimliğinin güncellenmesini ve erişimi olmayan oturuma mesaj gönderilmemesini sınar. Düzeltmeden önce dördü de aynı `invalid_snowflake` hatasını üretti; düzeltmeden sonra ilgili 150 gateway testi ve Erlang biçim kontrolleri geçti.

Yalnızca gateway kaynak imajı yeniden derlendi ve yerel servise uygulandı. HTTP/JS/CSS kontrolleri geçti. Fluxcol `#general` kanalına 18:13'te **Test mesajı · Üye katıldı** ulaştı; yeni gateway'in teslimat sonrası kayıtlarında çökme veya hata raporu bulunmadı. Hesaplar, Docker volume'ları ve kullanıcının mevcut kayıt ayarları korundu.

[Düzeltme sonrası kanal teslimatı](log-delivery-fixed.jpg)

### 5 Ekim 2026 — okunabilir embed mesajları

Teslimat, yerleşik `processedEmbeds` yoluna geçirildi; dış bağlantıdan embed üretme isteği yapılmaz. `EventLogPresentation.ts` yalnızca gerekli görünen adları sınırlandırılmış sorgularla çözer, `EventLogRender.ts` aynı sunumu bütün olay ailelerine uygular. Değişmemiş dosyalar metin düzenlemesinde tekrarlanmaz; toplu silme, ilk yazara/ilk metne atfedilmeden işlem yapan kişi, kaynak kanal ve adetle özetlenir.

İzole PostgreSQL üzerinde 52 API testi geçti; son iki sunum ayrıntısı için ek regresyonla birlikte embed/ad çözümleme paketindeki 12 test de geçti. 27 panel/Checkbox testi, API/app tip kontrolleri, 34 dilde strict Lingui, iki çeviri üreticisi, ilgili Biome ve `git diff --check` başarılı. Gerçek API akışlarında kalıcı sistem mesajlarının bir rich embed taşıdığı ve metin düzenlemesinde önce/sonra alanlarının doğru olduğu doğrulandı. Uzun Unicode içerik, toplam/alan sınırları, izin adları, bilinmeyen aktör, silinen hedef, dosya bilgileri ve eski kuyruk biçimi sınandı.

Web ile API/worker kaynak imajları yenilenip `localhost:8088` kurulumuna uygulandı. HTTP/discovery ve JS/CSS kontrolleri geçti. Fluxcol'da 19:11 test/çevrimiçi durum embedleri ve 19:12 gerçek mesaj düzenlemesinin **Önce / Sonra** alanları görüntülendi. Teslimat sonrası gateway çökmesi ve worker hata sayısı sıfırdı. Mevcut kayıt seçimleri, kanal, dil, metin kaydı tercihi, hesaplar, eski mesajlar ve üretim volume'ları korundu; yalnızca göreve ait izole test veritabanı/ağı temizlendi.

[Yerel embed görünümü](event-logs-embeds.jpg)

### 5 Ekim 2026 — embed bağlantısında uygulama içi gezinme

Yerleşik `EmbedLink`, aynı kurulumun kanal/mesaj bağlantılarında genel `target="_blank"` davranışı yerine Fluxer gezinmesini kullanır. 19 bileşen testi; normal ve klavye etkinleştirmesi, değiştirilmiş tıklamalar, erişim onayı, bağlantı kanalı, DM, yüklenmemiş/uyuşmayan topluluk hedefi ve dış alan adı uyarısını doğruladı. App tip kontrolü, ilgili Biome, kaynak web derlemesi ve HTTP/JS/CSS kontrolleri geçti.

Fluxcol'daki 20:01 **Mesaj düzenlendi** başlığına normal tıklama ve Enter, mevcut `770012046` sekmesini gerçek kaynak mesaj `1556712848741105664` adresine götürdü; kaynak mesaj görünür ve vurgulanmıştı. Normal tıklama yeni sekme oluşturmadı. Yalnızca web imajı yenilendi; kayıt ayarları, mesajlar, hesaplar ve volume'lar korundu.

[Aynı sekmede kaynak mesaja geçiş](event-log-link-navigation.jpg)

### 5 Ekim 2026 — commit sonrası hızlı teslimat

`PreparedQuery.afterCommit` bildirimi, bağımsız yazım veya PostgreSQL batch işlemi başarıyla tamamlandıktan sonra çalışır. Başarısız koşullu yazım ve geri alınan batch bildirim üretmez. `EventLogWakeup`, mevcut JetStream `deliverEventLogs` işine olay kimliklerini gönderir; worker bunları doğrudan outbox'tan okur. Beş saniyelik kurtarma taraması, eski kuyruk uyumluluğu ve mevcut teslimat kontrolleri korunur.

İzole PostgreSQL üzerinde 76 test ve mevcut veritabanı katmanındaki 27 regresyon testi geçti: toplam **103 test**. Gerçek işlem akışları, commit/rollback, broker kesintisinde kalıcı kuyruğun korunması, bildirimlerin birleştirilmesi ve 200 kimlik sınırı, devam eden yayın sırasında gelen olaylar, doğrudan kimlik sorgusu, eski tarama, lease/yeniden deneme ve durdurma kontrolü sınandı. API tip kontrolü, ilgili Biome kontrolleri, kaynak API/worker derlemesi ve `git diff --check` başarılı.

Yalnızca API ve worker kaynak imajı yenilenip yerel kuruluma uygulandı; HTTP/discovery ve giriş JS/CSS kontrolleri geçti. Fluxcol'da menü → Uygulama ayarları → Olay kayıtları üzerinden, kaydedilmiş **Üye katıldı** seçeneğiyle test gönderildi. `1556728658343755776` kaydı `#general` kanalına tek embed olarak ulaştı ve geçmişte `sent` durumunu aldı. Kaydın oluşma zamanı `18:03:54.768Z`, kalıcı gönderildi durumunun yazılma zamanı `18:03:54.826083Z` idi: bu tek yerel testte **58,1 ms**. Worker `18:03:54.783Z`'de başladı ve `18:03:54.828Z`'de tamamlandı; sonraki kurtarma işi `18:03:55.785Z`'de çalıştı. Böylece teslimatın periyodik taramayı beklemediği doğrulandı.

Test düğmesine tıklama, paneli kapatma ve yeni embedin görünür olmasını bekleme akışı **999 ms** sürdü; bu değer arayüz/otomasyon hareketlerini de içerir ve yalnızca worker süresi değildir. Ölçümler bir yerel örnektir; yoğunluk, ağ ve yeniden deneme koşullarında sabit teslimat süresi garantisi verilmez. Teslimat sonrası gateway hata/çökme raporu görülmedi. Mevcut ayarlar, hesaplar, mesajlar, voice oturumu ve Docker volume'ları korundu; bağımsız test veritabanı/ağı temizlendi.

[Hızlı teslimat sonrası kanal görünümü](event-log-immediate-delivery.jpg)

### 5 Ekim 2026 — kategori sekmeleri ve dil alanının kaldırılması

Dil combobox'ı panelden kaldırıldı; API şemasındaki mevcut `language` değeri taslak ve kayıt isteklerinde korunur. Olay kataloğu Fluxer'ın ortak `Tabs` bileşeniyle, etkin sekmenin altını çizen yatay bir çubuğa taşındı. Sekmeler/paneller erişilebilir ad ve kimliklerle bağlanır; etkin olmayan panellerde olay formu oluşturulmaz. Arama bütün kategorileri kapsar, eşleşmeyen sekmeleri süzer ve sonuç yoksa yerelleştirilmiş boş durum gösterir. Kategori gezinmesi ayar yazmaz.

40 panel/rota/Checkbox testi, App tip kontrolü, 34 dilde strict Lingui derlemesi, iki çeviri üreticisi, ilgili Biome ve `git diff --check` geçti. Yeni kontroller kategori değişiminde taslağı, ok tuşuyla odağın geçişini, arama/boş durum/arama temizlemeyi ve Türkçe kayıt dilinin diğer ayarlar kaydedilirken korunmasını doğruladı. Yalnızca web imajı yeniden derlenip `localhost:8088` kurulumuna uygulandı; HTTP/discovery ve JS/CSS kontrolleri başarılı.

Mevcut Fluxcol panelinde dil alanının yokluğu, yalnızca seçili üyelik/kanal/rol olaylarının gösterilmesi, ok tuşları, Home/End, Tab/Shift+Tab ve kategoriler arası arama doğrulandı. 390 px mobil görünümde belge genişliği 390 px kaldı; End ile son sekmeye geçildiğinde etkin sekme yatay kaydırılarak görünür kaldı. Arama temizlendi ve ekran genişliği eski değerine döndürüldü. Bu kontrollerde mevcut kayıt ayarlarına kaydetme isteği gönderilmedi; hesaplar ve volume'lar korunmuştur.

[Masaüstü kategori sekmeleri](event-log-category-tabs.jpg) · [Mobil kategori sekmeleri](event-log-category-tabs-mobile.jpg)
