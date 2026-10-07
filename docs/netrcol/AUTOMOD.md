# AutoMod

**Uygulama ayarları → AutoMod**, self-hosted PostgreSQL kurulumlarında topluluk sahibine açıktır. Modül ve 14 kural başlangıçta kapalı, botları yok say seçeneği açıktır. Olay kayıtları ayarları değişmez.

Netrcol bildirimlerinin dili **Uygulama ayarları → Modül ayarları → Netrcol mesaj dili** alanından seçilir. Olay kayıtları ve AutoMod aynı topluluk dilini kullanır; işlemin hedefindeki üyenin kişisel dili bildirim dilini belirlemez. 34 dil desteklenir. Eski kayıt dili yükseltmede korunur; kişisel arayüz dili ve kural etkinliği değişmez. Ayrıntılar [ortak modül ayarlarında](MODULE_SETTINGS.md) bulunur.

14 kuralın işlevleri, yaptırımları, kuyruk kurtarma ve panel davranışları sınandı. 255 API ve 80 panel testi geçti. Gerçek yerel API/JetStream/gateway üzerinde ayrıca 14 kural ve 20 mesajlık eşzamanlı deneme dahil 16 senaryo geçti. Kapsam, beş hata düzeltmesi, ölçümler ve test ortamının sınırları [AutoMod test raporunda](AUTOMOD_TEST_REPORT.md) bulunur.

## Kontroller

| Kural | Değerlendirme ve başlangıç eşiği |
| --- | --- |
| Yasaklı kelimeler | Ayrı ayar ekranında tam kelime ve kelime içinde eşleşme listeleri. Unicode normalleştirme ve harf büyüklüğünden bağımsız eşleşme. Kullanıcı regex’i çalıştırılmaz. |
| Tekrarlanan metin | Aynı üyenin normalleştirilmiş aynı metni 10 saniyede 3 kez göndermesi. |
| Sunucu davetleri | Fluxer/Discord davetleri ve `/invite/` adresleri. Ayrı ayar ekranında davet ve dış bağlantı filtreleri için ortak URL öneki izin listesi vardır. Önceki kurala özel alan adı istisnaları korunur. |
| Dış bağlantılar | HTTP(S)/`www.` bağlantıları. Ayrı ayar ekranında davet filtresiyle ortak URL öneki izin listesi; önceki kurala özel alan adı ve gerçek alt alan istisnaları korunur. |
| Aşırı büyük harf | Ayrı ayar ekranında minimum karakter sayısı ve büyük harf oranı. Başlangıçta en az 10 büyük/küçük harf ayrımı olan harfte %70’in üzerinde büyük harf. |
| Aşırı emoji | 10’dan fazla Unicode/özel emoji; birleşik aile/ten rengi emojileri bir sayılır. |
| Aşırı spoiler | 5’ten fazla `||…||` bölümü. |
| Aşırı etiketleme | 5’ten fazla farklı kullanıcı/rol/herkes/burada etiketi; aynı kullanıcının `<@id>` ve `<@!id>` biçimleri bir sayılır. |
| Zalgo metni | Ardışık 3’ten fazla Unicode birleştirme işareti. |
| Spam koruması | Aynı üyenin 10 saniyede 5 mesaj göndermesi. |
| Karakter sınırı | 2000’den fazla Unicode karakter. |
| Medya spamı | Aynı üyenin 10 saniyede toplam 5 dosya eki/çıkartma göndermesi. Dosya içeriği incelenmez. |
| Anti Raid / Baskın koruması | Başlangıçta 7 günden genç hesaplardan 60 saniyede 10 katılma; yaş alanı olmayan eski ayarlar bütün hesapları sayar. Kilitleme süre boyunca yeni katılmaları ve sahip dışındaki üyelerin yeni mesaj/düzenlemelerini engeller. Okuma ve ses erişimi değişmez. |
| Anti Nuke / Sunucu tahribatı koruması | Aynı kişinin 60 saniyede 5 yönetim işlemi: topluluk/kanal/rol/izin değişiklikleri, atma, yasaklama, üye rolü, bot ekleme ve webhook işlemleri. Yeni ayarlarda yalnızca kayıt modu açıktır. Kilitleme seçilip kayıt modu kapatıldığında sonraki kimliği doğrulanmış topluluk/kanal/webhook yazma istekleri ve bot ekleme onayları süreli engellenir. Önceden yapılan değişiklikler geri alınmaz. |

Sayım kuralları eşik karşılandığında, miktar sınırları aşıldığında tetiklenir. Mesaj düzenlemeleri içerik kontrollerinden geçer; yeni spam gönderimi sayılmaz. Kapsam seçimleri sayımdan önce uygulanır; yalnızca ilgili kuralın kapsamındaki olaylar o kuralın sayacına katılır. Sahip, sistem hesabı ve webhook mesajları kapsam dışındadır. Fluxer'ın katılım/sabitleme gibi yerleşik sistem bildirimleri de kullanıcı mesajı filtresi ve spam sayacına girmez; normal mesajlar ve yanıtlar denetlenir. Anti Raid katılım yazımıyla tetiklenir, kendi katılım bildirimini engellemez. Botları yok say kapalıysa normal bot hesapları da değerlendirilir.

## Yasaklı kelime ayar ekranı

**AutoMod → Yasaklı kelimeler → Ayarlar** ayrı bir ekran açar. **İzinler** ve **Ek ayarlar** bölümleri daraltılabilir. **Vazgeç**, yalnızca bu ekranda yapılan değişiklikleri geri alır; önceki AutoMod taslağını korur. **Kaydet ve kapat**, mevcut AutoMod taslağını sürüm kontrolüyle kaydeder ve kurallar listesine döner. Hata/sürüm çakışmasında taslak korunur ve ekran açık kalır. Geri düğmesi değişmiş taslağı sessizce atmaz. Dönüşte odak kuralın Ayarlar düğmesine gelir.

Tam eşleşme, `how` için ayrı `how` kelimesini bulur; `showcase` eşleşmez. Kelime içinde eşleşme listesine `how` eklenirse `showcase` da eşleşir. İki listeden herhangi birinin eşleşmesi kuralın seçili işlemini tetikler. Yalnızca ikinci listenin doldurulması da yeterlidir. Her liste en fazla 200 öğe içerir; öğeler 1–100 karakterdir. Enter, virgül ve birden çok satır yapıştırma desteklenir; tekrarlar temizlenir. Henüz Enter basılmamış son kelime kaydetmeye dahildir. Örnek mesajlarda aynı İngilizce `how` kelimesi gösterilir; tüm açıklamalar 34 dilde çevrilmiştir.

**Ortak izinler**, AutoMod sayfasında kullanıcı/rol/kanal/kategori kapsamını belirler. Varsayılan her grupta **Seçilenler dışında herkese uygula** ve boş listedir: tüm üyeler/kanallar kapsanır. **Yalnızca seçilenlere uygula** boş listeyle kimseyi kapsamaz. Kullanıcı kimliği toplulukta mevcut bir üyeye ait olmalıdır; rol, kanal ve kategori aynı topluluktan doğrulanır.

**Bu kural için ayrı izinler kullan** açılınca ortak seçimler başlangıç olarak kopyalanır ve bu kural için onların yerine geçer. Kapalıyken ortak seçimler görünür ancak düzenlenemez. Kullanıcı açıkça seçilmişse kullanıcı modu rol sonucundan önceliklidir; seçilmemiş bir kullanıcı için kullanıcı kapsamı ve rol kapsamı birlikte değerlendirilir. Kanal ve kategori sınırları her durumda geçerlidir. Kategori, olayın kaynak kanalının mevcut üst kategorisidir; kategorisiz kanal yalnızca hariç tutma modunda geçer. Kaynak kanalı olmayan katılma/yönetim olayları kanal/kategori dahil etme listelerine girmez.

Mevcut kayıtların `words` listesi tam eşleşme olarak korunur; yeni kısmi liste boş ve ayrı izinler kapalı okunur. Ortak yeni izin alanı yoksa mevcut kanal/rol istisnaları kullanılır. Veritabanı tabloları ve kalıcı volume’lar değiştirilmez. Sahip, bot ve sistem hesabı kontrolleri ayrı izinlerle geçersiz kılınamaz.

## Tekrarlanan metin ayar ekranı

**AutoMod → Tekrarlanan metin → Ayarlar**, yasaklı kelime ekranıyla aynı başlık, izinler, Vazgeç ve Kaydet ve kapat davranışlarını kullanır. Ortak kullanıcı/rol/kanal/kategori kapsamı devralınır; **Bu kural için ayrı izinler kullan** açılınca yalnızca tekrarlanan metin kuralının kapsamı düzenlenir. Ayrı seçimler diğer kuralların izinlerini değiştirmez.

**Ek ayarlar** bölümünde tekrarlanan mesaj sayısı (1–1000) ve süre penceresi (1–300 saniye) düzenlenir. Mevcut değerler korunur; varsayılan 3 mesaj/10 saniyedir. Aynı üyenin kural kapsamındaki kanallara gönderdiği, normalleştirme sonrası aynı olan metinler birlikte sayılır. Büyük/küçük harf, art arda boşluk ve desteklenen görünmez karakter farklılıkları normalleştirilir. Mesaj düzenlemesi yeni tekrar olarak sayılmaz. Eşik dahilinde kuralın AutoMod ana sayfasında seçilmiş işlemi uygulanır.

Geçersiz sayılar kaydetmeyi engeller. Sürüm çakışmasında taslak açık kalır; başarılı kaydetme veya Vazgeç sonrasında odak Tekrarlanan metin Ayarlar düğmesine döner. Vazgeç bu ekran açılmadan önceki AutoMod taslağını korur. Yeni başlık ve açıklamalar 34 dilde çevrilmiştir.

