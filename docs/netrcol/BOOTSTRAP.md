# NetrcolFLXR teknik başlangıç kaydı

> Kontrol tarihi: 5 Ekim 2026, Europe/Istanbul\
> Aşama: Faz 0 — yerel çalışma ve ilk Uygulama ayarları arayüzü\
> Ana plan: [NETRCOLFLXR_PLAN.md](../../NETRCOLFLXR_PLAN.md)

## Yerel çalışma hazırlığı — 5 Ekim 2026

WSL ve Docker kuruldu; Virtual Machine Platform etkinleştirildi. Windows yeniden başlatıldı ve Docker Linux motorunun çalıştığı doğrulandı. Yerel başlatma/durdurma betikleri, loopback Compose katmanı ve kalıcı anahtar üretimi eklendi. Hazırlık testleri, Compose şema kontrolü ve Docker ön kontrolü geçti. Hazır upstream imajları başlatıldı; altı HTTP kontrolü ve giriş JS/CSS kontrolleri geçti. Chrome'da Türkçe `NetrcolFLXR Local kurulumu` ekranı görüldü. Bu ilk kurulum kontrolünden sonra kullanıcı KDGL hesabını ve Fluxcol topluluğunu oluşturdu. Uygulama ayarları çalışmasının güncel doğrulaması aşağıdadır; sohbet ve ses akışları henüz ayrıca test edilmedi.

İlk tarayıcı denemesindeki boş ekran, `app-proxy` için `FLUXER_STATIC_CDN_ENDPOINT` değerinin boş bırakılmasıyla giderildi. Bu servis böylece imajda bulunan dosyaları sunar; API'nin tarayıcıya duyurduğu localhost CDN adresi korunur. `verify-local.mjs`, yalnızca HTML 200 olsa bile bozuk JS/CSS dosyalarında başlatmayı başarısız sayar; mevcut 502 hatasında başarısız olduğu ve düzeltmeden sonra geçtiği doğrulandı.

Güncel başlatma talimatı: [LOCAL.md](LOCAL.md). Aşağıdaki ortam tablosu ilk kaynak indirme anındaki tespittir.

## Yapılan işler

- Resmî `fluxerapp/fluxer` repository'sinin güncel `main` dalı bu çalışma klasörüne indirildi.
- Başlangıç commit'i: `532e828fe697ad65caae475a4a8baa32c3a66b0e`.
- Yerel geliştirme dalı `netrcol/main`; resmî kaynak `upstream` remote'u olarak kayıtlı.
- İlk klon sığdır. Tam geçmiş henüz indirilmedi.
- Ürün planı 0.2 oluşturuldu; teknik bulgular aşağıda kaynak dosyalarıyla kaydedildi.
- Kurulum ön kontrolü için bağımlılıksız Node betiği eklendi.

İlk Netrcol UI değişikliği olan Uygulama ayarları menüsü ve modül önizleme paneli uygulandı. Panel, topluluk ayarları penceresinde altı kategori ve 32 modül sunar. API, gerçek otomasyon ve migration eklenmedi. Web arayüzü `netrcol/fluxer-app-proxy:local` imajını, diğer servisler upstream imajlarını kullanır. Kaynak değişiklikleri `Start-Local.ps1 -Build` ile derlenir; normal başlatma imajı yeniden oluşturmaz.

## Çalışma ortamı

| Bileşen | Bu bilgisayardaki gözlem | Upstream geliştirme yolu |
| --- | --- | --- |
| Git | Var; kaynak indirme başarılı | Git |
| Node | 24.18.0 | Devcontainer Node 26 kullanıyor |
| Corepack | 0.35.0 | Repository `pnpm@11.27.0` belirtiyor |
| pnpm | PATH üzerinde bulunamadı | Container içinde sağlanıyor |
| Docker | PATH üzerinde bulunamadı | Linux container motoru gerekli |
| WSL | Komut mevcut; `wsl --status` kurulu olmadığını bildirdi | Windows'ta Linux container ortamı için seçenek |
| Rust/Cargo ve Erlang | PATH üzerinde bulunamadı | Upstream devcontainer tarafından sağlanıyor |

Bu tablo ilk kaynak indirme anına aittir. O aşamada platformun build ve runtime testleri çalıştırılmamıştı; sonraki WSL/Docker kurulumu ve yerel runtime doğrulaması üstte kayıtlıdır. Host üzerindeki Node bağımlılıksız başlangıç kontrollerinde kullanılır. Kaynaktan web/app-proxy derlemesi ve panel doğrulaması aşağıda kayıtlıdır. Gerçek otomasyon entegrasyonu henüz uygulanmadı.

