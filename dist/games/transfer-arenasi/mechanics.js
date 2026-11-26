import {COACH_FIT_PER_STAR,COACH_SPECIALTY_PER_STAR,STYLE_BEATS,STYLE_EDGE,STYLE_NAMES,TACTIC_PRESETS} from './tactic-presets.js';
// Simülasyonun sade özeti. Sayılar server/transfer-arena/simulation.js ile uyumlu tutulmalıdır.
const ATTRIBUTES=[
 ['Kısa pas + Görüş','Pas isabetini belirler (%55 kısa pas, %30 görüş, %15 soğukkanlılık). Rakibin araya girme ve savunma değeri karşı baskıdır.'],
 ['Top kontrolü ↔ Müdahale','Rakip topu kapmaya çalıştığında ikili mücadeleyi bu iki değer belirler. Düşük müdahale faul riskini artırır.'],
 ['Bitiricilik + Şut gücü','Şutun gol olma ihtimali (%60 bitiricilik, %25 soğukkanlılık, %15 şut gücü). Rakip kalecinin refleks, konum ve uzanma ortalamasıyla yarışır.'],
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
 ['Direkt oyun','Pas isabeti 6,5 puan düşer ama top çok daha hızlı ileri gider. Rakip yoğun pres yapıyorsa avantaj kazanır.'],
 ['Kontra atak','Rakip ne kadar riskli ve presli oynarsa hücuma çıkarken pasların o kadar isabetli olur.'],
 ['Pres','Top kapma denemelerini artırır ve rakibin pas isabetini düşürür; enerji harcatır.'],
 ['Risk','Daha sık ve daha kaliteli şut. Hücum riskinde top kaybedince rakip %30 ihtimalle orta sahadan başlar. Temkinli oyun savunma hocasını çalıştırır.'],
 ['Tempo','Topu daha hızlı ileri taşır ve daha fazla enerji harcatır.'],
 ['Genişlik','Dar savunma merkezi kapatır ama kanatları açar; geniş savunma tersini yapar.'],
 ['Müdahale','Sert oyun top kazanmayı artırır, faul ve kart riskini de artırır. Katı hakemde sarı kart daha kolay çıkar; iki sarı veya kırmızı oyuncuyu oyundan atar.'],
 ['Teknik direktör','Yıldızı bütün futbolcularının maç özelliklerini artırır: 5★ +%8, 4★ +%4,5, 3★ +%2, 2★ +%0,8, 1★ +%0,2. Ayrıca uzmanlığının koşulu taktiğinle sağlanınca ek bonus verir (“Boost etkin”).'],
 ['İç saha','Taraftar Desteği kartı yalnız lig iç saha maçlarında çalışır; final tarafsız sahadadır.']
];
// Model 6 (yeni odalar) eklemeleri; katsayılar server/transfer-arena/simulation.js içindeki MODEL6 ile uyumludur.
const MODEL6=[
 ['Pozisyon alma','Ceza sahasında topu kimin alacağını ve büyük fırsat (gol ihtimali %30 ve üstü) bulma şansını artırır; rakip savunmanın savunma bilinciyle yarışır.'],
 ['Soğukkanlılık','Şut ve penaltıda bitiriciliğe eklenir, baskı altında pas isabetine küçük katkı verir.'],
 ['Ayrıntılı mevki','ST ve CAM merkezde daha kaliteli şut bulur. Kanat oyununda ya da geniş oynarken RW/LW çoğunlukla ortalar ve büyük fırsat yaratır; rakip dar savunuyorsa etkisi artar.'],
 ['Takım gücü','Ortalama overall ve hoca yıldızı farkı daha çok top kapma, isabetli pas, ileri gitme ve pozisyon olarak yansır; etkisi 12 puan farkla sınırlıdır. Belirgin favori çoğu maçı kazanır ama kaybedebilir.'],
 ['Skor durumu','2 farkla önde olan takım tempoyu ve riski düşürür; 70. dakikadan sonra geride olan baskıyı artırır. Son dakikalarda berabere takımlar temkinli oynar. Çok gollü maçlarda oyun oturur.'],
 ['Yorgunluk','Maç ilerledikçe savunmalar yorulur ve açılır; en çok gol 75–90 arasında gelir.'],
 ['Duran toplar','Ceza sahasındaki fauller penaltı ya da serbest vuruş, kurtarışlar ve auttan sonra kornerler olabilir. Korneri en iyi pasör kullanır, stoper ve santrforlar kafa vuruşunda öne çıkar.'],
 ['Tüm riskleri al!','70. dakikada (finalde 105) geride ya da berabere olan takım seçebilir. Savunmacılar hücuma katılır; pres, tempo, risk ve şut sıklığı en üste çıkar. Top kaybında rakip sık sık tehlikeli bölgeden başlar, enerji daha hızlı düşer; gol atma da gol yeme de belirgin artar. Düğme 60–70 (finalde 95–105) arasında görünür ve maç durmaz; 8× hızda bu pencere bir saniyeden kısadır, bu yüzden oda kurucusu o sırada hızı düşürebilir.'],
 ['Kartlar','7 kişilik maçta kırmızı kart daha seyrektir.']
];
// Model 7 taktik bölümü: tüm sayılar tactic-presets.js'ten okunur.
const fmt=n=>new Intl.NumberFormat('tr-TR',{maximumFractionDigits:2}).format(n);
export function model7Rows(){
 const cycle=[];for(let s='counter';!cycle.includes(s);s=STYLE_BEATS[s])cycle.push(s);cycle.push(cycle[0]);
 const PRESS=['geri çekil','dengeli pres','yoğun pres'],RISK=['temkinli','dengeli risk','hücum'],TEMPO=['sakin tempo','normal tempo','yüksek tempo'],WIDTH=['dar','dengeli genişlik','geniş'],TACKLE=['temiz','normal müdahale','sert','çok sert'];
 const plan=p=>`${STYLE_NAMES[p.style]} · ${PRESS[p.press]}, ${RISK[p.risk]}, ${TEMPO[p.tempo]}, ${WIDTH[p.width]}, ${TACKLE[p.tackle]}`;
 return [
  ['Tarz döngüsü',`${cycle.map(s=>STYLE_NAMES[s]).join(' > ')}. Soldaki tarz sağdakine üstündür; rakibin tarzı gizlidir, bu yüzden bir tahmin oyunudur.`],
  ['Üstünlüğün etkisi',`Üstün tarafta pas isabeti +${fmt(STYLE_EDGE.pass*100)} puan, başarılı pastan sonra ileri gitme +${fmt(STYLE_EDGE.progress*100)} puan, top kapma +${fmt(STYLE_EDGE.tackle*100)} puan, şut kalitesi +${fmt(STYLE_EDGE.xg*100)} xG puanı. Zayıf tarafta aynı değerler eksi yönde işler; nötr eşleşmede etki yoktur.`],
  ['Hazır taktikler',`Tek dokunuşla tarz ve kaydırıcıları ayarlar; diziliş ve kaptan korunur. ${TACTIC_PRESETS.map(x=>`${x.name} (${plan(x.plan)})`).join('; ')}. Kaydırıcıları elle değiştirirsen profil “Özel” olur.`],
  ['Hoca uyumu',`Hocanın uzmanlık koşulu taktiğinle sağlanırsa bütün futbolcuların maç özelliklerine yıldız başına +%${fmt(COACH_FIT_PER_STAR*100)} eklenir (5★: +%${fmt(5*COACH_FIT_PER_STAR*100)}). Uzmanlık etkisi de yıldız başına model 6’daki %2 yerine %${fmt(COACH_SPECIALTY_PER_STAR*100)} ölçeğinde çalışır. Hazır taktik kartlarındaki “Hoca uyumu” etiketi bunu gösterir.`]
 ];
}
const list=rows=>`<dl class="mechanics-list">${rows.map(([t,d])=>`<div><dt>${t}</dt><dd>${d}</dd></div>`).join('')}</dl>`;
export function mechanicsHTML(){
 return `<p class="small muted">Maç her yarıda yaklaşık 120 aksiyonla oynanır: pas, top kapma, faul ve şut. Her aksiyon bir olasılıktır; güçlü takım da kaybedebilir.</p><h3>Futbolcu özellikleri</h3>${list(ATTRIBUTES)}<h3>Taktikler</h3>${list(TACTICS)}<h3>Yeni maç modeli</h3>${list(MODEL6)}<h3>Model 7 taktikleri (yeni odalar)</h3>${list(model7Rows())}`;
}
