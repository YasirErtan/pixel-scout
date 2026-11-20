// Simülasyonun sade özeti. Sayılar server/transfer-arena/simulation.js ile uyumlu tutulmalıdır.
const ATTRIBUTES=[
 ['Kısa pas + Görüş','Pas isabetini belirler (%65 kısa pas, %35 görüş). Rakibin araya girme ve savunma değeri karşı baskıdır.'],
 ['Top kontrolü ↔ Müdahale','Rakip topu kapmaya çalıştığında ikili mücadeleyi bu iki değer belirler. Düşük müdahale faul riskini artırır.'],
 ['Bitiricilik + Şut gücü','Şutun gol olma ihtimali (%75 bitiricilik, %25 şut gücü). Rakip kalecinin refleks ve konum ortalamasıyla yarışır.'],
 ['Sprint','Kaleci hariç takım ortalaması. Rakipten hızlıysan başarılı pastan sonra topu ileri taşıma şansın artar (en fazla ±6 puan).'],
 ['Kondisyon','Enerji daha yavaş düşer. Enerji azaldıkça bütün özellikler %20’ye kadar zayıflar; devre arasında +8 enerji toplanır.'],
 ['Penaltı','Faul sonrası penaltılarda ve finaldeki seri penaltılarda kullanılır.'],
 ['Mevki uyumu','Dizilişte kendi mevkisi dışında oynayan futbolcu özelliklerinin %92’siyle oynar (sahada sarı forma).'],
 ['Kaptan','Seçtiğin futbolcu bütün maç özelliklerinde +%3 alır.']
];
const TACTICS=[
 ['Diziliş','Hücumcu sayın rakibin defans sayısından fazlaysa şut kalitesi artar. Orta saha sayısı üstünlüğü pas isabetini artırır.'],
 ['Kısa pas','Güvenli oyun. Dar genişlikle birlikte küçük pas bonusu alır; pas uzmanı hocanın bonusu bu tarzda çalışır.'],
 ['Kanat oyunu','Rakip dar oynuyorsa daha etkilidir; geniş genişlikle uyumludur.'],
 ['Direkt oyun','Pas isabeti 12 puan düşer ama top çok daha hızlı ileri gider. Rakip yoğun pres yapıyorsa avantaj kazanır.'],
 ['Kontra atak','Rakip ne kadar riskli ve presli oynarsa hücuma çıkarken pasların o kadar isabetli olur.'],
 ['Pres','Top kapma denemelerini artırır ve rakibin pas isabetini düşürür; enerji harcatır.'],
 ['Risk','Daha sık ve daha kaliteli şut. Ama hücum riskinde top kaybedince rakip orta sahadan başlar. Temkinli oyun savunma hocasını çalıştırır.'],
 ['Tempo','Topu daha hızlı ileri taşır; pas isabeti ve enerji düşer.'],
 ['Genişlik','Dar savunma merkezi kapatır ama kanatları açar; geniş savunma tersini yapar.'],
 ['Müdahale','Sert oyun top kazanmayı artırır, faul ve kart riskini de artırır. Katı hakemde sarı kart daha kolay çıkar; iki sarı veya kırmızı oyuncuyu oyundan atar.'],
 ['Teknik direktör','Yıldızı bütün futbolcularının maç özelliklerini artırır: 5★ +%8, 4★ +%4,5, 3★ +%2, 2★ +%0,8, 1★ +%0,2. Ayrıca uzmanlığının koşulu taktiğinle sağlanınca ek bonus verir (“Boost etkin”).'],
 ['İç saha','Taraftar Desteği kartı yalnız lig iç saha maçlarında çalışır; final tarafsız sahadadır.']
];
const list=rows=>`<dl class="mechanics-list">${rows.map(([t,d])=>`<div><dt>${t}</dt><dd>${d}</dd></div>`).join('')}</dl>`;
export function mechanicsHTML(){
 return `<p class="small muted">Maç her yarıda yaklaşık 120 aksiyonla oynanır: pas, top kapma, faul ve şut. Her aksiyon bir olasılıktır; güçlü takım da kaybedebilir.</p><h3>Futbolcu özellikleri</h3>${list(ATTRIBUTES)}<h3>Taktikler</h3>${list(TACTICS)}`;
}