## Tekrar çalıştırılabilir ön kontrol

Repository kökünde:

```powershell
node netrcol/scripts/doctor.mjs --source-only
node netrcol/scripts/doctor.mjs
```

İlk komut kaydedilen kaynak tabanını ve araç sürümü bildirimlerini kontrol eder. İkincisi Docker CLI, Compose ve Linux container motorunu da kontrol eder. Makine tarafından okunabilir çıktı için `--json` eklenebilir.

Betik ağdan kaynak çekmez, paket kurmaz, container başlatmaz veya sistem ayarlarını değiştirmez. Docker olmayan makinede ikinci komutun çıkış kodu `1` olması beklenir. Başarılı sonuç uygulamanın çalıştığını veya build'in geçtiğini göstermez.

Tam ortam için önce Docker erişimi olan Linux container motoru sağlanır. Sonra upstream [.devcontainer/devcontainer.json](../../.devcontainer/devcontainer.json) üzerinden workspace açılır. Bu tanımın post-create adımı `cargo run -p fluxer-dev -- bootstrap` çalıştırır. Bootstrap sonrası upstream geliştirme komutu `pnpm dev` olarak tanımlıdır; gerçek çalışma doğrulaması yapılınca bu kayıt güncellenir.

Devcontainer'ın bildirdiği 4 CPU, 8 GB RAM ve 32 GB disk gereksinimleri geliştirme ortamına aittir; NetrcolFLXR üretim minimumları henüz ölçülmedi.

## Kaynak kodundan doğrulanan entegrasyon haritası

Aşağıdaki yollar başlangıç commit'inde incelendi. Bunlar ilk keşifte kaydedilen bağlantı noktalarıdır. Menü/rota bu çalışmada uygulandı; API ve worker satırları sonraki aşama içindir.

