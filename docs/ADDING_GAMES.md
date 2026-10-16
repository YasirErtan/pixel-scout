# Mini oyun ekleme

## Hızlı başlangıç

```sh
npm run game:new -- penalty-quiz "Penaltı Quiz"
npm run dev
```

Ardından `http://127.0.0.1:4173/games/` aç. Komut yeni klasörü üretir ve oyun listesine ekler. Şablon sadece başlangıç ekranıdır; gerçek oyun mantığını sen eklersin.

## Klasör sözleşmesi

```text
dist/games/
  index.html          # ortak oyun listesi
  launcher.js
  registry.json       # kayıtlar
  penalty-quiz/
    index.html
    style.css
    app.js
```

Her oyun kendi HTML girişine sahiptir. CSS kendi sayfasına aittir; mevcut futbol oyununa global stil ekleme. Assets için oyun içindeki `./assets/`, ortak medya için `../../assets/` gibi göreli yollar kullan. Registry `href` değerleri `/games/` konumuna göredir; ağ adresi veya `javascript:` olamaz.

Registry kaydı: `id` benzersiz küçük harfli slug, `title` görünen ad, `description` kısa açıklama, `href` aynı origin içindeki HTML yolu. Mevcut `../index.html` futbol oyununa döner. Yeni oyunlar `./<slug>/index.html` kullanır.

## Veri ve durum

- Durum anahtarı: `pixel-scout:<slug>:v1`. Başka oyunun skorlarını temizleme veya okuma.
- Oyuncu verisini kullanacaksan `../../players.json` üzerinden yükle. Kaynak tarihini ve bilinmeyen değerleri koru.
- Gizli anahtar gerektiren servis çağrılarını tarayıcıya ekleme. Mevcut proje yalnızca statik çalışır; backend ihtiyacı ayrı tasarlanmalıdır.
- Yeni bağımlılık gerekiyorsa nedenini PR'da anlat. Varsayılan şablon bağımlılıksızdır.

## Test ve teslim

Saf kuralları oyunun `rules.js` modülüne ayırabilir, `tests/<slug>.test.mjs` içinden test edebilirsin. CI tüm `tests/*.mjs` dosyalarını çalıştırır. Başlangıç/bitiriş/yeniden başlatma, klavye, dar ekran ve localStorage bulunmadığında davranışı kontrol et. README'de oyunun kurallarını belirt. Son olarak `npm run check` çalıştır ve PR aç.

Vercel `dist/` klasörünü doğrudan sunar; yeni oyun için build yapılandırması veya canlı hesaba erişim gerekmez. Bu depoyu klonlamak otomatik üretim dağıtımı başlatmaz.
