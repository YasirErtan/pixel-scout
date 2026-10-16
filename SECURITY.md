# Güvenlik ve gizlilik

Bu statik oyun yerel çalışmak için giriş, e-posta, API anahtarı veya servis hesabı istemez. İstatistikler tarayıcının localStorage alanındadır. Cevaplar istemci verisinde bulunduğu için rekabetçi doğrulama sağlamaz.

Gizli bilgi fark edersen değeri issue/PR içine yapıştırma. Yayılmasını önlemek için paylaşımı durdur, ilgili sağlayıcıdan anahtarı iptal et ve GitHub'ın özel güvenlik bildirimi özelliği etkinse oradan bakımcıya bildir. Özellik yoksa hassas ayrıntı içermeyen bir issue ile özel iletişim yolu iste.

`npm run check` bilinen anahtar biçimleri, e-posta adresleri, yerel dosya yolları ve yasak dosyalar için tarama yapar. JPEG metadata bloklarında da e-posta arar; rastgele sıkıştırılmış görüntü baytlarını kişisel bilgi saymaz. Yeni sağlayıcı biçimlerini veya bütün metadata biçimlerini tam olarak kapsamaz. Dosya geçmişi, görseller ve staged değişiklikler ayrıca incelenmelidir.