| Alan | Kaynak | Bulgular / sonraki iş |
| --- | --- | --- |
| Topluluk menüsü | [GuildMenuData.tsx](../../fluxer_app/src/features/ui/action_menu/items/GuildMenuData.tsx) | `useGuildMenuData`, mevcut oturum, sahiplik ve ayrı izinleri okuyor. Uygulama ayarları mobil/sağ tık menü kaydı burada, ayrı masaüstü başlık kaydı `GuildHeaderPopout.tsx` içinde eklendi. |
| Uygulama içi route | [AppRoutes.tsx](../../fluxer_app/src/app/router/routes/AppRoutes.tsx), [Routes.ts](../../fluxer_app/src/app/Routes.ts) | `appLayoutRoute` mevcut oturumu kontrol ediyor. Topluluk kapsamlı ekran mevcut kabuğa eklenebilir; route guard ve doğrudan giriş ayrıca gerekli. |
| API doğrulama kalıbı | [GuildMemberController.ts](../../fluxer_api/src/api/guild/controllers/GuildMemberController.ts) | `LoginRequired`, `Validator`, rate limit ve oturumdan alınan `userId` mevcut. Netrcol uçları aynı kalıbı kullanmalı ve topluluk sahibi kontrolünü ayrıca yapmalı. |
| Üye katılımı | [GuildMemberOperationsService.ts](../../fluxer_api/src/api/guild/services/member/GuildMemberOperationsService.ts) | `joinGuild` üyeliği kaydediyor; ardından event, gateway ve mevcut katılım mesajını işliyor. Kalıcı otomasyon olayının üyelikle tutarlı üretim noktası henüz seçilmedi. |
| Gateway olayı | [GuildMemberEventService.ts](../../fluxer_api/src/api/guild/services/member/GuildMemberEventService.ts) | `dispatchGuildMemberAdd`, `GUILD_MEMBER_ADD` gönderiyor. Bu fonksiyon kendi başına Netrcol için kalıcı teslim garantisi sağlamıyor. |
| Rol işlemi | [GuildMemberService.ts](../../fluxer_api/src/api/guild/services/GuildMemberService.ts), [GuildMemberRoleService.ts](../../fluxer_api/src/api/guild/services/member/GuildMemberRoleService.ts) | Üst servis role ek olarak event/audit işlemlerini yürütüyor. `systemAddMemberRole` mevcut; otomasyon policy kontrolü bunun önüne tasarlanmalı. |
| Rol doğrulama | [GuildMemberValidationService.ts](../../fluxer_api/src/api/guild/services/member/GuildMemberValidationService.ts) | Normal eylemlerde rol/yetki/hiyerarşi kontrolü var. Sistem rol yolu aynı doğrulamayı otomatik olarak çağırmıyor. Bu, iç servis varsayımıdır; tek başına bir güvenlik açığı tespiti değildir. |
| Hazır katılım mesajı | [MessageSystemService.ts](../../fluxer_api/src/api/channel/services/message/MessageSystemService.ts) | `sendJoinSystemMessage`, topluluğun sistem kanalında `USER_JOIN` mesajı ve katılan `userId` kullanıyor; özelleştirilmiş Netrcol karşılama mesajıyla aynı sözleşme değil. |
| Sistem kimliği | [Core.ts](../../fluxer_api/src/api/constants/Core.ts), [SendSystemDm.ts](../../fluxer_api/src/api/worker/tasks/SendSystemDm.ts) | `SYSTEM_USER_ID = 0` ve sistem DM gönderimi zaten var. Otomasyonlar için yeni kimlik icat etmeden önce bu yapı değerlendirilecek. DM desteği topluluk mesaj yetkilerini kanıtlamaz. |
| Mesaj yazarı | [MessageResponseSchemas.ts](../../packages/schema/src/domains/message/MessageResponseSchemas.ts), [MessagingMessage.ts](../../fluxer_app/src/features/messaging/models/MessagingMessage.ts) | API yanıtı `author` nesnesi bekliyor; istemci bunu kullanıcı modeliyle işliyor. Yeni aktör gösterimi/null yazar kararı istemci testi gerektiriyor. |
| Audit | [GuildAuditLogService.ts](../../fluxer_api/src/api/guild/GuildAuditLogService.ts), [GuildAuditLog.ts](../../fluxer_api/src/api/models/GuildAuditLog.ts) | Audit modeli `userId` içeriyor. İnsan onaylayan ile sistemi çalıştıran aktör birbirine karıştırılmamalı. |
| Worker ve iş kaydı | [WorkerService.ts](../../fluxer_api/src/api/worker/WorkerService.ts) | İş ledger'ı, kuyruk anahtarı, iptal ve zorunlu ledger seçeneği var. Eylem yan etkisinin tekilleştirilmesi ayrıca gerekli. |
| Kuyruk izolasyonu | [WorkerLaneConfig.ts](../../fluxer_api/src/api/worker/WorkerLaneConfig.ts), [JetStreamWorkerQueue.ts](../../fluxer_api/src/api/worker/JetStreamWorkerQueue.ts) | NATS JetStream, iş yükü sınıfları, tekrar teslim ve başarısız iş kuyruğu mevcut. Başlangıç kodunda duplicate penceresi 2 dakika; kalıcı eylem tekilleştirmesi yerine geçmez. |
| Self-host servisleri | [docker-compose.yml](../../deploy/self-hosting/docker-compose.yml) | Hazır upstream servis düzeni var. Değiştirilmiş kodu test ederken resmî hazır imajların yerel kaynak değişikliklerini içermediği göz önünde tutulmalı. |

## İlk deneme için karar sırası

1. Upstream'i Linux geliştirme ortamında değiştirmeden çalıştır; kullanıcı/topluluk/katılım akışını doğrula.
2. Sistem kimliği + topluluk mesajı + ayrı insan onayı/audit temsilini küçük deneyle seç. Resmî sistem kimliği otomatik olarak sınırsız Netrcol yetkisi sayılmasın.
3. Üyelik kaydı ile kalıcı olay üretimi ve eylem sonucu kaydı arasındaki hata aralıklarını belirle.
4. Karşılama yapılandırmasının owner-only API'sini ve sürümlü saklamasını ekle.
5. Uygulama ayarları ekranından kanal/rol/mesaj seçimini kaydet.
6. Gerçek katılım olayını worker'a bağla; eylem başına politika, tekrar kontrolü ve audit uygula.
7. Çift teslim, worker çökmesi, kaynak silinmesi ve modül kapatma senaryolarını dene.

Bu sıra, kritik sistem aktörü belirsizliği çözülmeden geniş bir dashboard veya genel otomasyon editörü geliştirilmesini önler.

## İlk kaynak indirme doğrulaması (tarihsel kayıt)