## Sunucu davetleri ayar ekranı

**AutoMod → Sunucu davetleri → Ayarlar**, aynı başlık ve ortak/kurala özel dört izin grubuyla açılır. **Bağlantı izin listesi** en fazla 100 HTTP(S) URL öneki kabul eder; her öğe en fazla 2048 karakterdir. Enter, virgül veya satırlarla ekleme, tek tek kaldırma ve öğe sayacı bulunur. Boşluk veya kullanıcı adı/parola içeren adresler kaydedilemez. Henüz Enter basılmamış geçerli adres de kayda dahil edilir.

Liste hem **Sunucu davetleri** hem **Dış bağlantılar** filtresinde kullanılır. Eşleşme yazılan önekle başlama esasına dayanır: büyük/küçük harf, protokol ve yol dikkate alınır. Örneğin `https://example.com/allowed/`, bu yoldaki bağlantıları muaf tutar; `http://example.com/allowed/` veya `/Allowed/` eşleşmez. Adres açılmaz veya yönlendirmesi takip edilmez. İzinli bağlantının aynı mesajdaki başka bir bağlantıya ya da yasaklı kelime/spam gibi diğer kurallara muafiyet etkisi yoktur.

Eski ayarlar ortak listeyi boş okur. Önceki davet alan adı istisnaları ayrı daraltılabilir bölümde düzenlenebilir; dış bağlantı alan adı listesi kendi kuralında kalır. Bu eski listeler alan adlarını ve gerçek alt alanlarını harf büyüklüğünden bağımsız karşılamaya devam eder. Yeni ortak URL listesi onların yerine otomatik dönüştürülmez.

**Vazgeç**, bu ekran açıldığından beri değişen davet kuralını ve ortak URL listesini geri alır; önceki AutoMod taslağını korur. **Kaydet ve kapat** tüm AutoMod taslağını sürüm kontrolüyle kaydeder; hata halinde ekran açık ve taslak korunmuş kalır. Geri dönüş ve pencere kapanışında taslak koruması vardır; kurallar listesine dönünce odak Sunucu davetleri Ayarlar düğmesine gelir. Yeni alan ve açıklamalar 34 dilde çevrilmiştir.

## Dış bağlantılar ayar ekranı

**AutoMod → Dış bağlantılar → Ayarlar**, Sunucu davetleri ekranıyla aynı Fluxer başlık, izin bölümü, bağlantı izin listesi, Vazgeç ve Kaydet ve kapat düzenini kullanır. Ortak kullanıcı/rol/kanal/kategori kapsamı devralınır; **Bu kural için ayrı izinler kullan** açılınca yalnızca dış bağlantı kuralının izinleri düzenlenir. Bu seçim davet kuralının kapsamını değiştirmez.

Bağlantı izin listesi iki ekranda da aynı kayıttır. Birinden kaydedilen URL önekleri diğerinde de görünür; en fazla 100 öğe, öğe başına 2048 karakter ve harf/protokol/yol kuralları aynıdır. Dış bağlantı kuralının eski alan adı istisnaları varsa daraltılabilir bölümde düzenlenebilir. **Vazgeç**, bu ekranın izin, eski alan adı ve URL listesi değişikliklerini geri alır; ekran açılmadan önceki AutoMod taslağını korur. Kaydetme hatası veya sürüm çakışması ekranı kapatmaz. Dönüşte odak Dış bağlantılar Ayarlar düğmesine gelir. Tüm alanlar mevcut 34 dil çevirilerini kullanır.

## Aşırı büyük harf ayar ekranı

**AutoMod → Aşırı büyük harf → Ayarlar**, aynı Fluxer başlık, daraltılabilir İzinler/Ek ayarlar bölümleri, Vazgeç ve Kaydet ve kapat düzenini kullanır. Ortak kullanıcı/rol/kanal/kategori kapsamı devralınır; ayrı izinler açılınca yalnızca bu kuralın kapsamı düzenlenir.

**Minimum karakter sayısı** 1–10000, **En yüksek büyük harf oranı (%)** 1–100 arasında tam sayı kabul eder. Mevcut kaydedilmiş değerler korunur; yeni ayarlarda varsayılan 10/70’tir. Her iki hesap yalnızca büyük/küçük harf biçimleri olan harfleri sayar. Boşluk, rakam, emoji ve harf büyüklüğü ayrımı olmayan yazılar sayımı artırmaz. Minimum dahil, yüzde sınırı hariçtir: 15/70 ayarında 14 harfli tamamen büyük bir mesaj veya 20 harfin 14’ü büyük olan (%70) mesaj tetiklenmez; 20 harfin 15’i büyük (%75) olduğunda seçili işlem uygulanır. %100 sınırında bu kural tetiklenmez. Mesaj oluşturma ve düzenleme aynı içerik kontrolünü kullanır.

Boş, kesirli veya sınır dışı değerler kaydetmeyi engeller. Kaydetme tüm AutoMod taslağını mevcut sürüm kontrolüyle kaydeder; çakışmada ekran ve değerler korunur. Vazgeç yalnızca bu ekrandaki değişiklikleri geri alır, önceki modül taslağı kalır. Geri/Escape taslak korumasını ve kurallar listesine dönüşte Ayarlar düğmesine odak dönüşünü kullanır. İki alan ve sayım açıklaması 34 dilde çevrilmiştir.

## Aşırı emoji ayar ekranı

**AutoMod → Aşırı emoji → Ayarlar**, Fluxer'ın ortak başlık ve form bileşenlerini, daraltılabilir İzinler/Ek ayarlar bölümlerini, Vazgeç ve Kaydet ve kapat düğmelerini kullanır. Ortak kullanıcı/rol/kanal/kategori kapsamı devralınır; ayrı izinler açılınca yalnızca bu kuralın kapsamı düzenlenir.

**Emoji sınırı**, 1–10000 arasında tam sayı kabul eder. Kayıtlı sınır korunur; yeni ayarlarda varsayılan 10'dur. Kural yalnızca sayı sınırı aştığında tetiklenir: 12 ayarında 12 emoji serbesttir, 13 emoji seçili işlemi tetikler. Unicode, statik/hareketli özel emojiler, bayraklar ve tuş emojileri sayılır. Aile veya ten rengi içeren birleşik diziler tek emoji olarak sayılır. Mesaj oluşturma ve düzenleme aynı sayımı kullanır.

Boş, kesirli veya sınır dışı değerler kaydetmeyi engeller. Kaydetme tüm AutoMod taslağını sürüm kontrolüyle kaydeder; hata ve çakışmada taslak korunur. Vazgeç yalnızca bu ekrandaki değişiklikleri geri alır, önceki modül taslağı kalır. Geri/Escape kaydedilmemiş değişiklik korumasını kullanır; dönüşte odak Aşırı emoji Ayarlar düğmesine gelir. Alan ve açıklama 34 dilde çevrilmiştir. Bu ekranın açılması kuralı veya modülü etkinleştirmez.

## Aşırı spoiler ayar ekranı

**AutoMod → Aşırı spoiler → Ayarlar**, diğer kurallarla aynı Fluxer başlık, daraltılabilir İzinler/Ek ayarlar bölümleri ve Vazgeç/Kaydet ve kapat düğmelerini kullanır. Ortak kullanıcı/rol/kanal/kategori kapsamı devralınır; ayrı izinler yalnızca bu kural için kaydedilir.

**Spoiler etiketi sınırı**, 1–10000 arasında tam sayı kabul eder. Kayıtlı değer korunur; yeni ayarlarda varsayılan 5'tir. Mesaj metninde açılış ve kapanış `||` işaretleriyle çevrili her bölüm bir sayılır; çok satırlı ve boş bölümler de sayılır. Tek `|` veya kapanışı olmayan bölüm sayılmaz. Kontrol mesaj metni üzerinde yapılır, Markdown gösterim bağlamını ayırmaz. Sınır eşitinde işlem uygulanmaz: 5 ayarında 5 bölüm serbest, 6 bölüm seçili işlemi tetikler. Mesaj oluşturma ve düzenleme aynı kontrolü kullanır.

Boş, kesirli veya sınır dışı sayı kaydetmeyi engeller. Kaydetme tüm AutoMod taslağını mevcut sürümle kaydeder; hata veya çakışmada ekran açık ve taslak korunmuş kalır. Vazgeç bu ekran açıldıktan sonraki değişiklikleri geri alır; önceki modül taslağı korunur. Geri/Escape taslak koruması ve Ayarlar düğmesine odak dönüşü ortaktır. Alan ve açıklama 34 dilde çevrilmiştir; ekranın açılması kuralı veya modülü etkinleştirmez.

## Aşırı etiketleme ayar ekranı

**AutoMod → Aşırı etiketleme → Ayarlar**, Fluxer'ın ortak başlık ve form bileşenlerini, daraltılabilir İzinler/Ek ayarlar bölümlerini ve Vazgeç/Kaydet ve kapat düğmelerini kullanır. Ortak kullanıcı/rol/kanal/kategori kapsamı devralınır; ayrı izinler açılınca yalnızca bu kuralın kapsamı düzenlenir.

