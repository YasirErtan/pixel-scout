// Model 7 taktik katmanı: oyun tarzı eşleşmeleri, hazır taktik profilleri ve hoca uyumu.
// Sunucu (simulation.js) ve arayüz aynı değerleri buradan okur. Katsayılar oyun tasarımıdır.

// Tarz döngüsü: her tarz birine üstün, birine zayıf, birine nötr.
// Kontra atak > Kısa pas > Kanat oyunu > Direkt oyun > Kontra atak.
export const STYLE_BEATS=Object.freeze({counter:'short',short:'wide',wide:'direct',direct:'counter'});
export const STYLE_NAMES=Object.freeze({short:'Kısa pas',wide:'Kanat oyunu',direct:'Direkt oyun',counter:'Kontra atak'});
// +1: üstün, -1: zayıf, 0: nötr (ya da aynı tarz).
export function styleEdge(style,opponentStyle){
 if(STYLE_BEATS[style]===opponentStyle)return 1;
 if(STYLE_BEATS[opponentStyle]===style)return -1;
 return 0;
}
export const styleWeakTo=style=>Object.keys(STYLE_BEATS).find(key=>STYLE_BEATS[key]===style)||null;

// Tarz üstünlüğünün maç içi etkileri (edge = +1 için; zayıf tarafta işaret ters döner).
// Model 7 kalibrasyonunda ayarlanır; arayüz yüzdeleri buradan gösterir.
export const STYLE_EDGE=Object.freeze({
 pass:.021,     // pas isabeti (olasılık puanı)
 progress:.028, // başarılı pastan sonra ileri gitme
 tackle:.0175,  // top kapma
 xg:.0085        // şut kalitesi (xG puanı)
});

// Hoca etkisi (model 7). Uzmanlık katsayısı: yıldız başına (model 6'da .02).
export const COACH_SPECIALTY_PER_STAR=.03;
// Hocanın uzmanlık koşulu seçilen planla sağlanırsa ("taktik uyumu") bütün futbolcuların maç
// özelliklerine yıldız başına bu oranda ek çarpan gelir (.003 ile 5★: +%1,5). Uzmanlık etkisiyle birlikte
// eşit kadrolarda uyumlu 5★ hoca uyumsuz 5★ hocaya karşı ~%45 kazanır, ~%24 kaybeder (kalibrasyon).
export const COACH_FIT_PER_STAR=.003;

// Hazır profiller: tek dokunuşla tarz ve kaydırıcılar. Kaptan ve diziliş korunur.
export const TACTIC_PRESETS=Object.freeze([
 {id:'gegenpress',name:'Gegenpress',summary:'Yoğun pres, yüksek tempo, geniş hücum. Çok enerji harcar.',plan:{style:'wide',press:2,risk:2,tempo:2,width:2,tackle:2}},
 {id:'katenacyo',name:'Katenaçyo',summary:'Derin ve dar savunma bloğu; top kazanınca kontra atak.',plan:{style:'counter',press:0,risk:0,tempo:0,width:0,tackle:2}},
 {id:'tikitaka',name:'Tiki-taka',summary:'Kısa paslarla topa sahip olma, sakin tempo, dar oyun.',plan:{style:'short',press:1,risk:1,tempo:0,width:0,tackle:1}},
 {id:'kontra',name:'Direkt futbol',summary:'Hızlı ve dikine; uzun toplarla savunma arkasına.',plan:{style:'direct',press:1,risk:1,tempo:2,width:1,tackle:1}}
].map(preset=>Object.freeze({...preset,plan:Object.freeze(preset.plan)})));
export const PRESET_KEYS=Object.freeze(['style','press','risk','tempo','width','tackle']);
// Plan bir profille birebir eşleşiyorsa onun kimliği, yoksa null ("Özel").
export function matchPreset(plan){
 return TACTIC_PRESETS.find(preset=>PRESET_KEYS.every(key=>String(preset.plan[key])===String(plan?.[key])))?.id||null;
}