- Git klonlama ve checkout: başarılı, 14.382 izlenen dosya alındı.
- Başlangıçta upstream çalışma ağacı: temiz.
- Netrcol eklerinden önceki `HEAD`: kayıtlı upstream SHA ile aynı.
- Plan, kaynak manifesti ve ön kontrol betiği: yerel başlangıç dosyaları.
- `node --check netrcol/scripts/doctor.mjs`: başarılı.
- `node netrcol/scripts/doctor.mjs --source-only --json`: başarılı; taban commit, remote ve araç sürümü bildirimleri doğrulandı.
- `node netrcol/scripts/doctor.mjs --json`: beklendiği gibi başarısız; Docker CLI bulunamadı, container kontrolleri atlandı.
- İki Markdown belgesinin yerel bağlantı ve UTF-8 kontrolleri: başarılı.
- Tam Fluxer kurulumu, runtime, UI ve entegrasyon testleri: henüz çalıştırılmadı; Linux container ortamı eksik.

## Uygulama ayarları doğrulaması — 5 Ekim 2026

- Yeni sayfa ve erişim/dönüş yardımcıları: `fluxer_app/src/features/application_settings/`.
- Owner-only/self-hosted kontrolü menülerde ve doğrudan sayfada ortak yardımcıyla uygulanır; MobX gözlemcisi sahiplik değişiminde pencereyi kaldırır.
- `vitest run src/features/application_settings/ApplicationSettingsPage.test.tsx`: 12 test geçti. Gerçek MobX reaktivitesiyle sahiplik kaybı, sahip olmayan kullanıcı, hosted kurulum, 32 modüllü katalog, URL üzerinden modül seçimi, devre dışı ayar alanları, bilinmeyen modül, mobil liste/ayrıntı, içerik odağı ve güvenli dönüş hedefleri sınandı. Yetki senaryolarında test verileri kullanıldı; mevcut hesabın sahipliği değiştirilmedi.
- `pnpm typecheck:only`: tam uygulama tip kontrolü geçti.
- Modül ekranlarının ve mobil rota düzeltmesinin bulunduğu 9 TypeScript/TSX/CSS dosyası için Biome kontrolü geçti; önceki menü/rota entegrasyonlarının kontrolleri de korunur.
- Üretim SPA/app-proxy derlemesi ve `lingui compile --strict` geçti. Rspack, bu özellik dışındaki mevcut CSS dosyaları arasında 8 sıralama uyarısı verdi; derleme başarılı. 34 dil kataloğunda yeni metinler mevcut; Türkçe/İngilizce çeviriler, diğer dillerde İngilizce karşılıklar var.
- Chrome, `localhost:8088`, mevcut KDGL/Fluxcol oturumu: başlık menüsü ve sağ tık menüsünde doğru sıra, panelin açılması, ok tuşları/Enter ile menü seçimi, içerik bölgesine odak geçişi, Enter ile dönüş, tarayıcı geri/ileri doğrulandı.
- 390×844 mobil görünümde menü girişi, menünün kapanması, tam alan paneli ve son kanala dönüş doğrulandı.
- Son imajda masaüstünde topluluk ayarları görünümündeki sol kategori menüsü ve sağ modül önizlemesi doğrulandı. Genel bakış 32 modül gösterir. 390×844 mobilde liste/ayrıntı/dönüş ve modül bağlantısıyla yenileme; 320×640 ekranda yatay taşma olmadan genel bakış doğrulandı. Seçili modül masaüstünden mobile geçerken korunur. Masaüstünde modül bağlantısıyla yenileme, ok tuşları/Enter ile içerik odağı, tarayıcı geri/ileri ve Escape/kapatma ile `#general` kanalına dönüş çalıştı. Test sonunda tarayıcı boyutu eski haline getirildi ve Fluxcol menüsünden genel bakış tekrar açıldı.
- `Start-Local.ps1 -Build -NoBrowser` ve ardından normal `Start-Local.ps1 -NoBrowser` sıfır çıkış koduyla tamamlandı. İkinci başlatma kaynak derlemesi yapmadı. Altı HTTP uç noktası ve giriş JS/CSS kontrolleri geçti; hesap ve volume'lar korundu.
- Panel kaynağında ayar yazma veya otomasyon isteği yoktur; yalnızca var olan oturum/topluluk/kanal durumunu okur. Modüle özgü üç alan ve etkinleştirme anahtarı devre dışıdır. Yeni API/tablo/worker eklenmedi.
- Yeni özel Lingui kimlikleri kataloglarda `js-lingui-explicit-id` ile işaretlenir. Türkçe karşılıkların çalışma anında bulunması bu işarete bağlıdır.
- Mobil geçmiş kurulurken ve masaüstünden mobile geçerken query/hash korunur; seçilen modülün yenilemede kaybolmasına yol açan önceki pathname-only gezinme düzeltildi.
- LF satır sonu repository'ye özel `core.autocrlf=false` ve `core.eol=lf` ayarlarıyla sabitlenir; Windows CRLF nedeniyle Linux betiklerinde ve CSS tam metin kontrollerinde oluşan kaynak derleme hataları giderildi. Önceki `.gitattributes` içindeki `eol=lf` değişikliği, git index'inin bütün repository'yi değişmiş göstermesine yol açtığı için upstream haline döndürüldü.
- Tasarım uyumu düzeltmesinde kart panosu, sayaçlar ve renkli önizleme kutusu kaldırıldı. Masaüstü başlığı/kapatma düğmesi `SettingsModalHeader`, topluluk adı gerçek topluluk ayarları kenar çubuğu stili, bölümler `GuildOverviewTabSettingsSection` ve mobil başlık `MobileHeader` kullanır. 32 modül, kategori başlıkları altında sade satırlar olarak gösterilir; işlem geçmişi menünün sonunda yer alır.
- Aynı Chrome oturumunda gerçek topluluk ayarlarıyla karşılaştırıldı: başlık, başlık çubuğu, topluluk adı ve bölüm başlığının font/renk/ölçü/boşluk değerleri eşleşti. Genel bakış ve kapatma simgelerinin SVG içerikleri de aynıydı. Yerel üretim imajı yeniden derlenip başlatıldı; 12 test, tam tip kontrolü ve çeviri derlemesi yeniden geçti. Masaüstü modül formunda üç alan ve anahtar devre dışıydı; ok tuşları/Enter içerik bölgesine odak taşıdı. 390×844 mobilde seçilen modül ve listeye dönüş, 320×640 genel bakışta yatay taşma olmaması ve yenileme kontrol edildi; ardından ekran boyutu geri alındı.