**Etiketleme sınırı**, 1–10000 arasında tam sayı kabul eder. Kayıtlı sınır korunur; yeni ayarlarda varsayılan 5'tir. Mesaj metnindeki farklı kullanıcı etiketleri (`<@id>`, `<@!id>`), rol etiketleri (`<@&id>`), `@everyone` ve `@here` sayılır. Tekrarlar ve aynı kullanıcıya ait iki yazım biçimi birlikte tek etiket sayılır. Kanal etiketleri ve sıradan `@ad` metni sayılmaz. Kontrol ham mesaj metninde yapılır; Markdown bağlamına veya bildirim iznine göre ayrılmaz. Sınır eşitinde işlem uygulanmaz: 5 ayarında 5 farklı etiket serbest, 6 farklı etiket seçili işlemi tetikler. Oluşturma ve düzenleme aynı sayımı kullanır.

Boş, kesirli veya sınır dışı değerler kaydetmeyi engeller. Kaydetme tüm AutoMod taslağını mevcut sürümle kaydeder; hata ve çakışmada taslak korunur. Vazgeç yalnızca bu ekran açıldıktan sonraki değişiklikleri geri alır, önceki modül taslağı kalır. Geri/Escape taslak koruması ve ilgili Ayarlar düğmesine odak dönüşü ortaktır. Alan ve açıklama 34 dilde çevrilmiştir; ekranın açılması kuralı veya modülü etkinleştirmez.

## Zalgo ayar ekranı

**AutoMod → Zalgo → Ayarlar**, referans görseldeki gibi İzinler bölümünden oluşur. Ortak kullanıcı/rol/kanal/kategori kapsamı devralınır; bu kurala özel izin anahtarı açılınca dört kapsam düzenlenebilir. Başlık, bölüm, anahtar, seçimler ve Vazgeç/Kaydet ve kapat düğmeleri mevcut Fluxer bileşenleridir ve 34 dildeki ortak çevirileri kullanır.

Kayıtlı hassasiyet değeri izin düzenlemesiyle değiştirilmez. Yeni yapılandırmalarda varsayılan 3'tür: art arda gelen bir Unicode işaret grubunda 3 işaret tetiklemez, 4 işaret tetikler. İşaretler Unicode kod noktalarıyla sayılır; toplam mesaj boyunca biriktirilmez. Birbirinden ayrı normal aksanlar aynı gruba katılmaz. Mesaj oluşturma ve düzenleme aynı kontrolü kullanır; kontrol ham metindeki `\p{M}` işaret grupları üzerindedir.

Kaydetme bütün AutoMod taslağını sürüm kontrolüyle kaydeder; hata veya çakışmada ekran açık ve taslak korunmuş kalır. Vazgeç yalnızca bu ekran açıldıktan sonraki değişiklikleri geri alır; önceki modül taslağı korunur. Geri/Escape ve sayfa yenileme kaydedilmemiş değişiklik korumasını kullanır. Dönüşte odak Zalgo Ayarlar düğmesine gelir. Ekranın açılması modülü veya kuralı etkinleştirmez.

## Spam koruması ayar ekranı

**AutoMod → Spam koruması → Ayarlar**, diğer kurallarla aynı Fluxer başlık, daraltılabilir İzinler/Ek ayarlar bölümleri ve Vazgeç/Kaydet ve kapat davranışlarını kullanır. Ortak kullanıcı/rol/kanal/kategori kapsamı devralınır; ayrı izinler anahtarı açılınca yalnızca spam kuralının dört kapsamı düzenlenebilir.

**Mesaj sınırı** ve **Süre aralığı (saniye)**, Fluxer'ın mevcut kaydırıcı bileşeniyle tam sayılar halinde ayarlanır. Mesaj aralığı 1–100, süre aralığı 1–600 saniyedir; mevcut 100 üstü mesaj sınırlarının sessizce düşürülmemesi için bu kayıtlar kendi daha geniş kaydırıcı aralığıyla açılır (API'nin eski 1000 üst sınırı korunur). Mevcut değerler ve yeni ayarlarda 5 mesaj/10 saniye varsayılanı korunur. Her kaydırıcı güncel değeri ve uç değerleri gösterir; Tab/Shift+Tab, yön tuşları, Home/End, fare ve dokunmatik kullanım Fluxer bileşeninin davranışlarını kullanır.

Aynı üyenin bu kuralın kapsamındaki kanallara gönderdiği yeni mesajlar birlikte sayılır. Seçilen süre aralığında mesaj sınırına **ulaşıldığında** seçili işlem tetiklenir; farklı metinler de sayılır. Düzenlemeler yeni mesaj olarak sayılmaz. Süre penceresinin tam alt sınırındaki olay dışarıda kalır. Sayacın kalıcı örnek penceresi 600 saniyeyi kapsayacak şekilde genişletilmiştir; diğer kurallar kendi sürelerini ve 300 saniyelik üst sınırlarını korur. Kaynak mesajlar arşivlenmez, sayaçlarda mevcut parmak izleri kullanılır.

Vazgeç bu ekran açıldıktan sonraki değişiklikleri geri alır, önceki AutoMod taslağını korur. Kaydet ve kapat bütün AutoMod taslağını sürüm kontrolüyle kaydeder; hata veya çakışmada ekran açık ve taslak korunmuş kalır. Geri/Escape ve yenileme kaydedilmemiş değişiklik korumasını kullanır; dönüşte odak spam kuralının Ayarlar düğmesine gelir. Tüm etiketler ve açıklamalar 34 dilde çevrilmiştir. Ekranın açılması kuralı veya modülü etkinleştirmez.

## Karakter sınırı ayar ekranı

**AutoMod → Karakter sınırı → Ayarlar**, Fluxer'ın ortak başlık/form bileşenlerini, daraltılabilir İzinler/Ek ayarlar bölümlerini ve Vazgeç/Kaydet ve kapat düğmelerini kullanır. Ortak kullanıcı/rol/kanal/kategori kapsamı devralınır; ayrı izin anahtarı açılınca yalnızca bu kuralın dört kapsamı düzenlenir.

**En fazla karakter**, 1–10000 arasında tam sayıdır. Kayıtlı değerler ve yeni ayarlardaki 2000 varsayılanı korunur; referans görseldeki 500 değeri bu alana girilebilir. Sınırla eşit uzunluktaki mesaj kalır; yalnızca sınırı aşan mesaj seçili işlemi tetikler. Oluşturma ve düzenleme aynı denetimi kullanır.

Mesajın kaynak metni Unicode kod noktalarıyla sayılır; boşluklar, satır sonları ve Markdown işaretleri dahildir. Örneğin `😀` bir karakter, `👩‍💻` üç karakterdir; önceden birleşmiş `é` bir, `e` + ayrı aksan işareti iki karakterdir. Bu davranış mevcut denetimde korunur; dosya boyutu bu sınırla ölçülmez. Açıklama alanla `aria-describedby` üzerinden ilişkilendirilir ve 34 dilde çevrilidir.

Vazgeç bu ekran açıldıktan sonraki değişiklikleri geri alır, önceki AutoMod taslağını korur. Kaydet ve kapat bütün AutoMod taslağını sürüm kontrolüyle kaydeder; hata veya çakışmada ekran açık ve taslak korunmuş kalır. Geri/Escape ve yenileme kaydedilmemiş değişiklik korumasını kullanır; dönüşte odak karakter sınırı Ayarlar düğmesine gelir. Ekranın açılması kuralı veya modülü etkinleştirmez. Yeni API, veri şeması veya denetim değişikliği gerekmez.

## Medya spamı ayar ekranı

**AutoMod → Medya spamı → Ayarlar**, ortak Fluxer başlık/form bileşenlerini, daraltılabilir İzinler/Ek ayarlar bölümlerini ve Vazgeç/Kaydet ve kapat düğmelerini kullanır. Ortak kullanıcı/rol/kanal/kategori kapsamı devralınır; ayrı izinler açılınca yalnızca bu kuralın kapsamı düzenlenir.

**Medya sınırı** 1–100, **Süre aralığı (s)** 5–600 arasında tam sayı adımlarıyla ayarlanır. Kayıtlı 100 üstü medya sınırı veya 1–4 saniyelik eski süre daraltılmaz; kaydırıcı eski değeri kapsayacak şekilde açılır. Varsayılan 5 öğe/10 saniye korunur. Sunucu eski ayarlar için 1–10000 öğeyi ve 1–600 saniyeyi kabul etmeye devam eder.

Aynı üyenin kapsamdaki kanallara gönderdiği **dosya ekleri ve çıkartmaların toplamı** sayılır. Tek mesajdaki iki dosya iki öğedir; diğer kapsamdaki kanaldan gönderilen çıkartma aynı sayaçta üçüncü öğe olabilir. Toplam sınıra ulaştığında seçili işlem uygulanır. Düzenlemeler, düz bağlantılar ve emojiler sayacı artırmaz; medya içermeyen mesaj bu kuralı tetiklemez. Süre penceresinin başlangıç sınırındaki ve daha eski öğeler sayılmaz. Mevcut kalıcı sayaç saklama penceresi 600 saniyeyi kapsar; ayrı bir sayaç veya dosya arşivi oluşturulmaz.

Kaydetme mevcut sürüm kontrolüyle tüm AutoMod taslağını kaydeder; çakışmada ekran ve değerler korunur. Vazgeç yalnızca bu ekranın değişikliklerini geri alır, daha önceki modül taslağı kalır. Geri/Escape taslak korumasını ve kurallar listesine dönünce Ayarlar düğmesine odak dönüşünü kullanır. Kaydırıcılar, ortak izin formu ve sayım açıklaması 34 dilde desteklenir.

## Anti Raid ve Anti Nuke ayar ekranları

**AutoMod → Anti Raid/Anti Nuke → Ayarlar** ayrı sayfaları, referans görsellerdeki gibi sadece daraltılabilir **Ek ayarlar** bölümünü gösterir. Ortak Fluxer başlığı ve sayı/anahtar bileşenleri, Geri, Vazgeç ve Kaydet ve kapat kullanılır. Kayıtlı ortak veya kurala özel izin kapsamı değiştirilmez; ortak kapsam ana AutoMod sayfasından yönetilebilir.

