# Katkı rehberi

## İlk kurulum

1. Depoyu **Fork** yap, kendi fork'unu klonla ve klasörü Antigravity, Codex veya kullandığın editörde aç.
2. Node.js 22+ kurulu olsun. Bağımlılık kurulumu ve API anahtarı gerekmiyor.
3. `npm run dev` ile oyunu aç. `npm run check` ile kontrolleri çalıştır.
4. `git switch -c feat/oyun-adi` ile bir dal oluştur.

Doğrudan ana depoya yazma yetkisi olmadan da fork ve pull request ile katkı yapılabilir. Bu depo kimseye kendiliğinden write/admin erişimi vermez.

## Yeni mini oyun

`npm run game:new -- oyun-adi "Oyun Adı"` komutunu kullan. Ayrıntılar: [Mini oyun ekleme](docs/ADDING_GAMES.md). Mevcut futbol oyunu `/`, oyun listesi `/games/` adresindedir. Önce yeni oyunun klasöründe çalış; ortak dosyalardaki değişiklikleri küçük tut.

## Pull request öncesi

- Mobil ve masaüstünde akışı dene; klavye ile temel işlemleri yap.
- Oyun mantığı değiştiyse anlamlı test ekle. `npm run check` başarılı olsun.
- `git diff --cached` ile yüklenecek dosyaları kontrol et. Hesap bilgisi, e-posta, `.env`, token, özel fotoğraf veya lisanssız medya ekleme.
- Yeni medya için kaynak, hak sahibi ve lisans belirt; mevcut atıfları koru.
- PR'da değişikliği, doğrulamayı ve varsa sınırlamayı açıkla. Görsel değişikliklerde ekran görüntüsü ekle; kişisel tarayıcı bilgilerini kırp.

Canlı dağıtımı bakımcı yapar. Kendi fork'unu yayımlayacaksan kendi Vercel projenle bağla; üretim hesabının erişimine ihtiyacın yok.

## Ajanla çalışmak

Örnek görev: “AGENTS.md ve docs/ADDING_GAMES.md dosyalarını oku. Yeni oyunu dist/games/penalty-quiz altında geliştir. Mevcut futbol oyununun davranışını değiştirme. Kendi localStorage anahtarını kullan. npm run check çalıştır ve PR için değişiklikleri özetle.”

Birden fazla kişi aynı anda çalışıyorsa farklı oyun klasörlerini sahiplenin; `registry.json` çakışmalarını birleştirirken her oyunun kaydını koruyun.
