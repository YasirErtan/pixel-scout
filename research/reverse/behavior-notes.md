# Referans davranış incelemesi — 15 Ekim 2026

Hedef: https://playfootball.games/who-are-ya/big-4/

Tarayıcıya sunulan Astro sayfası ve istemci modülleri salt okunur olarak incelendi. Orijinal kaynak veya görseller uygulamaya kopyalanmadı. İndirilen inceleme kopyaları Git'e dahil edilmez.

## Statik kanıtlar

- Sayfadaki App bileşeni `App._ITUvCZs.js`, arama/geri bildirim bileşeni `PlayerSearch.C64ZGcHi.js`, zaman sabitleri `stats.qeuhmUN6.js` modüllerinden oluşuyor.
- Statik zaman sabitleri sekiz tahmin, 1500 ms uyarı ve 350 ms hücre aralığını tanımlıyor. App, açılma tamamlanma gecikmesini sütun sayısına bağlayarak animasyon sırasında tahmin kabulünü engelliyor.
- PlayerSearch hücrelerde sütun indeksine bağlı `animationDelay` kullanıyor. Görsel bulanıklığı tahmin sayısına bağlı; sonuçtaki fotoğraf açılması da hücre dizisinin tamamlanmasına geciktiriliyor.
- Arama normalizasyonu aksan, kesme işareti, tire ve boşluk varyasyonlarını ele alıyor.
- Astro props, Big4 kapsamını en1/fr1/es1/it1 ve sütunları kulüp/milliyet/pozisyon/doğum tarihi/forma olarak açıkça taşıyor.

## Bağımsız uygulama

Pixel Scout aynı davranış fikrini özgün kodla uygular. Kullanıcının yavaşlatma isteğine göre hücreler 720 ms aralıkla, 560 ms açılma süresiyle gösterilir. Beş hücre tamamlanmadan bir sonraki tahmin, lig/mod değiştirme ve sonuç fotoğrafı açılmaz. Arama kadrosu ile portre hedef havuzu birbirinden ayrıdır; fotoğrafı olmayan Big4 oyuncuları da tahmin edilebilir.

## Sınırlar

Bu inceleme sunucu kodunu, veri lisansını veya iç seçim algoritmasını ortaya çıkarmış sayılmaz. Oyuncu bilgileri ayrı, herkese açık kadro kaynaklarından alınır; portre lisansları dosya bazında Wikimedia Commons üzerinden kaydedilir.