**Anti Raid**: Katılım sınırı 1–1000, süre aralığı 1–300 saniye, yeni hesap yaşı 0–365 gündür; hepsi tam sayıdır. 0 tüm hesapların katılımını sayar. Pozitif gün değeri, katılım anında yaşı bu değerden küçük hesapları sayar. Hesap oluşturma zamanı Fluxer kullanıcı kimliğinden alınır; tam yaş sınırındaki, gelecekte oluşturulmuş veya yaş bilgisi bilinmeyen hesaplar pozitif filtrede sayılmaz. Kapsam içindeki katılımlar topluluk genelindeki kalıcı sayaçta birikir; sınırla eşit sayıya ulaşınca seçili işlem uygulanır. Başlangıç zaman sınırındaki katılımlar sayılmaz. Geç gelen olaylar mevcut olay zamanı penceresinde değerlendirilir.

Yeni ayarlarda 7 gün ve mevcut 10 katılım/60 saniye varsayılanı kullanılır. Eski kayıtlarda hesap yaşı alanı yoksa 0 okunur; kullanıcı filtreyi seçene kadar eski tüm-hesap sayımı devam eder. Yeni sayaç örnekleri katılan kişinin kimliğini taşır; eski kimliksiz örnekler pozitif filtreye alınmaz, 0 ayarında sayılabilir. Katılım outbox kayıtları zaten kullanıcı kimliği taşıdığı için bekleyen eski işler okunabilir.

**Anti Nuke**: İşlem sınırı 1–1000, süre aralığı 1–300 saniyedir. Aynı üyenin kaynakta desteklenen topluluk/kanal/rol, atma/yasaklama, bot ve webhook yönetim işlemleri birlikte sayılır. **Yalnızca kayıt modunda başlat** açıkken eşleşme yalnızca işlem geçmişine yazılır; üyeye kısıtlama veya kanal bildirimi uygulanmaz. Kapatıldığında ana AutoMod sayfasında seçilen işlem kullanılır. Ana seçim Kapalı ise bu anahtar kuralı etkinleştirmez; Yalnızca kaydet ise anahtar kapalı olsa da yaptırım uygulanmaz.

Yeni ayarlarda kayıt modu açıktır. Eski kayıtlarda alan yoksa kapalı okunarak mevcut seçili işlem korunur. Kayıtlı eşik/süre ve mevcut 5 işlem/60 saniye varsayılanı korunur; referanstaki 3 işlem/30 saniye girilebilir. Geçici kilitleme topluluk sahibini kısıtlamadan ilgili yönetici hesabının sonraki yönetim işlemlerini engeller. Önceden tamamlanan işlemleri geri almaz; webhook token çağrıları bu kullanıcı karantinasına dahil değildir.

Her iki kural Güvenlik modülünden bağımsızdır; AutoMod ve ilgili kural etkinleştirilip kaydedilmelidir. Kilitleme süresi ana AutoMod sayfasındaki ortak süredir. Sahiplik, sürüm/lease ve operatör durdurma kontrolleri mevcut işleme hattında uygulanır. Yeni tablo, uç veya kalıcı izin değişikliği yoktur. Tüm AutoMod taslağı sürüm kontrolüyle kaydedilir; hata/çakışmada ekran korunur. Geri/Escape taslağı korur, Vazgeç yalnızca bu ekranda yapılan değişiklikleri geri alır; listede odak Ayarlar düğmesine döner. Alanlar ve açıklamalar 34 dilde çevrilir.

## İşlemler ve ayarlar

Mesaj kuralları: Kapalı, Yalnızca kaydet, Üyeyi uyar, Mesajı sil, Mesajı sil + Üyeyi uyar, Zaman aşımı, Mesajı sil + Zaman aşımı. Anti Raid/Anti Nuke: Kapalı, Yalnızca kaydet, Geçici kilitleme. Otomatik atma/ban yoktur.

Yalnızca kaydet geçmişe yazar; mesaj göndermez. Diğer işlemler sistem hesabından bildirim oluşturmayacak bir embed özeti gönderir. Seçili mesaj kanalı yoksa kaynak kanal kullanılır. Katılma/yönetim olayında kaynak kanal olmadığından seçili kanal yoksa yalnızca geçmiş tutulur. Silinen bildirim kanalı için başka kanal seçilmez. Uyarı üyenin Fluxer dilinde gönderilir; mesaj metni kopyalanmaz. Panel, kural ve işlem adları 34 dilde çevrilmiştir. İşlem geçmişi AutoMod sonuçlarını da gösterir.

Zaman aşımı/kilitleme süresi ortaktır: varsayılan 600 saniye, 10–86400 saniye arası. Mevcut Fluxer silme/zaman aşımı servisleri ve izin kontrolleri kullanılır. Mevcut daha uzun zaman aşımı kısaltılmaz. Kilitleme kalıcı kanal izinlerini değiştirmez; süre dolunca geçersizleşir. Sahip politikayı yeniden kaydettiğinde önceki kilitlemeler de geçersizleşir.

Önizleme, kaydedilmiş mesaj içeriği kurallarını sınar; ayar yazmaz, sayaç ilerletmez, mesaj göndermez ve yaptırım uygulamaz. Hız kuralları gerçek olay gerektirir. Taslak değişiklikleri önce kaydedin. Sayfa yükleme ayarları etkinleştirmez. Kaydedilmemiş değişikliklerde mevcut Fluxer koruması kullanılır.

## Çalışma hattı ve sınırlar

Kontrol mesaj kaydından sonra worker’da çalışır: silinene kadar mesaj görülebilir veya bildirime ulaşabilir. Worker kesintisinde sohbet devam eder. Beş dakikadan eski olaylar geç yaptırım oluşturmamak için atlanır. Raid/Nuke’a yol açan ilk işlemler tamamlanmıştır; kilitleme sonraki işlemleri korur. Webhook token’iyle yapılan çağrılar Anti Nuke kullanıcı karantinasına dahil değildir.

Mesaj/üyelik/denetim yazımı ve outbox aynı PostgreSQL işleminde kaydedilir. Tekil kaynak anahtarı, worker lease’i, sınırlı yeniden deneme ve beş saniyelik kurtarma taraması kullanılır. Uyarı kimliği önce saklanır; yeniden denemede mevcut mesaj uzlaştırılır. Sayaçlar süreçler arasında ortak ve eşzamanlı güncellemeye dayanıklıdır; tekrar metinleri SHA-256 özeti olarak saklanır. Sayaçlar 10 dakika, kaynak anahtarları/outbox 7 gün, işlem geçmişi 30 gün, yapılandırma geçmişi 90 gün saklanır. Tamamlanan outbox içeriği temizlenir.

Politika değişirse bekleyen yaptırım atlanır. Sahiplik devrinde yeni sahip ayarı yeniden kaydedene kadar işlem yapılmaz. `NETRCOL_AUTOMATIONS_ENABLED=false` AutoMod’u da durdurur. GET/PUT/önizleme/geçmiş uçları normal üyelere ve botlara kapalıdır.

Yerel kaynak sürümü `Start-Local.ps1 -Build -NoBrowser` ile yüklenir. Normal başlatma hazır imajları kullanır. Hesap ve volume’lar korunur.

## Doğrulama — 6 Ekim 2026

- İzole PostgreSQL üzerinde 36 algılama/yapılandırma/kuyruk testi, gerçek Fluxer API işlemlerinden yaptırıma 15 akış testi ve 7 mevcut wake-up testi geçti. Tam/kısmi eşleşme, eski ayarları okuma, kullanıcı önceliği, kategori/ses kanalı kapsamı, başka topluluk seçimlerinin reddi, silme, uyarı embed’i, zaman aşımı, sahiplik ve Raid/Nuke işlemleri sınandı.
- 40 panel/form testi ve ortak işlem kaynaklarını kullanan Olay kayıtları/atomik yazım için 42 regresyon testi geçti. API/app tam tip kontrolleri, Biome, 34 dil kapsam kontrolü ve strict Lingui derlemesi başarılı. Yasaklı kelime ekranında Enter/virgül, silme, taslak koruma, sürüm çakışması, başarılı kaydetme, ayrı izinler ve odak geri dönüşü sınandı.
- API/worker ve web kaynak imajları yeniden derlendi ve yerel kuruluma uygulandı. HTTP sağlık, discovery, HTML, JavaScript ve CSS kontrolleri geçti. Gateway bu değişiklikte yeniden başlatılmadı.
- `localhost:8088 → Fluxcol → Uygulama ayarları → AutoMod` üzerinden 14 kontrol, üç sütunlu masaüstü liste, kural ayrıntıları, ok tuşu/Enter/Space, Tab/Shift+Tab, Escape, taslak sıfırlama ve kapanış koruması doğrulandı. Önizleme sonucunda AutoMod geçmişi boş kaldı. Mevcut Olay kayıtları ayarları korunmuştur; AutoMod etkinleştirilmedi ve canlı toplulukta yaptırım yapılmadı.
- 390 px mobil görünümde tek sütun ve kural ayrıntıları doğrulandı; form genişliği ve kaydırma genişliği 356 px, sayfa genişliği 390 px ölçüldü. Geçici ekran boyutu geri alındı. Gerçek katılma ve yönetim yaptırım testleri izole test verileriyle yürütüldü; geçici PostgreSQL kaynakları kaldırıldı.

[Masaüstü ekranı](automod-panel.png) · [Mobil ekranı](automod-mobile.png)

