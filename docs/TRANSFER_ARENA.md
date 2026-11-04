# Transfer Arenası

Çalışma sürümü: çevrimiçi bağlantı ve tarayıcı kontrolleri tamamlanmadan yayınlanmamalı.

3–6 kişi ayrı cihazlardan aynı altı haneli odaya katılır. Her takım 200 krediyle 1 kaleci, 2 savunmacı, 2 orta saha, 2 forvet ve 1 teknik direktör alır. Pazar 7N benzersiz futbolcu ve N benzersiz hocadan oluşur. Yalnızca açık kart ve geçmiş kartlar gösterilir. Futbolcuların ardından hocaların ihalesi başlar.

Pazarda N adet 88+, 2N adet 82–87, 2N adet 76–81 ve 2N adet 70–75 kart vardır. Takım başına reyting kotası yoktur. İlk teklif 1, artış en az 1 kredidir. İhale 12 saniye sürer; son 3 saniyede teklif süreyi uzatabilir, üst sınır 24 saniyedir. Her boş yer için 1 kredi saklanır. Pas geçmek o kart için kesindir. Teklifsiz kartlar havuza alınır; pazar sonunda boş mevkiler arasında rastgele eşitlik bozmalı, zayıf/güçlü dönüşümlü dağıtılır. Öncelik yalnız otomatik alınan kartların ortalamasına dayanır. Hocada destek kredisi yoktur. Yıldızlar ve uzmanlıklar bağımsız oyun tasarımıdır; gerçek FC hoca reytingleri değildir.

Gizli taktikler: dört diziliş, kısa pas/kanat/direkt/kontra oyun tarzları, pres, risk, tempo, genişlik ve dört müdahale seviyesi. Yoğun oyun enerji tüketir. Sertlik top kazanmayı ve faul riskini birlikte artırır. İki sarı veya doğrudan kırmızı oyuncuyu maçtan çıkarır. Kaleci atılırsa bir saha oyuncusu geçici kaleci olur. Dört kişiden aza düşen takım hükmen kaybeder. Kart ve enerji yeni maçta sıfırlanır; devrede küçük toparlanma vardır. Simülasyon katsayıları oyun tasarımıdır, gerçek maç olasılıkları ölçümü değildir.

Tek devre tarafsız lig: galibiyet 3, beraberlik 1 puan. Sıra puan, averaj, gol, galibiyet, eşitlerin kendi arasındaki mini lig ve son olarak açıklanan sabit tohumlu kura ile belirlenir. İlk iki final oynar. Normal maç 2×10, uzatma 2×2 oyun dakikasıdır; final hâlâ eşitse üçer penaltı ve ani ölüm uygulanır. Penaltılar normal skor ve şut istatistiklerine eklenmez.

## Yerel geliştirme

`node scripts/serve-arena.mjs` ile `http://127.0.0.1:4174/games/transfer-arenasi/` açılır. Bu sunucu odaları yalnız bellekte tutar; kapanınca kaybolur. Üretimde kullanılan bir alternatif depolama değildir. `npm run check` tüm kontrolleri çalıştırır.

## Sunucu sözleşmesi

`POST /api/transfer-arena`, aynı kaynaklı JSON istekleri kabul eder. Tarayıcı rastgele, HttpOnly ve Secure oturum çerezi alır; sunucu bundan üye kimliği üretir. İstek türleri create/join/poll/ready/start/bid/pass/plan. Her komutta benzersiz requestId gerekir. bid/pass için lotId; plan için phaseVersion gerekir. Taktik sürümü ağ yoklamalarından bağımsızdır. Oda 24 saat sonra kullanıma kapanır. IP başına istek ve oda oluşturma sınırı uygulanır. Kapanan kayıtların fiziksel temizliği ayrıca bakım görevi gerektirir.

Üretim ortamı değişkenleri yalnız sunucuda: `ARENA_SERVICE_ACCOUNT`, `ARENA_FIREBASE_API_KEY`, `ARENA_DATABASE_URL`. Kimlik, proje IAM rolü olmayan özel bir servis hesabının imzaladığı Firebase Auth custom token ile `transfer-arena-server` kullanıcısına giriş yapar. Bu kimlik yalnız `transfer_arena_v1` altında yetkilendirilmelidir. Mevcut oyunların kuralları korunur. Kimlik dosyasını veya özel anahtarı depoya koyma. Ayrıntılar: [custom tokens](https://firebase.google.com/docs/auth/admin/create-custom-tokens), [REST auth](https://firebase.google.com/docs/reference/rest/auth), [ETag kayıtları](https://firebase.google.com/docs/database/rest/save-data#section-conditional-requests).

Depolama bütün odayı ETag koşullu yazmayla atomik günceller. Çakışma taze durumla yeniden denenir. Açılmamış pazar, simülasyon tohumu ve rakibin taktikleri publicView dışındadır. İstemci bütçe, maç sonucu veya futbolcu özelliği göndermez; bunları sunucu belirler. Süreler istemci saatine güvenmez. Poll yalnız kalan olayları gösterir; gelecek golleri ve penaltı sonuçlarını açıklamaz.
