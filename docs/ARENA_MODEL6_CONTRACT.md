# Transfer Arenası Model 6 — ortak sözleşme

Bu belge paralel çalışan akışların (A–D) birbirine çarpmadan birleşmesi için ortak kuralları tanımlar. Sözleşmeyi değiştirmek gerekirse koordinatöre (ana oturum) bildirin; kendi başınıza değiştirmeyin.

## Kullanıcı kararları (2026-11-25)

- Güç farkı: belirgin favori (takım gücü farkı büyük) yaklaşık **%65 kazanır, ~%15 kaybeder**. Eşit güçte yaklaşık %37 / %26 / %37.
- Gol: maç başı **2,6–3,0**; 6+ gollü maç nadir (≤ %3); tek takımın 6+ golü çok nadir.
- **"Tüm riskleri al!"** düğmesi: normal sürede **60–70** arasında görünür, **70. dakikada kilitlenir**; maç durmaz. Finalde uzatmada **95–105** arasında görünür, **105'te kilitlenir**. Kilit anındaki gerçek skora göre **geride olan takım, berabereyse iki takım** kullanabilir. Seçen takım bütün hatlarıyla saldırır: daha çok ve daha kaliteli şut, ama top kaybında rakip tehlikeli bölgeden başlar; gol yeme ihtimali belirgin artar, enerji daha hızlı düşer.
- Mini saha / momentum çubuğu (E) **yapılmayacak**.

## Sürümleme

- Yeni odalar `rulesVersion: 6`, maçlar `version: 6`. Model 6 kodu yalnız `m.version >= 6` iken çalışır.
- Model 5 ve öncesi **birebir aynı** sonuç üretmeye devam eder (Akış D bunu altın kayıtlarla test eder).

## Simülasyon API'si (`server/transfer-arena/simulation.js`, sahibi Akış A)

İskelet bu dalda hazırdır ve çalışır. A iç mantığı geliştirir, **imzaları ve dışa açılan alanları korur**.

- `beginMatch(home, away, seed, referee, {version: 6, neutral})`
- `simulateSegment(match, plans, {start, end, allIn: [bool, bool]})` → yeni maç nesnesi. Dilimler: `0–45`, `45–70`, `70–90`; final eşitse `90–105`, `105–120`. `end` 90 veya 120 ise `finished = true`. Maç hükmen biterse (`finished`) sonraki dilimler çağrılmaz.
- `ALL_IN_LOCKS = [70, 105]`, `ALL_IN_WINDOW = 10` (düğmenin kilitten kaç dakika önce görüneceği).
- `allInEligible(match, side)` → kilit anındaki skora göre uygunluk.
- `finishFinal(match)` → eşitlik sürüyorsa penaltılar, `match.winner` yazılır.
- Model 5 fonksiyonları (`simulateHalf`, `resolveFinal`) eski maçlar için aynen kalır.

### Olaylar (`match.events`)

Mevcut alanlar korunur: `{minute, type, team, playerId, playerName, ...}`. Tipler: `goal`, `shot`, `save`, `yellow`, `red`, `foul`, `forfeit`, `extraTime`, `shootout` ve yeni:

| Tip / alan | Anlamı |
|---|---|
| `type: 'allIn'` | Takım "Tüm riskleri al!" seçti; `minute` kilit dakikası. |
| `type: 'post'` | Şut direkten/üst direkten döndü (`team`, `playerId`, `playerName`). Şut sayılır, isabetli sayılmaz. |
| `big: true` | `goal`, `shot`, `save`, `post` için büyük fırsat (xG ≥ 0,30). |
| `setPiece: 'penalty' \| 'freeKick' \| 'corner'` | Duran toptan gelen şut/gol. Penaltıda mevcut `penalty: true` de korunur. |
| `assisterId`, `assisterName` | Asist (mevcut). |
| `xg` | Şut olasılığı (mevcut). |

Yeni olay tipleri yalnız model 6 maçlarında üretilir.

### Anlık istatistik (`match.snapshots`)

Her dilim sonunda bir kayıt eklenir (45, 70, 90, 105, 120):

```js
{minute, teams: [{id, goals, shots, onTarget, saves, xg, passes, completed, losses, possessionTicks, allIn,
  players: {[playerId]: {passes, completed, keyPasses, shots, onTarget, goals, assists, tackles, interceptions, fouls, saves, minutes}}}]}
```

Akış A `player.stats` ve `team.possessionTicks` sayaçlarını doldurur (iskelette boş/0). Topa sahip olma yüzdesi = `possessionTicks` oranı.