Yasaklı kelime ekranı ayrıca yerel Fluxcol topluluğunda doğrulandı: ortak izinleri devralma, ayrı izin anahtarı, kullanıcı ekleme, kanal seçimi, Space ile kapsam seçimi, Enter/virgülle kelime ekleme ve tek tek silme çalıştı. Tab/Shift+Tab sırası, bölüm daraltma, değişmiş taslakta geri dönüş koruması ve vazgeçince Ayarlar düğmesine odak dönüşü sınandı. Deneme taslağı atıldı; canlı ayarlar değiştirilmedi. 390 × 844 mobil görünümde dört izin grubu ve iki kelime listesi erişilebildi, yatay taşma oluşmadı. Masaüstü ekran boyutuna geri dönüldü.

[Yasaklı kelime izinleri](bad-words-permissions.png) · [Kelime listeleri ve örnekler](bad-words-settings.png) · [Mobil yasaklı kelime ekranı](bad-words-mobile.png)

### Tekrarlanan metin ekranı doğrulaması — 6 Ekim 2026

- 44 panel/form testi geçti; yeni dört senaryo, kayıtlı eşik/süreyi yükleme, ortak veya ayrı dört kapsam, diğer kurallardan bağımsız kayıt, sınırlara uyma, sürüm çakışması, geri dönüş koruması ve Vazgeç ile önceki taslağı korumayı sınar. Mevcut yasaklı kelime testleri de geçti. Tam app tip kontrolü, Biome, strict Lingui ve üç çeviri kataloğunun 34 dil kontrolleri başarılı.
- Web kaynak imajı derlendi ve yalnızca `app-proxy` servisine uygulandı. HTTP sağlık/discovery/HTML ve JS/CSS giriş dosyası kontrolleri geçti. API, worker, gateway, ayarlar ve kalıcı volume’lar değiştirilmedi.
- Fluxcol üzerinde Ayarlar düğmesi ayrı ekranı açtı. Space ayrı izinleri etkinleştirdi; tekrar/süre taslağında geri dönüş koruması ve Vazgeç doğrulandı. Eski 3 mesaj/10 saniye değerleri geri geldi; odak Repeated text Ayarlar düğmesine döndü. Tab/Shift+Tab iki sayı alanı arasında doğru ilerledi. Canlı ayarlara kayıt yapılmadı.
- 390 × 844 mobil görünümde dört izin grubu, iki sayı alanı ve eylem düğmeleri erişilebildi. Form ve kaydırma genişliği 356 px; iki eylem düğmesi 172 px ölçüldü, yatay taşma oluşmadı. Geçici ekran boyutu geri alındı.

[Tekrarlanan metin izinleri](repeated-text-permissions.png) · [Tekrar ve süre ayarları](repeated-text-settings.png) · [Mobil görünüm](repeated-text-mobile.png)

### Sunucu davetleri ekranı doğrulaması — 6 Ekim 2026

- 47 panel/form testi ve 61 API/algılama/işleme testi geçti. Ortak URL listesi, harf/protokol/yol farkları, aynı mesajdaki izinli ve izinsiz bağlantılar, eski ayarların okunması, geçersiz adresler, ayrı izinler, taslak koruması, sürüm çakışması ve odak geri dönüşü sınandı. İzole PostgreSQL akışında izinli Fluxer daveti korundu; harf farkıyla eşleşmeyen davet silindi ve tek sistem bildirimi üretildi.
- Tam API/app tip kontrolleri, Biome, strict Lingui ve üç çeviri kataloğunun 34 dil kontrolü geçti. Geçici PostgreSQL container ve ağı kaldırıldı; gerçek Fluxcol ayarlarına yaptırım veya kayıt uygulanmadı.
- Web ve API/worker kaynak imajları derlendi ve yerel kuruluma uygulandı. Sağlık/discovery/HTML ile JavaScript/CSS kontrolleri geçti. Derlemedeki mevcut sekiz CSS sıralama uyarısı sürüyor; derleme başarılıdır. Gateway yeniden başlatılmadı; hesaplar ve volume'lar korundu.
- Fluxcol'da Sunucu davetleri ekranı Enter ile açıldı; başlığa odak geldi. Ortak dört izin grubunun devralınması, Space ile ayrı izin/kapsam seçimi, Enter/virgülle harf büyüklüğünü koruyan URL ekleme, kaldırma, Tab/Shift+Tab, geçersiz adreste kayıt engeli, Geri/Escape taslak koruması ve Vazgeç sonrası Ayarlar düğmesine odak dönüşü doğrulandı. Canlı ayarlara kayıt yapılmadı; AutoMod kapalı kaldı.
- 390 × 844 mobil görünümde dört izin grubu, URL listesi, açıklama, sayaç ve eylem düğmeleri erişilebilir. Form/kaydırma genişliği 356 px, eylem düğmeleri 172 px ölçüldü; 300 karakterli URL öğesiyle de yatay taşma olmadı. Deneme taslağı atıldı ve normal ekran boyutuna dönüldü.

[Sunucu daveti izinleri](server-invites-permissions.png) · [Bağlantı izin listesi](server-invites-settings.png) · [Mobil görünüm](server-invites-mobile.png)

### Dış bağlantılar ekranı doğrulaması — 6 Ekim 2026

- 50 panel/form testi geçti. Yeni üç senaryo dış bağlantı ekranının ortak kapsamı devralmasını, ayrı dört izin grubu kaydını, geçersiz URL ile kayıt engelini, çakışma sonrası taslağı korumayı ve başarılı kayıt sonrası davet ekranında aynı listenin görünmesini sınar. Dış bağlantı değişiklikleri davet izinlerini/alan adı istisnalarını değiştirmez; Vazgeç eski dış bağlantı alan adı listesini ve ortak URL listesini geri getirirken önceki modül taslağını korur.
- Tam app tip kontrolü, Biome, strict Lingui ve üç çeviri kataloğunun 34 dil kontrolü geçti. Yeni API veya veritabanı değişikliği gerekmedi; ortak URL listesinin önceki gerçek filtre davranışı korunur.
- Web kaynak imajı derlendi ve yalnızca `app-proxy` servisine uygulandı. HTTP sağlık/discovery/HTML ve JS/CSS kontrolleri geçti. API, worker ve gateway yeniden başlatılmadı; mevcut ayarlar, hesaplar ve volume'lar korundu.
- Yerel Fluxcol ekranında Enter ile açılış ve başlık odağı, Space ile ayrı izin/kullanıcı/kanal kapsamı, kullanıcı ekleme, gerçek `#general` seçimi, Enter/virgülle URL ekleme, kaldırma, Tab/Shift+Tab, geçersiz adreste kayıt engeli ve Geri/Escape taslak koruması doğrulandı. Vazgeç odağı Dış bağlantılar Ayarlar düğmesine döndürdü; davet ekranında ortak liste eski boş halindeydi. Deneme taslağı kaydedilmedi ve AutoMod kapalı kaldı.
- 390 × 844 mobil görünümde dört izin grubu, URL listesi ve iki eylem düğmesi erişilebilir. Form/kaydırma genişliği 356 px, eylem düğmeleri 172 px; 300 karakterli URL öğesinin genişliği 356 px ölçüldü ve yatay taşma olmadı. Geçici ekran boyutu geri alındı.

[Dış bağlantı izinleri](external-links-permissions.png) · [Bağlantı izin listesi](external-links-settings.png) · [Mobil görünüm](external-links-mobile.png)

### Aşırı büyük harf ekranı doğrulaması — 6 Ekim 2026

- 54 panel/form testi geçti. Yeni dört senaryo kayıtlı eşikleri korumayı, dört izin grubunun devralınmasını/ayrı kaydını, açıklamaların alanlarla erişilebilir bağlantısını, boş/kesirli/sınır dışı değerleri, sürüm çakışmasında taslağın korunmasını, başarılı kayıt ve odağın geri dönmesini sınar. Vazgeç önceki modül taslağını korur; diğer kuralların ayarları değişmez.
- İzole PostgreSQL üzerinde 44 AutoMod yapılandırma/algılama testi, 17 gerçek API akış testi ve 7 wake-up testi geçti. Yeni sınır testleri minimumun yalnızca harfleri saydığını, tam %70’in tetiklenmediğini, Türkçe harflerin değerlendirildiğini ve rakam/emoji/harf büyüklüğü olmayan yazıların sayımı artırmadığını doğrular. Gerçek GET/PUT → mesaj → worker → silme akışında 15/70 kaydı okundu; kısa ve tam sınırdaki mesajlar kaldı, sınırı aşan mesaj silindi.
- Tam app/API tip kontrolleri, Biome, strict Lingui ve üç çeviri kataloğunun 34 dil kontrolü geçti. Yeni üç alan/açıklamayla AutoMod kataloğu 64 metne ulaştı. React bileşenleri mevcut ortak izin/ayar bileşenlerini kullanır; iki alan mevcut şemaya bağlanır, açıklama `aria-describedby` ile ilişkilendirilir.
- Web kaynak imajı derlendi ve yalnızca `app-proxy` servisine uygulandı. HTTP sağlık/discovery/HTML ve JS/CSS kontrolleri geçti. API/worker, gateway ve kalıcı veri servisleri yeniden başlatılmadı; hesaplar, volume'lar ve mevcut 10/70 değerleri korundu. Geçici PostgreSQL kaynakları görev etiketleri doğrulanarak kaldırıldı.
- `localhost:8088 → Fluxcol → Uygulama ayarları → AutoMod → Aşırı büyük harf → Ayarlar` üzerinden Enter ile açılış, Tab/Shift+Tab sırası, Space ile ayrı izin ve kullanıcı/kanal kapsamı, kullanıcı ekleme, %101 değerinde kayıt engeli, Geri/Escape taslak koruması ve Vazgeç sonrası Ayarlar düğmesine odak dönüşü doğrulandı. Canlı ayarlara kayıt veya toplulukta yaptırım yapılmadı; deneme taslağı geri alındı.
- 390 × 844 mobil görünümde dört izin grubu ve iki sayı alanı erişilebilir. Form ve kaydırma genişliği 356 px, iki eylem düğmesi 172 px ölçüldü; sayfa genişliği 390 px, yatay taşma yok. İzinler/Ek ayarlar bölümleri klavyeyle daraltılıp açılır. Geçici ekran boyutu geri alındı ve yeni masaüstü ekranı açık bırakıldı.

