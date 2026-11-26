# Transfer Arenası

Çevrimiçi oyun kuralları, yerel geliştirme ve sunucu kurulum rehberi.

3–6 kişi ayrı cihazlardan aynı altı haneli odaya katılır. Yeni rulesVersion4 odalarında her takım 200 krediyle seçtiği dizilişe göre 1 kaleci, toplam 6 saha oyuncusu ve 1 teknik direktör alır. Pazar toplam 7N benzersiz futbolcu ve N benzersiz hocadan oluşur. Yalnızca açık kart ve geçmiş kartlar gösterilir. Futbolcuların ardından hocaların ihalesi başlar.

Pazarda bütün takımların toplam kadro kontenjanlarına göre 2N adet 88+, 3N adet 82–87, N adet 76–81 ve N adet 70–75 kart vardır; Eren bonusu açıksa kendi reyting bandındaki bir kontenjanı kullanır. 82+ oranı 5/7, yaklaşık %71'dir. Takım başına reyting kotası yoktur. Yeni odalarda eşit en yüksek teklifler içinde sunucuya ilk kilitlenen teklif kazanır; başlamış eski odalar kendi sürümünün tie-break kuralını korur. Her kartta 60 saniyelik gizli teklif penceresi vardır; teklifler en az 1 kredi, tam sayıdır. Her takım yalnız bir teklif veya pas kararı kilitler; kilitli karar değiştirilemez. Teklif verebilen herkes kilitleyince süre beklenmeden sonuç açılır. Süre sonundaki en yüksek teklif, kendi teklif ettiği bedelle kazanır. Süre bitmeden başka teklifler, teklif verenler ve kilit sırası açıklanmaz. Sonuç 8 saniyelik ayrı ekranda bütün takımların teklif/pas/süre aşımı bilgisi ve kazananla gösterilir; transfer geçmişinde de saklanır. Her boş yer için 1 kredi korunur. Teklifsiz kartlar aynı dönüşümlü pas havuzu kurallarıyla 1 krediye uygun boş mevkilere dağıtılır; hangi kartın hangi takıma gittiği ayrı listelenir. Hocada destek kredisi yoktur.

Gizli taktikler: dört diziliş, kısa pas/kanat/direkt/kontra oyun tarzları, pres, risk, tempo, genişlik ve dört müdahale seviyesi. Yoğun oyun enerji tüketir. Sertlik top kazanmayı ve faul riskini birlikte artırır. İki sarı veya doğrudan kırmızı oyuncuyu maçtan çıkarır. Kaleci atılırsa bir saha oyuncusu geçici kaleci olur. Dört kişiden aza düşen takım hükmen kaybeder. Kart ve enerji yeni maçta sıfırlanır; devrede küçük toparlanma vardır. Simülasyon katsayıları oyun tasarımıdır, gerçek maç olasılıkları ölçümü değildir.

Tek devre ligde galibiyet 3, beraberlik 1 puandır; iç saha/deplasman dengelenir ve ilk iki tarafsız final oynar. Sıra puan, averaj, gol, galibiyet, eşitlerin kendi arasındaki mini lig ve son olarak açıklanan sabit tohumlu kura ile belirlenir. Normal maç 2×45, uzatma 2×15 oyun dakikasıdır; final hâlâ eşitse üçer penaltı ve ani ölüm uygulanır. Penaltılar normal skor ve şut istatistiklerine eklenmez.

## Yerel geliştirme

`node scripts/serve-arena.mjs` ile `http://127.0.0.1:4174/games/transfer-arenasi/` açılır. Bu sunucu odaları yalnız bellekte tutar; kapanınca kaybolur. Üretimde kullanılan bir alternatif depolama değildir. `npm run check` tüm kontrolleri çalıştırır.

## Sunucu sözleşmesi

`POST /api/transfer-arena`, aynı kaynaklı JSON istekleri kabul eder. Tarayıcı rastgele, HttpOnly ve Secure oturum çerezi alır; sunucu bundan üye kimliği üretir. İstek türleri create/join/poll/ready/start/bid/pass/plan/formation/bonusCard/leave/close/speed/logo. Her komutta benzersiz requestId gerekir. bid/pass için lotId; plan için phaseVersion gerekir. Taktik sürümü ağ yoklamalarından bağımsızdır. Oda 24 saat sonra kullanıma kapanır.