## Oda akışı (`server/transfer-arena/room.js`, sahibi Akış B)

- İkinci yarı 45–70 dilimiyle başlar; oynatma 70'e gelince sunucu 70–90 dilimini toplanan seçimlerle hesaplar ve oynatma **durmadan** sürer. Final uzatması aynı şekilde 90–105 ve 105–120.
- Komut: `{type: 'allIn', phaseVersion, lock}` (`lock` 70 veya 105). Yalnız ilgili maçtaki takım, pencere içinde (görünen dakika `lock - 10` ile `lock` arası) ve görünen skorda geride/berabereyken kabul edilir. Kesin uygunluk kilitte `allInEligible` ile belirlenir. Seçim geri alınamaz; aynı `requestId` idempotenttir.
- Rakibin seçimi kilitten önce **gizlidir**; kilitten sonra `allIn` olayı olarak görünür.
- `publicView` eklemeleri:
  - `allIn: {lock, from, available, chosen}`: oyuncunun kendi maçı için; yoksa `null`.
  - Maç başına `snapshots`: yalnız `minute <= görünen dakika` olanlar.
  - Gelecek olaylar ve gelecek istatistikler sızdırılmaz.
- Hız değişimi (1×–8×) ve dilim sınırı birlikte doğru çalışmalı.

## Arayüz

- **Akış B:** düğme ve durumu `app.js` + `style.css` içinde. Düğme metni: **"Tüm riskleri al!"**. Seçildikten sonra kilitli görünür. Kilitten sonra iki takımın seçimi maç kartında gösterilir.
- **Akış C:** yeni modüller `dist/games/transfer-arenasi/match-report.js`, `commentary.js`, `match-report.css` (`index.html`'e yalnız CSS bağlantısı ekler).
  - **`commentary.js`:** `commentaryLine(event, match, names)` → Türkçe, HTML-güvenli metin. Varyasyon deterministik olmalı (olay indeksine göre), `Math.random` kullanılmaz; böylece her cihaz aynı metni görür.
  - **`match-report.js`:** `matchReport(match, teams)` → devre arası ve maç sonu raporu HTML'i: topa sahip olma, şut/isabetli, xG, pas %, kartlar, oyuncu notları (6,0–10,0, deterministik formül) ve maçın adamı. Eski maçlarda `snapshots` yoksa rapor gösterilmez.
  - `app.js`'e bağlama işini koordinatör yapar; C `app.js` ve `style.css`'e dokunmaz.

## Kalibrasyon ve test (Akış D)

- `scripts/calibrate-arena.mjs`: ihale pazarından gerçekçi kadrolar, rastgele taktiklerle binlerce maç. Raporlar: gol ortalaması ve dağılımı, beraberlik, güç farkı aralıklarına göre G/B/M, gol dakikaları, penaltı/duran top payı, asistli gol oranı, kart sayıları, "Tüm riskleri al!" seçen takımın 70–90 attığı ve yediği gol.
- Takım gücü tanımı (ortak): `teamStrength(team)` = saha oyuncularının ortalama overall'ı × (1 + hoca reyting çarpanı). Kalecinin overall'ı ayrıca ortalamaya eklenir. D bunu `scripts/` içinde tanımlar; "belirgin favori" = güç farkı ≥ 6.
- Testler: model 5 için altın kayıtlar (sabit tohumlarla olay listesi özeti değişmemeli); model 6 için sabit tohumlu hedef aralıkları.

## Dosya sahipliği

| Akış | Dokunabilir | Dokunamaz |
|---|---|---|
| A | `server/transfer-arena/simulation.js`, gerekirse `coach-card.js` / `coach-tactics.js` / `mechanics.js` metinleri | room.js, app.js, testler (kendi birim testi hariç: `tests/transfer-arena-model6-sim.test.mjs`) |
| B | `server/transfer-arena/room.js`, `dist/games/transfer-arenasi/app.js`, `style.css`, `tests/transfer-arena-allin.test.mjs` | simulation.js |
| C | `match-report.js`, `commentary.js`, `match-report.css`, `index.html` (yalnız CSS bağlantısı), `tests/transfer-arena-report.test.mjs` | diğer her şey |
| D | `scripts/calibrate-arena.mjs`, `tests/transfer-arena-model5-golden.test.mjs`, `tests/transfer-arena-model6-calibration.test.mjs` | diğer her şey |

Ortak kurallar:
- Türkçe yorum ve commit mesajı.
- Push, PR, deploy yok.
- Ağa çıkan test yok.
- Oyuncu bilgisi uydurulmaz.
- Mevcut testler bozulmaz.
