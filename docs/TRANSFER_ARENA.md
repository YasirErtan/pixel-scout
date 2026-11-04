# Transfer Arenası

Çevrimiçi oyun kuralları, yerel geliştirme ve sunucu kurulum rehberi.

3–6 kişi ayrı cihazlardan aynı altı haneli odaya katılır. Her takım 200 krediyle 1 kaleci, 2 savunmacı, 2 orta saha, 2 forvet ve 1 teknik direktör alır. Pazar 7N benzersiz futbolcu ve N benzersiz hocadan oluşur. Yalnızca açık kart ve geçmiş kartlar gösterilir. Futbolcuların ardından hocaların ihalesi başlar.

Pazarda 2N adet 88+, 3N adet 82–87, N adet 76–81 ve N adet 70–75 kart vardır. 82+ oranı 5/7, yaklaşık%71'dir. Takım başına reyting kotası yoktur. Her kartta60saniye gizli teklif penceresi vardır; teklifler en az1kredi, tam sayıdır. Her takım yalnız bir teklif veya pas kararı kilitler; kilitli karar değiştirilemez. Teklif verebilen herkes kilitleyince süre beklenmeden sonuç açılır. Süre sonundaki en yüksek teklif, kendi teklif ettiği bedelle kazanır. Eşit en yüksek teklifler, önceden sunucuda belirlenen gizli kura sırasıyla çözülür; ilk gönderen avantajı yoktur. Süre bitmeden başka teklifler, teklif verenler ve kura sırası açıklanmaz. Sonuç8saniyelik ayrı ekranda bütün takımların teklif/pas/süre aşımı bilgisi ve kazananla gösterilir; transfer geçmişinde de saklanır. Her boş yer için1kredi korunur. Teklifsiz kartlar aynı dönüşümlü pas havuzu kurallarıyla1krediye boş mevkilere dağıtılır; hangi kartın hangi takıma gittiği ayrı listelenir. Hocada destek kredisi yoktur.

Gizli taktikler: dört diziliş, kısa pas/kanat/direkt/kontra oyun tarzları, pres, risk, tempo, genişlik ve dört müdahale seviyesi. Yoğun oyun enerji tüketir. Sertlik top kazanmayı ve faul riskini birlikte artırır. İki sarı veya doğrudan kırmızı oyuncuyu maçtan çıkarır. Kaleci atılırsa bir saha oyuncusu geçici kaleci olur. Dört kişiden aza düşen takım hükmen kaybeder. Kart ve enerji yeni maçta sıfırlanır; devrede küçük toparlanma vardır. Simülasyon katsayıları oyun tasarımıdır, gerçek maç olasılıkları ölçümü değildir.

Tek devre tarafsız lig: galibiyet 3, beraberlik 1 puan. Sıra puan, averaj, gol, galibiyet, eşitlerin kendi arasındaki mini lig ve son olarak açıklanan sabit tohumlu kura ile belirlenir. İlk iki final oynar. Normal maç 2×45, uzatma 2×15 oyun dakikasıdır; final hâlâ eşitse üçer penaltı ve ani ölüm uygulanır. Penaltılar normal skor ve şut istatistiklerine eklenmez.

## Yerel geliştirme

`node scripts/serve-arena.mjs` ile `http://127.0.0.1:4174/games/transfer-arenasi/` açılır. Bu sunucu odaları yalnız bellekte tutar; kapanınca kaybolur. Üretimde kullanılan bir alternatif depolama değildir. `npm run check` tüm kontrolleri çalıştırır.

## Sunucu sözleşmesi

`POST /api/transfer-arena`, aynı kaynaklı JSON istekleri kabul eder. Tarayıcı rastgele, HttpOnly ve Secure oturum çerezi alır; sunucu bundan üye kimliği üretir. İstek türleri create/join/poll/ready/start/bid/pass/plan/speed. Her komutta benzersiz requestId gerekir. bid/pass için lotId; plan için phaseVersion gerekir. Taktik sürümü ağ yoklamalarından bağımsızdır. Oda 24 saat sonra kullanıma kapanır. IP başına istek ve oda oluşturma sınırı uygulanır. Kapanan kayıtların fiziksel temizliği ayrıca bakım görevi gerektirir.