[Aşırı büyük harf ayarları](excessive-caps-settings.png) · [Mobil görünüm](excessive-caps-mobile.png)

### Aşırı emoji ekranı doğrulaması — 6 Ekim 2026

- 57 panel/form testi geçti. Üç yeni senaryo kayıtlı sınırı ve ortak izinleri, açıklamanın erişilebilir bağlantısını, boş/kesirli/sınır dışı değerlerin engellenmesini, dört ayrı kapsamın kaydını ve ortak izinlere geri dönüşü doğrular. Sürüm çakışmasında taslak korunur; Vazgeç önceki modül taslağını korur, dönüşte odak doğru Ayarlar düğmesine gelir. Diğer kurallar ve bağlantı izin listesi korunur.
- İzole PostgreSQL üzerinde 51 yapılandırma/algılama, 18 gerçek API akış ve 7 wake-up testi geçti. Aile, ten rengi, bayrak, tuş, statik ve hareketli özel emojiler tek sayılır; sınırın eşitinde işlem uygulanmaz. Gerçek GET/PUT → mesaj → worker → silme akışında 12 sınırı kaydedilip okundu, 12 birleşik emoji içeren mesaj kaldı, 13 emoji içeren mesaj yalnızca bir kez silindi.
- App/API tip kontrolleri, Biome, strict Lingui ve üç çeviri kataloğunun 34 dil kontrolü geçti. İki yeni metinle AutoMod kataloğu 66 metne ulaştı. Yeni ekran mevcut izin/form bileşenlerini ve `aria-describedby` açıklamasını kullanır; yeni API veya veri şeması gerekmez. Geçici PostgreSQL kaynakları görev etiketleri doğrulanarak kaldırıldı.
- Web kaynak imajı derlenip yalnızca `app-proxy` servisine uygulandı. HTTP sağlık/discovery/HTML ve JS/CSS kontrolleri geçti. Kalıcı servisler ve hesap/volume'lar korundu.
- `localhost:8088 → Fluxcol → Uygulama ayarları → AutoMod → Aşırı emoji → Ayarlar` üzerinden Enter ile açılış, Tab/Shift+Tab sırası, Space ile ayrı izin/kullanıcı kapsamı, kullanıcı ekleme, 10001 değerinde kayıt engeli, 12 değerinde geçerlilik, Geri/Escape taslak koruması ve Vazgeç sonrası odak dönüşü doğrulandı. Canlı ayarlara kayıt veya yaptırım yapılmadı; mevcut sınır 10, modül ve tüm kurallar kapalı kaldı.
- 390 × 844 mobil görünümde dört izin grubu ve emoji sınırı erişilebilir. Bölümler Space ile daraltılıp açıldı; form/kaydırma genişliği 356 px, eylem düğmeleri 172 px ve sayfa genişliği 390 px ölçüldü, yatay taşma yok. Geçici ekran boyutu geri alındı; temiz masaüstü ayar ekranı açık bırakıldı.

[Aşırı emoji ayarları](excessive-emojis-settings.png) · [İzinler](excessive-emojis-permissions.png) · [Mobil görünüm](excessive-emojis-mobile.png)

### Aşırı spoiler ekranı doğrulaması — 6 Ekim 2026

- 60 panel/form testi geçti. Emoji ve spoiler ekranları aynı üç senaryo grubunda ayrı ayrı sınanır: kayıtlı sınır/ortak izinler, erişilebilir açıklama, taslak koruması ve yalnızca bu kuralın değişikliklerini geri alma; geçersiz değerler, çakışma, dört ayrı kapsamı sürümle kaydetme ve ortak izinlere geri dönüş. İki kuralın değerleri birbirini değiştirmez; önceki modül taslağı ve odak dönüşü korunur.
- İzole PostgreSQL üzerinde 57 yapılandırma/algılama, 19 gerçek API akış ve 7 wake-up testi geçti. Beş tamamlanmış spoiler bölümü tetiklenmez; altı bölüm tetiklenir. Çok satırlı bölümler tek sayılır, boş bölümler sayılır, tamamlanmamış bölüm sayılmaz; oluşturma ve düzenleme aynı sınırı kullanır. Gerçek GET/PUT → mesaj → worker akışında 7 sınırı kaydedilip okundu, 7 bölümlü mesaj kaldı, 8 bölümlü mesaj silindi. Korunan mesaj 8 bölüme düzenlenince o da silindi; tekrar worker çalıştırması ikinci teslimat üretmedi.
- App/API tip kontrolleri, Biome, strict Lingui ve üç çeviri kataloğunun 34 dil kontrolü geçti. İki yeni metinle AutoMod kataloğu 68 metne ulaştı. Yeni ekran mevcut ortak form/izin bileşenlerini ve `aria-describedby` açıklamasını kullanır; API, veri şeması ve algılama mantığı değişmedi. Geçici PostgreSQL kaynakları görev etiketleri doğrulanarak kaldırıldı.
- Web kaynak imajı derlenip yalnızca `app-proxy` servisine uygulandı. HTTP sağlık/discovery/HTML ve JS/CSS kontrolleri geçti; kalıcı servisler, hesaplar ve Docker volume'ları korundu.
- `localhost:8088 → Fluxcol → Uygulama ayarları → AutoMod → Aşırı spoiler → Ayarlar` üzerinden Enter ile açılış, Tab/Shift+Tab sırası, Space ile ayrı izin/kullanıcı kapsamı ve kullanıcı ekleme doğrulandı. 0 değerinde Kaydet ve kapat devre dışı, 7 değerinde kullanılabilir; Geri/Escape kaydedilmemiş taslağı korur. Vazgeç sonrası odak ilgili Ayarlar düğmesine döner. Deneme taslağı geri alındı; canlı yapılandırmaya kayıt veya yaptırım yapılmadı, kayıtlı sınır 5 kaldı.
- 390 × 844 mobil görünümde form ve kaydırma genişliği 356 px, iki eylem düğmesi 172 px, sayfa ve kaydırma genişliği 390 px ölçüldü; yatay taşma yok. İzinler/Ek ayarlar bölümleri Space ile daraltılıp açıldı. Geçici ekran boyutu geri alındı ve temiz masaüstü ekranı açık bırakıldı.

[Aşırı spoiler ayarları](excessive-spoilers-settings.png) · [İzinler](excessive-spoilers-permissions.png) · [Mobil görünüm](excessive-spoilers-mobile.png)

### Aşırı etiketleme ekranı doğrulaması — 6 Ekim 2026

- 63 panel/form testi geçti. Emoji, spoiler ve etiketleme ekranları aynı üç senaryo grubunda ayrı ayrı sınanır: kayıtlı sınır/ortak izinler, erişilebilir açıklama, taslak koruması ve yalnızca bu kuralın değişikliklerini geri alma; geçersiz değerler, sürüm çakışması, dört ayrı kapsamın kaydı ve ortak izinlere dönüş. Diğer sayım kuralları ve önceki modül taslağı korunur.
- İzole PostgreSQL üzerinde 65 yapılandırma/algılama, 20 gerçek API akış ve 7 wake-up testi geçti. Kullanıcı/rol etiketleri, `@everyone`, `@here`, takma ad biçimi, tekrarlar ve etiket sayılmayan metinler oluşturma/düzenleme için sınanır. Varsayılan 5 sınırında 5 farklı etiket korunur, 6 tetikler. Gerçek GET/PUT → mesaj → worker akışında 7 sınırı kaydedilip okundu; tekrarlarla birlikte 7 farklı etiketli mesaj kaldı, 8 farklı etiketli mesaj silindi. Korunan mesaj 8 farklı etikete düzenlenince o da bir kez silindi; worker tekrarı ikinci teslimat üretmedi.
- App/API tip kontrolleri, deponun Biome kontrolü, strict Lingui ve üç çeviri kataloğunun 34 dil kontrolü geçti. İki yeni metinle AutoMod kataloğu 70 metne ulaştı. Yeni ekran mevcut form/izin bileşenlerini kullanır; API, veri şeması ve algılama mantığı değişmedi. Görev etiketi doğrulanan geçici PostgreSQL ve test ağı temizlendi.
- Web kaynak imajı derlenip yalnızca `app-proxy` servisine uygulandı. HTTP sağlık/discovery/HTML ve JS/CSS kontrolleri geçti; kalıcı servisler, hesaplar ve Docker volume'ları korundu.
- `localhost:8088 → Fluxcol → Uygulama ayarları → AutoMod → Aşırı etiketleme → Ayarlar` üzerinden Enter ile açılış, Tab/Shift+Tab sırası, Space ile ayrı izin/kullanıcı kapsamı ve kullanıcı ekleme doğrulandı. 10001 değerinde Kaydet ve kapat devre dışı, 7 değerinde kullanılabilir; Geri/Escape kaydedilmemiş taslağı korur. Vazgeç sonrası odak ilgili Ayarlar düğmesine döner. Canlı ayarlara kayıt/yaptırım yapılmadı; deneme taslağı geri alındı, kayıtlı sınır 5 kaldı.
- 390 × 844 mobil görünümde form/kaydırma genişliği 356 px, eylem düğmeleri 172 px, sayfa/kaydırma genişliği 390 px ölçüldü; yatay taşma yok. İzinler/Ek ayarlar bölümleri Space ile daraltılıp açıldı. Geçici ekran boyutu geri alındı ve temiz masaüstü ekranı açık bırakıldı.

