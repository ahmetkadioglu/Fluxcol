# Ortak modül ayarları

**Uygulama ayarları → Modül ayarları → Netrcol mesaj dili**, topluluğun Netrcol olay kayıtları ve AutoMod bildirimleri için ortak dilini belirler. 34 dil desteklenir. Alan adları ve açıklamalar kişisel arayüz dilinde görünür; bu tercih kişisel arayüz dilini değiştirmez.

Self-hosted PostgreSQL kurulumunda yalnızca mevcut topluluk sahibi okuyabilir ve kaydedebilir. Seçimi değiştirip **Değişiklikleri kaydet** düğmesini kullanın. **Sıfırla** kaydedilen değere döner. Kaydedilmemiş değişiklik koruması, klavye ve mobil düzen mevcut ayar ekranını kullanır.

Yükseltmede ortak ayar henüz kaydedilmemişse mevcut olay kayıtlarının dili okunur. Fluxcol'un Türkçe dili korunur. Önceki kayıt ayarı bulunmayan yeni topluluklar İngilizce (ABD) kullanır. Topluluklar birbirinden bağımsızdır; sayfayı açmak kendiliğinden kayıt veya otomasyon etkinleştirmesi yapmaz.

Kaydetme sürüm kontrolüyle yapılır ve **İşlem geçmişi** içinde görünür. Çakışmada taslak korunur; **Yenile** güncel kaydı alır. Dil değişikliği, olay kayıtları ve AutoMod politikalarının sürümünü/onayını değiştirmez; sahiplik devrinde duraklayan modülleri yeniden etkinleştirmez.

Yeni bildirimler ve henüz teslim edilmemiş olay kayıtları teslim anındaki ortak dili kullanır. Daha önce kanala gönderilmiş mesajlar yeniden yazılmaz. AutoMod bildirim dili hedef üyenin kişisel hesap dilinden bağımsızdır.

API: `GET/PUT /guilds/:guild_id/application-settings/modules`. PUT gövdesi `message_language` ve `revision` taşır. Ortak ayar mevcut PostgreSQL uygulama ayarları tablosunda saklanır; yeni tablo veya volume sıfırlaması gerekmez. Eski olay kayıtları API'sinin dil alanı geriye uyumluluk için okunabilir; ortak tercih kaydedildikten sonra ortak dil önceliklidir.

Çeviri doğrulaması: `node netrcol/scripts/module-settings-i18n.mjs --check`.

## Doğrulama

API ve uygulama tip kontrolleri, strict Lingui, Biome ve 34 dil kontrolü geçti. İzole PostgreSQL üzerinde ortak ayarlar, gerçek AutoMod API/mesaj akışı, olay kuyruğu/teslimatı ve mevcut katalog testlerinden 241 test; panelde kaydetme, sıfırlama, sürüm çakışması, erişim kaybı ve kaydedilmemiş değişiklikler dahil 86 test geçti. Mevcut Türkçe ayardan yükseltme, toplulukların ayrı tercihleri, sahiplik devrinde onayın yenilenmemesi, eski panelden kayıt ve bekleyen mesajın yeni dilde teslimatı ayrıca sınandı.

Web/API/worker kaynak imajları yerelde derlenip çalıştırıldı; servis sağlık ve HTTP/JS/CSS kontrolleri geçti. `localhost:8088 → Fluxcol → Uygulama ayarları → Modül ayarları` üzerinden 34 seçenek, klavyeyle dil seçimi/kaydetme, kaydedilmemiş değişiklik uyarısı, yeniden yükleme ve işlem geçmişi doğrulandı. 390 px mobil görünümde yatay taşma oluşmadı. Canlı kaydetme denemesinin ardından dil Türkçeye döndürülüp yeniden yüklemede korunduğu doğrulandı; kişisel arayüz İngilizce kaldı.