Test ortamı upstream Dockerfile içindeki `app-build` aşamasından `netrcol/fluxer-app-checks:local` olarak üretildi. Vitest yapılandırması test container'ına salt okunur bağlandı. Gerçek sohbet, ses ve henüz uygulanmamış otomasyonlar bu kontrolün kapsamı değildir.

### Kanal arka planı düzeltmesi — 5 Ekim 2026

- Normal kanal/mesaj rotaları ve uygulama ayarları statik rotası ortak `ChannelRouteLayout` altında toplandı. Kanalın gerçek `ChannelLayout` ve `ChannelIndexPage` bileşenleri panelin altında aynı konumda tutulur; uygulama ayarlarının ayrı arka plan başlığı yalnızca erişim açıklamasında kullanılır.
- Son seçilen kanal aynı topluluğa ait ve erişilebilir olmalıdır. Kanal silinirse veya izin kaybolursa arka plan kaldırılır. Doğrudan bağlantı ve yenileme aynı doğrulamayı kullanır; panelin URL'si kanal kimliği olarak yorumlanmaz.
- Gerçek router ve bellek geçmişiyle 10 ek test geçti: kanal bileşeninin/taslağın korunması, modül seçimi, geri/ileri, doğrudan bağlantı, geçersiz kanal durumları, reaktif izin kaybı ve mesaj rota parametreleri. Önceki 12 panel testiyle toplam 22 test geçti. Yedi değişen kaynak/test dosyasının Biome kontrolü, tam uygulama tip kontrolü, üretim ve çeviri derlemeleri başarılıydı.
- `localhost:8088`, mevcut KDGL/Fluxcol oturumunda `#general` üzerinden menüyle açıldı. Panel açıkken ana kanalın adı, tam metin içeriği ve üye listesi açılmadan önceki değerlerle aynıydı; ayrı uygulama ayarları arka plan başlığı yoktu. Modül bağlantısıyla yenileme, geri/ileri ve kapatarak aynı kanala dönüş doğrulandı. 390×844 mobilde seçili modül ve listeye dönüş çalıştı; ekran boyutu sıfırlanınca masaüstü paneli yine gerçek kanalın üzerindeydi.
- `Start-Local.ps1 -Build -NoBrowser` sıfır çıkış koduyla tamamlandı. Altı HTTP kontrolü ve giriş JS/CSS dosyaları geçti; hesaplar ve Docker volume'ları korundu. Derleme günlüğü: `.fluxer/local-bootstrap/channel-background-build.log`.

## Sonraki oturum için komutlar

```powershell
git status --short
git log -1 --format="%H %s"
node netrcol/scripts/doctor.mjs
```

Upstream güncellemesi ayrı bir çalışma olarak yapılır. Yeni kaynak alınırken bu belgedeki taban SHA ve `netrcol/upstream.json` sessizce değiştirilmez; doğrulanan senkronizasyonun parçası olarak güncellenir. Yerel değişiklikler korunur ve upstream'e push yapılmaz.