[Aşırı etiketleme ayarları](excessive-mentions-settings.png) · [İzinler](excessive-mentions-permissions.png) · [Mobil görünüm](excessive-mentions-mobile.png)

### Zalgo ekranı doğrulaması — 6 Ekim 2026

- 66 panel/form testi geçti. Üç yeni Zalgo senaryosu yalnızca izinlerden oluşan ekranı, ortak dört kapsamı, odak dönüşünü ve yazma isteği olmadan açılışı; taslak/yenileme korumasını ve yalnızca bu kuralı geri almayı; dört kapsamın sürümle kaydını, çakışmada taslak korumasını ve ortak izinlere dönüşü doğrular. Kayıtlı 7 hassasiyeti ve diğer kurallar korunur.
- İzole PostgreSQL üzerinde 74 yapılandırma/algılama, 21 gerçek API akış ve 7 wake-up testi geçti. Dokuz yeni sayım örneği normal aksanları, ayrı işaret gruplarını, emoji dizilerini, Hintçe/Arapça metni ve ek Unicode düzlemindeki birleştirme işaretlerini oluşturma/düzenleme için sınar. Varsayılan 3 sınırında 3 ardışık işaret korunur, 4 tetikler. Gerçek GET/PUT → mesaj → worker akışında özel kullanıcı/kanal kapsamı ve 5 hassasiyeti korunur; 5 işaretli mesaj kalır, 6 işaretli mesaj silinir. Düzenlenen mesaj da bir kez silinir; normal aksanlı mesaj kalır, worker tekrarı ikinci teslimat üretmez.
- App/API tip kontrolleri, deponun Biome kontrolü, strict Lingui ve üç çeviri kataloğunun 34 dil kontrolü geçti. Ekran mevcut 70 AutoMod metnini ve ortak izin çevirilerini kullanır; yeni API, veri şeması veya algılama değişikliği gerekmez. Görev etiketi doğrulanan geçici PostgreSQL ve test ağı temizlendi.
- Web kaynak imajı derlenip yalnızca `app-proxy` servisine uygulandı. HTTP sağlık/discovery/HTML ve JS/CSS kontrolleri geçti; kalıcı servisler, hesaplar ve Docker volume'ları korundu.
- `localhost:8088 → Fluxcol → Uygulama ayarları → AutoMod → Zalgo → Ayarlar` üzerinden Enter ile açılış, Tab/Shift+Tab sırası, Space ile ayrı izin/kullanıcı kapsamı ve kullanıcı ekleme doğrulandı. Geri/Escape kaydedilmemiş taslağı korur; Vazgeç sonrası odak Zalgo Ayarlar düğmesine döner. Deneme taslağı geri alındı; canlı yapılandırmaya kayıt veya yaptırım yapılmadı.
- 390 × 844 mobil görünümde form/kaydırma genişliği 356 px, eylem düğmeleri 172 px, sayfa/kaydırma genişliği 390 px ölçüldü; yatay taşma yok. İzinler bölümü Space ile daraltılıp açıldı; alt kategori alanına kaydırılarak erişildi. Geçici ekran boyutu geri alındı ve temiz masaüstü ekranı açık bırakıldı.

[Zalgo ayarları](zalgo-settings.png) · [Mobil görünüm](zalgo-mobile.png)

### Spam koruması ekranı doğrulaması — 6 Ekim 2026

- 69 panel/form testi geçti. Üç yeni Anti-spam senaryosu kayıtlı 250 mesaj/456 saniye değerlerinin değiştirilmeden okunmasını, ortak dört kapsamı ve odak dönüşünü; kaydırıcı taslağı/yenileme korumasını ve yalnızca bu ekranı geri almayı; 1 ve 100 mesaj ile 1 ve 600 saniye sınırlarını, dört ayrı kapsamın sürümle kaydını, çakışmada taslak korumasını ve ortak izinlere dönüşü doğrular. Diğer 13 kural ve önceki modül taslağı korunur.
- İzole PostgreSQL üzerinde 84 yapılandırma/algılama, 22 gerçek API akış ve 7 wake-up testi geçti. Anti-spam için 600 saniye kabul edilir, kesirli/sınır dışı süre reddedilir; diğer kuralların 300 saniye sınırı ve önceki 1000 mesaj sınırı korunur. Beş dakikadan eski fakat on dakikalık pencere içindeki sayaç örneği tutulur; tam sınırdaki ve süresi geçmiş örnekler, düzenlemeler ve başka kuralın kapsam örnekleri sayılmaz. Gerçek GET/PUT → mesaj → worker akışında 3 mesaj/600 saniye ve özel kullanıcı/kanal kapsamı kaydedilip okundu; iki seçili kanaldaki gönderimler birlikte sayıldı. Kapsam dışı mesaj ve düzenleme sayacı artırmadı; üçüncü yeni mesaj bir kez silindi ve bir sistem embed'i gönderildi, worker tekrarı ikinci teslimat üretmedi.
- App/API tip kontrolleri, Biome, strict Lingui ve üç çeviri kataloğunun 34 dil kontrolü geçti. AutoMod kataloğu iki yeni etiket/açıklamayla 72 metne ulaştı. Mevcut Fluxer kaydırıcısı ve ortak form/izin bileşenleri kullanılır. Yeni API veya tablo yoktur; yalnızca Anti-spam süre sınırı ve mevcut sayaç örnek penceresi genişletildi. Görev etiketi doğrulanan geçici PostgreSQL konteyneri ve test ağı temizlendi.
- Web ve API kaynak imajları derlenip `api`, `worker` ve `app-proxy` servislerine uygulandı; üç servis de sağlıklı. HTTP sağlık/discovery/HTML ve JS/CSS kontrolleri geçti. Gateway, kalıcı servisler, hesaplar ve Docker volume'ları korundu.
- `localhost:8088 → Fluxcol → Uygulama ayarları → AutoMod → Anti-spam → Ayarlar` üzerinden Enter ile açılış, Tab/Shift+Tab sırası, Space ile ayrı izinler ve bölüm açma/kapama doğrulandı. Kaydırıcılar Home/End ile 1–100 mesaj ve 1–600 saniye sınırlarına, yön tuşlarıyla birer adımlık değerlere ulaşır. Geri/Escape taslağı korur; Vazgeç sonrası odak Anti-spam Ayarlar düğmesine döner. Deneme taslakları geri alındı; canlı yapılandırmaya kayıt veya yaptırım yapılmadı. Kayıtlı 5 mesaj/10 saniye ve ortak izinler korundu.
- 390 × 844 mobil görünümde sayfa/kaydırma genişliği 390 px, form/kaydırma genişliği 356 px ve eylem düğmeleri 172 px ölçüldü; yatay taşma yok. Ek ayarlar Space ile daraltılıp açıldı; mesaj kaydırıcısı yön tuşlarıyla 5 → 6 → 5 değiştirildi. Geçici ekran boyutu geri alındı ve temiz masaüstü ekranı açık bırakıldı.

[Anti-spam ayarları](anti-spam-settings.png) · [İzinler](anti-spam-permissions.png) · [Mobil görünüm](anti-spam-mobile.png)

### Karakter sınırı ekranı doğrulaması — 6 Ekim 2026

- 72 panel/form testi geçti. Karakter sınırı için üç yeni senaryo kayıtlı 500 değerinin okunmasını ve ortak dört kapsamı; taslak/yenileme koruması, odak dönüşü ve yalnızca bu ekranı geri alırken önceki modül taslağını korumayı; boş/kesirli/sınır dışı değerlerle kayıt engelini, 1/10000 sınırlarını, dört ayrı kapsamın sürümle kaydını, çakışmada taslak korumasını ve ortak izinlere dönüşü doğrular. Diğer kurallar ve 2000 varsayılanı korunur.
- İzole PostgreSQL üzerinde 103 yapılandırma/algılama, 23 gerçek API akış ve 7 wake-up testi geçti. Yeni örnekler 500/501 ASCII ve emoji, boşluk/satır sonu, birleşik/ayrı aksan, birleşik emoji ve Markdown kaynak metnini oluşturma/düzenlemede sınar. Gerçek GET/PUT → mesaj → worker akışında 500 sınırı ve dört özel kapsam okundu; tam 500 emojilik mesaj kaldı, 501 karakterlik yeni mesaj ve düzenleme birer kez silindi. Kapsam dışındaki mesaj korundu; açık kullanıcı seçimi rol istisnasından öncelikliydi. İki Netrcol sistem bildirimi ve iki işlem geçmişi kaydı oluştu; worker tekrarı ikinci teslimat üretmedi.
- App/API tip kontrolleri, Biome, strict Lingui ve üç çeviri kataloğunun 34 dil kontrolleri geçti. AutoMod kataloğu iki yeni etiket/açıklamayla 74 metne ulaştı. Doğrudan bileşen import'ları, mevcut ortak form/izin bileşenleri ve sabit `useId` bağlantısı kullanılır; ek veri isteği veya türetilmiş state/effect yoktur. Yeni API, tablo veya denetim değişikliği gerekmez. Etiketleri doğrulanan geçici test PostgreSQL konteyneri ve ağı temizlendi.
- Web kaynak imajı derlendi ve yalnızca `app-proxy` servisine uygulandı. HTTP sağlık/discovery/HTML ve JS/CSS kontrolleri geçti. API, worker, gateway, hesaplar, kayıtlı ayarlar ve Docker volume'ları korundu.
- `localhost:8088 → Fluxcol → Uygulama ayarları → AutoMod → Karakter sınırı → Ayarlar` üzerinden Enter ile açılış ve başlık odağı, Tab/Shift+Tab eylem/alan sırası, Space ile ayrı izin/kullanıcı kapsamı, kullanıcı ekleme ve bölüm açma/kapama doğrulandı. 10001 değerinde Kaydet ve kapat devre dışı, 500 değerinde kullanılabilir; yön tuşuyla 500 → 501 adımı çalışır. Geri/Escape taslağı korur; Vazgeç sonrası odak Ayarlar düğmesine döner. Deneme değişiklikleri geri alındı; canlı ayarlara kayıt veya yaptırım uygulanmadı. Kayıtlı 2000 ve ortak izinler korundu.
- 390 × 844 mobil görünümde sayfa/kaydırma genişliği 390 px, form/kaydırma genişliği 356 px ve eylem düğmeleri 172 px ölçüldü; yatay taşma yok. Ek ayarlar Space ile daraltılıp açıldı; sayı alanı yön tuşlarıyla 2000 → 1999 → 2000 değiştirildi. Geçici ekran boyutu geri alındı ve temiz masaüstü ekranı açık bırakıldı.