İstek sınırı: genel sınır sunucu örneğinin belleğinde tutulur, IP başına dakikada 1.200 ve oturum başına dakikada 300 istektir. Aynı Wi-Fi'daki cihazlar artık veritabanında tek bir sayaç kaydını paylaşmaz; bu yüzden ETag çakışması ve "Oda meşgul" hatası doğmaz, her istek de bir veritabanı gidiş-dönüşünden kurtulur. Sınır örnekler arasında paylaşılmaz; en iyi çaba korumasıdır. Oda oluşturma sınırı (IP başına saatte 5) veritabanında kalır.

Yoklama yanıtı: her yanıt `viewHash` (görünüm özeti) taşır. İstemci `poll` isteğinde son özeti `since` olarak gönderir; görünüm değişmediyse sunucu yalnız `{unchanged, viewHash, serverNow}` döner. İhale ve taktik beklemelerinde yanıt birkaç yüz bayta iner. Komutlar her zaman tam görünüm döner.

Oda kaydı: biten lig haftaları yalnız takım golleri ve gol olaylarıyla (atan, asist, dakika) saklanır (`compactResult`). Puan tablosu ve krallıklar yalnız bunları kullanır. 6 takımlı turnuvanın sonundaki kayıt yaklaşık 456 KB'tan 130 KB'a indi.

Temizlik: Vercel Cron her gün 04:00 UTC'de `GET /api/transfer-arena-cleanup` çağırır. Oluşturulmasının üzerinden 25 saat geçen odalar ve süresi biten sınır kayıtları, okunduğu andaki ETag ile koşullu silinir. Arada değişen kayıt (ör. aynı kodla açılan yeni oda) silinmez. Şampiyon listesi korunur. Bir çalıştırma en çok 600 kayda ve 45 saniyeye bakar; kalanlar ertesi güne kalır. Uç nokta `CRON_SECRET` ortam değişkeni olmadan 503, yanlış anahtarla 401 döner.