Üretim ortamı değişkenleri yalnız sunucuda: `ARENA_SERVICE_ACCOUNT`, `ARENA_FIREBASE_API_KEY`, `ARENA_DATABASE_URL`. Kimlik, proje IAM rolü olmayan özel bir servis hesabının imzaladığı Firebase Auth custom token ile `transfer-arena-server` kullanıcısına giriş yapar. Bu kimlik yalnız `transfer_arena_v1` altında yetkilendirilmelidir. Mevcut oyunların kuralları korunur. Kimlik dosyasını veya özel anahtarı depoya koyma. Ayrıntılar: [custom tokens](https://firebase.google.com/docs/auth/admin/create-custom-tokens), [REST auth](https://firebase.google.com/docs/reference/rest/auth), [ETag kayıtları](https://firebase.google.com/docs/database/rest/save-data#section-conditional-requests).

Depolama bütün odayı ETag koşullu yazmayla atomik günceller. Çakışma taze durumla yeniden denenir. Açılmamış pazar, simülasyon tohumu ve rakibin taktikleri publicView dışındadır. İstemci bütçe, maç sonucu veya futbolcu özelliği göndermez; bunları sunucu belirler. Süreler istemci saatine güvenmez. Poll yalnız kalan olayları gösterir; gelecek golleri ve penaltı sonuçlarını açıklamaz.

## Teknik direktör kartları

Havuz 24 gerçek teknik direktörden oluşur. Fatih Terim 5, Okan Buruk 4 ve Emre Belözoğlu 2 yıldızdır. Ek 1 yıldızlı hocalar Frank de Boer ve Steven Gerrard; ek 2 yıldızlı hocalar Sergen Yalçın ve İsmail Kartal'dır. Tüm yıldızlar ve uzmanlıklar oyun tasarımıdır.

3–5 kişilik odalarda her yıldız seviyesinden en fazla bir hoca seçilir. 6 kişilik odalarda beş seviyeden birer hoca ve rastgele bir seviyeden ikinci bir hoca seçilir. Aynı hoca tekrarlanmaz; hiçbir seviyeden üç hoca gelmez. Hoca sırası karıştırılır ve açılmamış isimler gizli kalır.

İhale ve kadro kartları fotoğrafı, yıldızı, uzmanlığı, sayısal etkiyi ve hangi taktik koşulunda çalıştığını gösterir. Fotoğrafçı/kaynak/lisans kartın ayrıntılarındadır. Lisans kayıtları research/transfer-arena-coach-portraits.json ve coach-portraits.js içinde korunur. Başlamış odaların hoca pazarı ve yıldızları yeniden üretilmez; yeni seçim kuralı yeni başlatılan oyunlarda uygulanır.

## Bonus kartı ve kaptan

Oda kurucusu oluşturma ekranında Eren Çiftçi bonusunu açıp kapatabilir; varsayılan kapalıdır. Açıldığında 70 reytingli bonus forvet, normal düşük reytingli forvet kontenjanından bir yer kullanarak pazara tam bir kez girer. Toplam 7N futbolcu, mevki dağılımı ve kalite bantlarının sayısı değişmez. Kart açık artırma, pas havuzu ve takım tamamlama kurallarına diğer futbolcular gibi tabidir. Ad, fotoğraf ve kurgusal özellikler kullanıcı isteğiyle eklenmiştir; EA verisi değildir.

Maç öncesinde ve devre arasında yalnız kendi takımındaki, kırmızı kart görmemiş bir oyuncu kaptan seçilebilir. Kaptan simülasyonda pas, savunma, bitiricilik ve kalecilik özelliklerine %3 performans çarpanı alır. Kart overall değeri ve kaynak özellikleri değişmez; artış birikmez. Seçilmemişse uygun en yüksek reytingli oyuncu otomatik seçilir. Kaptan atılırsa artışı sahada kalmaz; sonraki devrede uygun oyuncuya kaptanlık atanır. Rakibin taktikleri gizli kalırken kaptan isimleri maç başladığında görünür olur.

Telefon arayüzünde ihale çubuğu altta sabittir; dokunma hedefleri en az 48 piksel, taktikler iki sütun ve kadrolar kompakt kartlar halinde sunulur. Gereksiz uyarı metinleri kaldırılmıştır; bağlantı/komut hataları ve fotoğraf lisans atıfları korunur.


## Efsane Kart ve simülasyon modeli 2

Her yeni pazarda 15 kişilik efsane havuzundan eşit olasılıkla tam bir oyuncu seçilir; ismi ve ihale sırası önceden açıklanmaz. Efsane, 88+ kalite bandında ve kendi mevkisinde normal bir oyuncunun yerine geçer. Böylece 7N toplam, mevki kapasiteleri ve kalite bantları aynıdır. Bonus oyuncu seçeneğiyle birlikte çalışır. Teklif gelmezse aynı pas havuzu kurallarıyla mutlaka bir takıma gider. İhale bütçesi ve maç motorunda ayrıca efsane çarpanı yoktur. Reytingler91–95 FC27 base icon değerleridir; 99 puanlı kampanya kartları kullanılmaz. Seçki kullanıcının Red Bull listesinden, 17 alt özellik FUT Mind FC27 görüntülerinden doğrulanmıştır. Kaynak/SHA256 kayıtları research/transfer-arena-legends.json içindedir.

Model2 normal şut gücü = bitiricilik ×0,75 + şut gücü ×0,25. Önceki bitiricilik katsayısı0,003 bu birleşik değere uygulanır. Penaltılar yalnız penaltı özelliğini kullanmaya devam eder. Kart özetinde şut gücü bitiriciliğin yanındadır; normal kartlarda FC27 etiketi kaldırılmıştır.

Kaleci ve kırmızı kartlılar dışındaki aktif saha oyuncularının sprint ortalaması, enerji/görev uyumu/kaptan çarpanlarıyla hesaplanır. Rakiple fark ×0,002, başarılı pas sonrası bir bölge ilerleme ihtimaline eklenir; etki −0,06 ile +0,06 arasında sınırlıdır. 10 puan avantaj +2 yüzde puandır. Kadro ayrıntısındaki sprint ortalaması ham kadro değeridir; maç içindeki etkin ortalama yorgunlukla değişir. Bu etki pas doğruluğunu veya şut gücünü doğrudan artırmaz. Önceden başlamış version1 maçlar eski modeliyle devre/uzatma tamamlar; yeni maçlar version2 başlar.

15 portre Wikimedia Commons serbest lisanslı fotoğraflardır; atıflar kart ayrıntısında ve legend-portraits.js içinde, SHA256/araştırma kayıtları research/transfer-arena-legend-portraits.json içinde tutulur.


## Kadro inceleme, taktik sahası ve ortak maç saati

Yeni odalar rulesVersion3 kullanır. İhale sonunda180saniyelik squadReview aşamasında bay geçen dahil tüm takımlar yedi oyuncusunu ve hocasını görür, ilk taktiğini kilitler. Herkes kilitlerse beklemeden maç öncesine geçilir; süre biterse eksik takımlar önceki/varsayılan planını kullanır. İlk ve sonraki her maç öncesinde, ayrıca devrede plan tekrar seçilebilir. Taktiği kilitlemek o aşama için kesindir.

Saha önizlemesi sunucuyla ortak assignFormation işlevini kullanır; doğal mevkiler önce yerleşir, mevki dışı görev sarı forma ve metinle belirtilir. Kırmızı kartlılar sahadan çıkarılır; kaptan işaretlidir. Formasyonda veya kaptanda değişiklik saha önizlemesini anında günceller.

Maç modeli3 normal90dakika ve uzatma120dakika saatini kullanır; her45dakikada120işlem yapılarak önceki maç olay yoğunluğu ve enerji bütçesi korunur. Oda kurucusu ortak izlemeyi1×/2×/4×/8× seçer.Yeni sürümde1× hızda45maç dakikası30gerçek saniyedir; taktik/devere beklemeleri ayrı tutulur. Hız değişiminde saat kaldığı dakikadan devam eder, geçmiş olaylar değişmez; gelecekteki gol/kart ve penaltı sonuçları saatlerine kadar gizli kalır. Tüm katılımcılar aynı sunucu saatini görür. Ekranda olaylar tam dakika ile, seri penaltılar dakika yerine Penaltı olarak gösterilir.

Eski odaların hesaplanmış maç olayları korunur. Eski20dakikalık maçlar da yalnız görüntüde90dakikaya, uzatma120dakikaya ölçeklenir. Simülasyon katsayıları, gol, kart, enerji ve kazanan hesabı bu düzeltmede değişmemiştir.


## Tek teklif düzeltmesi ve hoca boost’u

Kilitli teklif/pas sunucuda doğrulanır; aynı requestId ile tekrar gönderim idempotenttir. Uygun kadro yeri olmayan takımlar karar beklemesini uzatmaz ve sonuçta Kadro yeri dolu görünür. Eksik kararlar60saniye sonunda Teklif vermedi olarak açılır. Eşitlik kurası değişmemiştir.

Taktik ekranındaki hoca adı/yıldızı, sayısal etki ve taktik koşulu sürekli görünür. Pres/pas/savunma/geçiş uzmanlıklarında seçilen plana göre Boost etkin durumu anlık güncellenir. Gelişim uzmanlığı uygun aktif81vealtı saha oyuncusu varsa, disiplin uzmanlığı her planda etkin gösterilir.


Sürüm2 odalar ilk sunucu işleminde tek teklife yükseltilir: açık karttaki mevcut kararlar korunup kilitlenir ve60saniyelik pencere bir kez başlatılır; sonraki yoklamalar süreyi uzatmaz. Mevcut taktik aşaması bir kez3dakikaya uzatılır. Oynatılmakta olan maç değiştirilmez; devreye ulaşıldığında yeni taktik süresine geçilir.