[Karakter sınırı ayarları](character-limit-settings.png) · [İzinler](character-limit-permissions.png) · [Mobil görünüm](character-limit-mobile.png)

### Medya spamı ekranı doğrulaması — 6 Ekim 2026

- 75 panel/form testi geçti. Spam ve medya spamı aynı parametreli senaryolarla sınandı: kayıtlı yüksek sınır ve kısa eski süre korunur, devralınan dört kapsam okunur, taslak/yenileme koruması ve yalnızca ekran taslağını geri alma çalışır. 1/100 öğe ve 5/600 saniye sınırları, dört özel kapsamın sürümle kaydı, çakışmada taslağın korunması ve ortak izinlere dönüş doğrulandı. Diğer 13 kural korunur.
- İzole PostgreSQL üzerinde 112 yapılandırma/algılama, 24 gerçek API akış ve 7 wake-up testi geçti. Medya spamında 600 saniyelik pencere, 1–4 saniyelik eski değerler ve 10000 öğelik eski sınır kabul edilir; kesirli/sınır dışı süre reddedilir. Penceredeki medya öğeleri birlikte sayılır; başlangıç sınırındaki öğeler, düzenlemeler ve başka kuralın örnekleri dışlanır. Gerçek GET/PUT → dosya yükleme/çıkartma gönderme → worker akışında 3 öğe/600 saniye ve özel kullanıcı/kanal kapsamı kaydedilip okundu. İki dosya ekinden sonra ikinci seçili kanaldaki çıkartma sınırı doldurdu ve mesaj bir kez silindi. Düzenleme, düz bağlantı/emoji ve kapsam dışındaki çıkartma sayacı artırmadı. Bir Netrcol sistem embed'i ve bir işlem geçmişi kaydı oluştu; worker tekrarı ikinci teslimat üretmedi.
- App/API tip kontrolleri, Biome, strict Lingui ve üç çeviri kataloğunun 34 dil kontrolleri geçti. AutoMod kataloğu medya sınırı ve sayım açıklamasıyla 76 metne ulaştı. Doğrudan bileşen import'ları, mevcut ortak form/izin bileşenleri ve native Slider kullanılır; eski aralıkları koruyan ilk açılış değerleri sabittir. Yeni API, tablo veya olay üreticisi yoktur. Etiketleri doğrulanan geçici test PostgreSQL konteyneri ve ağı temizlendi.
- API/worker ve web kaynak imajları derlenip yerel servislere uygulandı. Servis sağlıkları, HTTP/discovery/HTML ve giriş JS/CSS kontrolleri geçti. Gateway, hesaplar, kayıtlı ayarlar ve Docker volume'ları korundu.
- `localhost:8088 → Fluxcol → Uygulama ayarları → AutoMod → Medya spamı → Ayarlar` üzerinden Enter ile açılış ve başlık odağı, Tab/Shift+Tab eylem sırası, Space ile ayrı izin/kullanıcı kapsamı ve kullanıcı ekleme doğrulandı. Home/End, medya kaydırıcısında 1/100 ve süre kaydırıcısında 5/600 sınırlarına ulaştı. Geri/Escape taslağı korudu; Vazgeç sonrası odak Ayarlar düğmesine döndü. Yeniden açılışta kayıtlı 5/10 ve ortak izinler korundu. Deneme değişiklikleri geri alındı; canlı ayarlara kayıt veya yaptırım uygulanmadı.
- 390 × 844 mobil görünümde sayfa/kaydırma genişliği 390 px, form/kaydırma genişliği 356 px ve eylem düğmeleri 172 px ölçüldü; yatay taşma yok. Ek ayarlar Space ile daraltılıp açıldı; medya kaydırıcısı yön tuşlarıyla 5 → 6 → 5, süre Home ile 5 saniyeye değiştirildi. Taslak geri alındı, geçici ekran boyutu sıfırlandı ve temiz masaüstü ekranı açık bırakıldı.

[Medya spamı ayarları](media-spam-settings.png) · [İzinler](media-spam-permissions.png) · [Mobil görünüm](media-spam-mobile.png)

### Anti Raid / Anti Nuke doğrulaması — 6 Ekim 2026

- 80 panel/form testi geçti. İki sayfada kayıtlı alanlar, başlık odağı, izin bölümünün gösterilmemesi, temiz dönüşte düğme odağı, boş/kesirli/sınır dışı sayıların reddi, yaş için 0/365 ve eşik/süre için 1/1000–1/300 sınırları sınandı. Geri/yenileme koruması, yalnızca detay taslağını geri alma, sürüm çakışmasında değerleri koruma ve başarılı kayıt doğrulandı. Devre dışı kurallar, diğer 13 kural, ortak/özel izinler ve bağlantı listesi korunur.
- İzole PostgreSQL üzerinde 126 yapılandırma/algılama/kuyruk, 24 gerçek API akış ve 7 wake-up testi geçti. Eski alanları olmayan ayarlar 0 gün/kayıt modu kapalı okunur; yeni ayarların 7 gün/kayıt modu açık tercihleri kuralları etkinleştirmez. Yaş, katılım anında ölçülür; eşit sınır, eski/gelecek/bilinmeyen hesap, başka kural, pencere başlangıcı ve geç gelen olaylar sınandı.
- Gerçek GET/PUT → iki genç hesabın davetle katılması → kalıcı kullanıcı kimliği taşıyan sayaç → worker akışında bir kilitleme, bir geçmiş kaydı ve bir Netrcol bildirimi oluştu. Sonraki üye mesajı/katılım engellendi, sahip kurtarma işlemi yapabildi. Gerçek yönetici kanal oluşturma dalgası, kayıt modu açıkken bir gözlem kaydı üretti; bildirim/karantina oluşmadı ve sonraki işlem sürdü. Aynı ayar kayıt modu kapatılıp sürümle kaydedilince yeni dalga bir yaptırım kaydı/bildirim üretti ve yöneticinin sonraki işlemi engellendi. Worker tekrarı ikinci sonuç oluşturmadı.
- App/API tip kontrolleri, Biome, strict Lingui ve üç çeviri kataloğunun 34 dil kontrolleri geçti. AutoMod kataloğu 84 metindir. Doğrudan import'lar ve ortak Fluxer form bileşenleri kullanılır; türetilmiş durum için ek effect/veri isteği yoktur. Etiketleri doğrulanan geçici test PostgreSQL ve ağı temizlendi.
- API/worker ve web kaynak imajları derlenip yerel servislere uygulandı. Servis sağlıkları, HTTP/discovery/HTML ve giriş JS/CSS kontrolleri geçti. Gateway, hesaplar, volume'lar ve topluluk ayarları korundu.
- `localhost:8088 → Fluxcol → Uygulama ayarları → AutoMod → Anti Raid/Anti Nuke → Ayarlar` üzerinden Enter ile açılış/başlık odağı, Tab/Shift+Tab eylem sırası ve Space ile bölümü daraltıp açma doğrulandı. Anti Raid boş/366 günü reddetti, 0 günü kabul etti. Anti Nuke kayıt anahtarı Space ile değişti ve 3 işlem/30 saniye girilebildi. Geri/Escape taslağı korudu, Vazgeç listede Ayarlar düğmesine odağı döndürdü; tekrar açılış kayıtlı 10/60/7 ve 5/60/kayıt açık değerleri gösterdi. Deneme taslakları geri alındı; canlı ayara kayıt veya yaptırım uygulanmadı.
- İki ekran 390 × 844 mobil görünümde doğrulandı: sayfa/kaydırma genişliği 390 px, form/kaydırma genişliği 356 px, eylem düğmeleri 172 px; yatay taşma yok. Sayı alanı yön tuşlarıyla 5 → 6 → 5 değişti; bölüm Space ile açılıp kapandı. Geçici ekran boyutu sıfırlandı ve temiz Anti Nuke masaüstü sayfası açık bırakıldı.

[Anti Raid ayarları](anti-raid-settings.png) · [Anti Nuke ayarları](anti-nuke-settings.png) · [Anti Raid mobil](anti-raid-mobile.png) · [Anti Nuke mobil](anti-nuke-mobile.png)