Üretim ortamı değişkenleri yalnız sunucuda: `ARENA_SERVICE_ACCOUNT`, `ARENA_FIREBASE_API_KEY`, `ARENA_DATABASE_URL` ve temizlik görevi için en az 16 karakterlik rastgele `CRON_SECRET`. Kimlik, proje IAM rolü olmayan özel bir servis hesabının imzaladığı Firebase Auth custom token ile `transfer-arena-server` kullanıcısına giriş yapar. Bu kimlik yalnız `transfer_arena_v1` altında yetkilendirilmelidir. Mevcut oyunların kuralları korunur. Kimlik dosyasını veya özel anahtarı depoya koyma. Ayrıntılar: [custom tokens](https://firebase.google.com/docs/auth/admin/create-custom-tokens), [REST auth](https://firebase.google.com/docs/reference/rest/auth), [ETag kayıtları](https://firebase.google.com/docs/database/rest/save-data#section-conditional-requests).

Depolama bütün odayı ETag koşullu yazmayla atomik günceller. Çakışma taze durumla yeniden denenir. Açılmamış pazar, simülasyon tohumu ve rakibin taktikleri publicView dışındadır. İstemci bütçe, maç sonucu veya futbolcu özelliği göndermez; bunları sunucu belirler. Süreler istemci saatine güvenmez. Poll yalnız kalan olayları gösterir; gelecek golleri ve penaltı sonuçlarını açıklamaz.

## Teknik direktör kartları

Havuz 44 gerçek teknik direktörden oluşur. İlk 24 hoca: Fatih Terim 5, Okan Buruk 4 ve Emre Belözoğlu 2 yıldızdır; ek 1 yıldızlı hocalar Frank de Boer ve Steven Gerrard, ek 2 yıldızlı hocalar Sergen Yalçın ve İsmail Kartal'dır. Eklenen 20 hoca (uzmanlık, yıldız): Alex Ferguson (hücum, 5), Jupp Heynckes (kondisyon, 5), Fabio Capello (disiplin, 4), Hansi Flick (hücum, 4), Xabi Alonso (pas, 4), Simone Inzaghi (geçiş, 4), Didier Deschamps (savunma, 4), Mircea Lucescu (gelişim, 4), Mikel Arteta (pres, 3), Arne Slot (pas, 3), Julian Nagelsmann (geçiş, 3), Roberto Mancini (disiplin, 3), Abdullah Avcı (kondisyon, 3), Vincenzo Montella (hücum, 3), Maurizio Sarri (pas, 2), Rúben Amorim (kondisyon, 2), Erik ten Hag (gelişim, 2), Ange Postecoglou (hücum, 2), Ersun Yanal (hücum, 1) ve Mustafa Denizli (disiplin, 1). İki yeni uzmanlık vardır: hücum ("Hücum futbolu"), Hücum riski seçildiğinde penaltı dışındaki şutların gol ihtimaline yıldız×0,5 yüzde puan ekler; kondisyon ("Kondisyon"), takımın harcadığı enerjiyi yıldız×%1,5 azaltır ve her planda etkindir. Massimiliano Allegri'nin görsel lisansı belirsiz ("Attribution") çıktığı için havuza alınmadı, yerine Didier Deschamps eklendi. Tüm yıldızlar ve uzmanlıklar oyun tasarımıdır.

Fotoğraf betiği scripts/fetch-arena-coach-portraits.mjs artık yalnızca fotoğrafı olmayan hocaları indirir; hepsini yenilemek için `--all` kullanılır. Arteta, Heynckes ve Ferguson'un tam boy fotoğraflarında kart, yüz odaklı yakınlaştırma kullanır (coach-card.js COACH_FOCUS).

3–5 kişilik odalarda her yıldız seviyesinden en fazla bir hoca seçilir. 6 kişilik odalarda beş seviyeden birer hoca ve rastgele bir seviyeden ikinci bir hoca seçilir. Aynı hoca tekrarlanmaz; hiçbir seviyeden üç hoca gelmez. Hoca sırası karıştırılır ve açılmamış isimler gizli kalır.

İhale ve kadro kartları fotoğrafı, yıldızı, uzmanlığı, sayısal etkiyi ve hangi taktik koşulunda çalıştığını gösterir. Fotoğrafçı/kaynak/lisans kartın ayrıntılarındadır. Lisans kayıtları research/transfer-arena-coach-portraits.json ve coach-portraits.js içinde korunur. Başlamış odaların hoca pazarı ve yıldızları yeniden üretilmez; yeni seçim kuralı yeni başlatılan oyunlarda uygulanır.

## Bonus kartı ve kaptan

Oda kurucusu oluşturma ekranında Eren Çiftçi bonusunu açıp kapatabilir; varsayılan kapalıdır. Yeni odada açıldığında reytingi rastgele 70–90 arasında belirlenir. Özellikleri başlangıç 70 reytingli değerler üstüne reyting farkı eklenerek ölçeklenir; kaleci özellikleri sabit kalır. Eren, kendi reyting bandındaki normal forvet kontenjanından bir yer kullanarak pazara tam bir kez girer. Toplam 7N futbolcu, mevki dağılımı ve kalite bantlarının sayısı değişmez. Kart açık artırma, pas havuzu ve takım tamamlama kurallarına diğer futbolcular gibi tabidir. Ad, fotoğraf ve kurgusal özellikler kullanıcı isteğiyle eklenmiştir; EA verisi değildir.

Maç öncesinde ve devre arasında yalnız kendi takımındaki, kırmızı kart görmemiş bir oyuncu kaptan seçilebilir. Kaptan simülasyonda pas, savunma, bitiricilik ve kalecilik özelliklerine %3 performans çarpanı alır. Kart overall değeri ve kaynak özellikleri değişmez; artış birikmez. Seçilmemişse uygun en yüksek reytingli oyuncu otomatik seçilir. Kaptan atılırsa artışı sahada kalmaz; sonraki devrede uygun oyuncuya kaptanlık atanır. Rakibin taktikleri gizli kalırken kaptan isimleri maç başladığında görünür olur.

Yeni odalarda kurucu, Eren bonus oyuncusunu ve bonus kartlarını birbirinden bağımsız açabilir. Lobi kapanmadan her takım ihale dizilişini ve (açıksa) bir bonus kartı seçip hazır olur. Takım dizilişi ve hazır durumu lobide herkese görünür; rakiplerin bonus kart seçimi yalnız seçildi bilgisi olarak görünür. Diziliş seçimi oyuncu ihalesindeki mevki kotasını belirler. Bonus kartlar takım başına bir tanedir ve takımlar aynı kartı seçebilir: Bonkör Başkan başlangıç bütçesine 15 kredi ekler, Taraftar Desteği yalnız lig iç sahasında pas, mücadele, şut ve kaleciliğe %7 verir, Kondisyon Ekibi enerji kaybını %25 azaltır, Pas Ustası kısa pas ve görüşü %6 artırır. Taraftar Desteği tarafsız finalde veya bay haftasında etkin değildir. Eren'in rastgele 70–90 overall değeri normal kart alanında gösterilir; ana sayfada Eren kartı önceden açıklanmaz.

Eşit tekliflerde yeni odalarda önce sunucuya kilitlenen teklif kazanır; eski odaların eşitlik çözümü değişmez. Ev/deplasman ve sıradaki rakip taktik ekranında görünür; bay takımın durumu açıkça belirtilir. Oda sahibi lobide veya oyun sırasında odayı kapatabilir. Üye lobiden ayrılabilir; başlamış turnuvadan ayrılma desteklenmez. Gol ve asist krallığı yalnız sunucunun yayımladığı maç olaylarından hesaplanır.

Telefon arayüzünde ihale çubuğu altta sabittir; dokunma hedefleri en az 48 piksel, taktikler iki sütun ve kadrolar kompakt kartlar halinde sunulur. Gereksiz uyarı metinleri kaldırılmıştır; bağlantı/komut hataları ve fotoğraf lisans atıfları korunur.


## Efsane Kart ve simülasyon modeli 2

Her yeni pazarda 15 kişilik efsane havuzundan eşit olasılıkla tam bir oyuncu seçilir; ismi ve ihale sırası önceden açıklanmaz. Efsane, 88+ kalite bandında ve kendi mevkisinde normal bir oyuncunun yerine geçer. Böylece 7N toplam, mevki kapasiteleri ve kalite bantları aynıdır. Bonus oyuncu seçeneğiyle birlikte çalışır. Teklif gelmezse aynı pas havuzu kurallarıyla mutlaka bir takıma gider. İhale bütçesi ve maç motorunda ayrıca efsane çarpanı yoktur. Reytingler91–95 FC27 base icon değerleridir; 99 puanlı kampanya kartları kullanılmaz. Seçki kullanıcının Red Bull listesinden, 17 alt özellik FUT Mind FC27 görüntülerinden doğrulanmıştır. Kaynak/SHA256 kayıtları research/transfer-arena-legends.json içindedir.

Model2 normal şut gücü = bitiricilik ×0,75 + şut gücü ×0,25. Önceki bitiricilik katsayısı0,003 bu birleşik değere uygulanır. Penaltılar yalnız penaltı özelliğini kullanmaya devam eder. Kart özetinde şut gücü bitiriciliğin yanındadır; normal kartlarda FC27 etiketi kaldırılmıştır.

Kaleci ve kırmızı kartlılar dışındaki aktif saha oyuncularının sprint ortalaması, enerji/görev uyumu/kaptan çarpanlarıyla hesaplanır. Rakiple fark ×0,002, başarılı pas sonrası bir bölge ilerleme ihtimaline eklenir; etki −0,06 ile +0,06 arasında sınırlıdır. 10 puan avantaj +2 yüzde puandır. Kadro ayrıntısındaki sprint ortalaması ham kadro değeridir; maç içindeki etkin ortalama yorgunlukla değişir. Bu etki pas doğruluğunu veya şut gücünü doğrudan artırmaz. Önceden başlamış version1 maçlar eski modeliyle devre/uzatma tamamlar; yeni maçlar version2 başlar.

15 portre Wikimedia Commons serbest lisanslı fotoğraflardır; atıflar kart ayrıntısında ve legend-portraits.js içinde, SHA256/araştırma kayıtları research/transfer-arena-legend-portraits.json içinde tutulur.


## Kadro inceleme, taktik sahası ve ortak maç saati

Önceki sürümde açılmış rulesVersion3 odaları 180 saniyelik squadReview aşamasında bay geçen dahil tüm takımlara yedi oyuncusunu ve hocasını gösterip ilk taktiği kilitletir. Yeni odalar rulesVersion4 kullanır. Herkes kilitlerse beklemeden maç öncesine geçilir; süre biterse eksik takımlar önceki/varsayılan planını kullanır. İlk ve sonraki her maç öncesinde, ayrıca devrede plan tekrar seçilebilir. Taktiği kilitlemek o aşama için kesindir.

Saha önizlemesi sunucuyla ortak assignFormation işlevini kullanır; doğal mevkiler önce yerleşir, mevki dışı görev sarı forma ve metinle belirtilir. Kırmızı kartlılar sahadan çıkarılır; kaptan işaretlidir. Formasyonda veya kaptanda değişiklik saha önizlemesini anında günceller.

RulesVersion3 odalarının maç modeli 3 normal 90 dakika ve uzatma 120 dakika saatini kullanır; her 45 dakikada 120 işlem yapılarak önceki maç olay yoğunluğu ve enerji bütçesi korunur. Yeni RulesVersion4 maçları model 4 kullanır; ev sahibi avantajı, bonus kart etkileri ve pas zincirinden asistler bu sürümde hesaplanır. Oda kurucusu ortak izlemeyi 1×/2×/4×/8× seçer. Model 3 ve 4'te 1× hızda 45 maç dakikası 30 gerçek saniyedir; taktik/devre beklemeleri ayrı tutulur. Hız değişiminde saat kaldığı dakikadan devam eder, geçmiş olaylar değişmez; gelecekteki gol/kart ve penaltı sonuçları saatlerine kadar gizli kalır. Tüm katılımcılar aynı sunucu saatini görür. Ekranda olaylar tam dakika ile, seri penaltılar dakika yerine Penaltı olarak gösterilir.

Eski odaların hesaplanmış maç olayları korunur. Eski20dakikalık maçlar da yalnız görüntüde90dakikaya, uzatma120dakikaya ölçeklenir. Simülasyon katsayıları, gol, kart, enerji ve kazanan hesabı bu düzeltmede değişmemiştir.


## Tek teklif düzeltmesi ve hoca boost’u

Kilitli teklif/pas sunucuda doğrulanır; aynı requestId ile tekrar gönderim idempotenttir. Uygun kadro yeri olmayan takımlar karar beklemesini uzatmaz ve sonuçta Kadro yeri dolu görünür. Eksik kararlar 60 saniye sonunda Teklif vermedi olarak açılır. Bu eşitlik kurası rulesVersion3 ve önceki odaların tarihsel davranışıdır; yeni rulesVersion4 odalarında eşit tekliflerde sunucuya ilk kilitlenen teklif kazanır.

Taktik ekranındaki hoca adı/yıldızı, sayısal etki ve taktik koşulu sürekli görünür. Pres/pas/savunma/geçiş uzmanlıklarında seçilen plana göre Boost etkin durumu anlık güncellenir. Gelişim uzmanlığı uygun aktif81vealtı saha oyuncusu varsa, disiplin uzmanlığı her planda etkin gösterilir.


Sürüm2 odalar ilk sunucu işleminde tek teklife yükseltilir: açık karttaki mevcut kararlar korunup kilitlenir ve60saniyelik pencere bir kez başlatılır; sonraki yoklamalar süreyi uzatmaz. Mevcut taktik aşaması bir kez3dakikaya uzatılır. Oynatılmakta olan maç değiştirilmez; devreye ulaşıldığında yeni taktik süresine geçilir.

## Logo, ihale sayacı, saha görünümü ve tören

Her takım lobide 6 özgün logodan birini seçer: Yıldız, Şimşek, Taç, Alev, Dalga ve Kale (dist/games/transfer-arenasi/logos.js, MIT). Katılan takıma otomatik olarak boş ilk logo atanır; hazır olmadan değiştirilebilir. Bir logo odada yalnız bir takımda olur, sunucu `logo` komutunu doğrular. Logolar lobi, puan tablosu, maç kartları, kadrolar, ihale sonucu, krallık listeleri ve törende görünür. Logosu olmayan eski odalarda yalnız takım adı gösterilir.

publicView artık lotNumber, lotTotal ve lotKind döndürür. İhale ekranında "Futbolcu 7/21" ve ilerleme çubuğu, sonuç ekranında az önce kapanan kartın sırası görünür. İhale sırasında kendi dizilişin saha üzerinde gösterilir: alınan futbolcular yerinde, boş yerler kesikli çizilir. Kadrolar bölümündeki tüm takımlar FIFA taktik ekranı gibi saha dizilişinde gösterilir (formation-board.js); tam kartlar "Kartları göster" altındadır.

Eşit tekliflerde ilk kilitleyenin kazandığı kural (rulesVersion 4) değişmedi; sonuç ekranı artık bunu açıkça yazar ve ardından kilitleyeni işaretler. Oda çubuğundaki "Nasıl işler?" düğmesi ve giriş sayfasındaki yardım bölümü, özelliklerin ve taktiklerin simülasyona etkisini özetleyen listeyi açar (mechanics.js); buradaki sayılar simulation.js ile uyumlu tutulmalıdır.

Turnuva bitince her cihazda bir kez otomatik tören oynar (ceremony.js): gol kralı, asist kralı, 3. (lig aşamasını finalistlerden sonra bitiren en iyi takım), 2. (final kaybedeni) ve havai fişeklerle şampiyon. Eşit krallarda hepsi listelenir. "Töreni izle" ile tekrar açılır; hareket azaltma tercihinde havai fişek çizilmez. Görüldü bilgisi localStorage'da `pixel-scout:transfer-arenasi:v1:toren:<oda>` anahtarında tutulur.

Efsane kart portreleri oyunculuk döneminden, yüzü net Commons fotoğraflarıyla değiştirildi (8 güncel veya takım elbiseli fotoğraf yenilendi). Kartta fotoğraf kenardan kenara ve kişiye özel odak/yakınlaştırmayla gösterilir (legend-portraits.js `focus`). Zidane için yüzü görünen serbest lisanslı oyunculuk dönemi fotoğrafı bulunamadığından net bir 2013 portresi kullanıldı. İndirilen ham görseller Git dışındaki research/legend-portraits-cache/ klasöründe tutulur; Wikimedia hız sınırına takılmamak için yeniden çalıştırmada tekrar indirilmez. Seçimler scripts/fetch-arena-legend-portraits.mjs içindeki PHOTO_FILES ve FOCUS listelerindedir.

## Hoca yıldızının takım gücüne etkisi (rulesVersion 5, maç modeli 5)

Yeni odalar rulesVersion 5 ile açılır ve maç modeli 5 kullanır. Bu modelde hocanın yıldızı, uzmanlık boost'una ek olarak takımdaki bütün futbolcuların maç özelliklerine (pas, mücadele, şut, kalecilik, penaltı, sprint) çarpan olarak eklenir: 5★ +%8, 4★ +%4,5, 3★ +%2, 2★ +%0,8, 1★ +%0,2. Kart overall değerleri değişmez; çarpan kaptan bonusuyla birlikte uygulanır. Değerler `COACH_RATING_BOOST` (coach-card.js) içinde tek yerde tutulur; hoca kartı ve taktik ekranı yüzdeyi gösterir. Eşit kadrolarla 1.500 maçlık deneyde 5★ hoca, 5★ rakibe karşı yaklaşık %35, 3★ rakibe karşı %51, 1★ rakibe karşı %55 galibiyet aldı. Model 4 ve öncesiyle başlamış maçlar bu çarpanı almaz.

## FM Tarzı Animasyonlu SVG Avatar Portreleri

Transfer Arenası'ndaki tüm standart futbolcu kartları ve saha dizilişi çipleri (`formation-board.js`), 15 Efsane ve Eren Çiftçi bonus kartının gerçek fotoğraflarını koruyarak özgün, katmanlı ve hafif animasyonlu FM tarzı SVG portre motorunu (`dist/games/transfer-arenasi/avatar.js`) kullanır (`prefers-reduced-motion: reduce` tercihiyle animasyonlar kapanır).

- **Yerel analiz (`scripts/analyze-arena-avatars.py`):** 4.847 futbolcunun portreleri yalnızca bellek içinde (diske veya Git'e telifli fotoğraf kaydedilmeden) analiz edilerek ten tonu, saç rengi/stili/hacmi, sakal, yüz şekli/genişliği, kaş, göz ve ifade parametreleri çıkarılır; `dist/games/transfer-arenasi/avatar-data.js` dosyasına kompakt base36 profiller ve 145 kulüp forması (`CLUB_KITS`) olarak yazılır (4.642 gerçek analiz + 205 deterministik yedek).
- **Yıldız ince ayarları (`dist/games/transfer-arenasi/avatar-stars.js`):** 85+ tüm 96 yıldız ve 31 ek dünya/Türk yıldızı (toplam 127 futbolcu) için saç stili, boyalı uçlar, sakal, yüz maskesi (ör. Victor Osimhen) ve saç bandı (ör. Erling Haaland, Luka Modrić) gibi karakteristik özellikler tanımlanır.
- **Doğrulama:** `tests/transfer-arena-avatars.test.mjs` 4.847 profilin tamamını, 96 elit yıldızın ince ayarlarını, Efsane/Bonus fotoğraf korumasını, XSS kaçışını ve çoklu kart SVG `<defs>` kimlik benzersizliğini test eder.

## Geçmiş şampiyonlar

Biten her turnuva, bütün odaların ortak listesine bir kez yazılır (`transfer_arena_v1/champions`, en yeni 50 kayıt). Satırda şampiyon, final skoru ve varsa penaltılar, ikinci takım, şampiyonun hocası, gol kralı ve tarih bulunur. Takım adları herkese görünür; oturum kimliği ve oda kodu istemciye verilmez. İstemci listeyi `champions` isteğiyle okur. Liste yazılamazsa biten oyun bozulmaz, sonraki yoklamada yeniden denenir. Firebase kurallarının `transfer_arena_v1` altındaki bu yeni yola sunucu kimliğiyle yazmaya izin vermesi gerekir.


## Model 6 (rulesVersion 6): yeni maç motoru, "Tüm riskleri al!", maç ekranı

Yeni odalar rulesVersion 6 ve maç modeli 6 kullanır. Başlamış eski odalar kendi modelleriyle biter. Model 3–5 sonuçları `tests/transfer-arena-model5-golden.test.mjs` altın kayıtlarıyla kilitlidir. Ortak tasarım ve dosya sahipliği `docs/ARENA_MODEL6_CONTRACT.md` içindedir.

**Maç motoru (`server/transfer-arena/simulation.js`, katsayılar `MODEL6`):**
- Maç parçalar halinde hesaplanır: 0–45, 45–70, 70–90; finalde 90–105 ve 105–120, sonra penaltılar.
- Takım gücü fırsat üretimini etkiler. Skor durumuna göre oyun: farkla önde olan takım yavaşlar, geride olan riske girer.
- Erken çok gol olan maçlarda oyun "oturur". Geç dakikada yorgunlukla daha çok fırsat oluşur.
- İki kademeli şut kalitesi vardır (büyük fırsat). Mevki ayrıntısı etkilidir: ST/CAM bitirir, kanatlar orta yapar.
- Top sürmeden asistsiz goller çıkar. Duran toplar: penaltı, korner, serbest vuruş. Direkten dönen şutlar vardır.
- Kırmızı kartlar daha seyrektir.
- Oyuncu ve takım istatistikleri dilim sonlarında `snapshots` olarak kaydedilir.

**Kalibrasyon:** `node scripts/calibrate-arena.mjs --model 6 --matches 3000 --seed 1` ile ölçülür. Değerler 3.000 maçta, "Tüm riskleri al!" %50 kullanılırken: maç başı gol 2,96; 6+ gollü maç %1,1; belirgin favori (güç farkı ≥ 6) %66 kazanır ve %16 kaybeder; eşit güçte beraberlik %24; son 15 dakika en çok gol atılan dilimdir (%25); asistli gol %75; penaltı golü payı %9; maç başı kırmızı 0,07. Hedef aralıkları `tests/transfer-arena-model6-calibration.test.mjs` ile korunur. Gol ortalaması düğmenin kullanım oranına bağlıdır: hiç kullanılmazsa yaklaşık 2,7, çok kullanılırsa 3,0'ı aşabilir.

**"Tüm riskleri al!":**
- Düğme 60–70 arasında, finalde uzatmada 95–105 arasında görünür. Kilit 70'te (finalde 105'te) olur; maç durmaz.
- Uygunluk kilit anındaki skora göre belirlenir: geride olan ya da berabere olan takımlar seçebilir. Rakibin seçimi kilitten önce gizlidir.
- Seçen takım daha çok atar ve daha çok yer; 1 farkla geride olanın geri dönüş şansı artar, kesin kazanç yoktur.
- Pencere oyunun seçili hızında akar: 1× hızda yaklaşık 6,7 saniye, 8× hızda bir saniyeden kısa (kullanıcı kararı; yavaşlatma yok).

**Maç ekranı (mobil öncelikli, `match-screen.js`):** Kendi maçın için büyük skor tabelası (logo, skor, dakika, gol atanlar), canlı istatistik şeridi ve son 6 olayın Türkçe anlatımı gösterilir. Şut, isabetli şut ve xG görünen olaylardan hesaplanır; topa sahip olma ve pas yüzdesi son dilim kaydından gelir. Diğer maçlar sade satırlardır. Devre arasında ve maç sonunda maç raporu (`match-report.js`) açılır: oyuncu notları 6,0–10,0 ve maçın adamı. Anlatım (`commentary.js`) deterministiktir; direk, büyük fırsat kurtarışı ve kıl payı kaçan şut gibi gerilim anlarını vurgular.

## Model 7 (rulesVersion 7): tarz eşleşmeleri, hazır taktikler, güçlü hocalar

Yeni odalar rulesVersion 7 ve maç modeli 7 kullanır. Model 6 ve öncesi birebir aynı sonucu üretir. Model 6 için 20 sabit tohumlu maç `tests/fixtures/arena-model6-golden.json` ile kilitlidir. Ortak değerler `dist/games/transfer-arenasi/tactic-presets.js` içindedir. Sunucu ve arayüz bu değerleri aynı dosyadan okur.

**Tarz döngüsü:** Kontra atak > Kısa pas > Kanat oyunu > Direkt oyun > Kontra atak. Üstün tarz atakta ve savunmada şu avantajları alır:

| Etki | Değer (`STYLE_EDGE`) |
|---|---|
| Pas isabeti | +2,1 puan |
| İlerleme | +2,8 puan |
| Top kapma | +1,75 puan |
| xG | +0,0085 |

Zayıf taraf aynı miktarda kaybeder. Rakibin tarzı gizli kalır. Ekranda yalnız kendi tarzının hangi tarza üstün, hangisine zayıf olduğu yazar.

**Hazır taktikler:** Taktik ekranında dört kart vardır. Seçilen kart tarzı ve beş ayarı tek seferde kurar. Diziliş ve kaptan korunur. Ayrıntılar varsayılan olarak kapalı "Gelişmiş" bölümündedir. Elle yapılan değişiklik "Özel" olarak görünür.

| Profil | Tarz | Ayarlar |
|---|---|---|
| Gegenpress | Kanat oyunu | Pres yoğun, risk hücum, tempo yüksek, geniş, sert |
| Katenaçyo | Kontra atak | Geri çekil, temkinli, sakin, dar, sert |
| Tiki-taka | Kısa pas | Dengeli pres, dengeli risk, sakin, dar, normal |
| Kontra | Direkt oyun | Dengeli pres, dengeli risk, yüksek tempo, dengeli genişlik, normal |

Her profil birini yener, birine yenilir: Katenaçyo > Tiki-taka > Gegenpress > Kontra > Katenaçyo.

**Hoca etkisi:**
- Uzmanlık katsayısı yıldız başına %2'den %3'e çıktı.
- Uzmanlık koşulu seçilen planla sağlanırsa ("taktik uyumu"), bütün futbolcuların maç özelliklerine yıldız başına %0,3 ek çarpan gelir.
- Uyum her maç diliminde yeniden hesaplanır. Devrede plan değişirse uyum da değişir.
- Profil kartları hocanın uyduğu profili "Hoca uyumu" rozetiyle gösterir.

**Model 7 düzeltmeleri (`MODEL7`):** Model 6'da yüksek tempo ve yüksek risk, tarzdan bağımsız olarak fazla cezalıydı. Bu yüzden pres ağırlıklı profiller her zaman kaybediyordu. Model 7'de üç düzeltme vardır:
- Tempo başına pas cezası kaldırıldı. Yoğun oyunun bedeli yalnız enerjidir.
- Risk 2 ile oynayan takım topu kaybettiğinde rakip orta sahadan yalnız %30 ihtimalle başlar.
- Direkt oyunun pas cezası 0,12'den 0,065'e indi.

**Kalibrasyon:** Ölçüm komutu `node scripts/calibrate-arena.mjs --model 7 --tactics`. Ölçümler eşit kadrolarla yapıldı:

| Ölçüm | Sonuç (G/B/M) |
|---|---|
| Üstün tarz | %46 / %29 / %24 |
| Nötr tarz çifti | %36 / %29 / %35 |
| Uyumlu 5★ hoca, uyumsuz 5★ hocaya karşı | %45 / %31 / %24 |

- Hiçbir profilin ortalama galibiyeti %37'yi geçmez.
- Maç başı gol 2,87, 6+ gollü maç oranı %0,85.
- Belirgin favori %66,5 kazanır.

Hedef aralıkları `tests/transfer-arena-model7-calibration.test.mjs` ile korunur.
