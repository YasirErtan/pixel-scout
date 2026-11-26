import {escapeHTML as esc,framedPhoto} from './cards.js';
import {COACH_PORTRAITS} from './coach-portraits.js';
import {COACH_SPECIALTY_PER_STAR} from './tactic-presets.js';

// Tam boy çekilmiş fotoğraflar için yüz odağı: [x%, y%, yakınlaştırma].
const COACH_FOCUS={'coach-mikel-arteta':[42,16,1.9],'coach-jupp-heynckes':[57,14,1.7],'coach-alex-ferguson':[55,28,1.3]};
// Kural sürümü 5: hocanın yıldızı tüm futbolcu özelliklerine çarpan olarak eklenir; etki yıldız azaldıkça hızla düşer.
export const COACH_RATING_BOOST=Object.freeze({1:.002,2:.008,3:.02,4:.045,5:.08});
export const coachRatingBoost=coach=>COACH_RATING_BOOST[coach?.stars]||0;
export const SPECIALTIES={press:'Pres',passing:'Pas oyunu',defense:'Savunma',transition:'Geçiş hücumu',development:'Gelişim',discipline:'Disiplin',attack:'Hücum futbolu',fitness:'Kondisyon'};
// Model 7'de uzmanlık katsayısı yıldız başına COACH_SPECIALTY_PER_STAR (eski: .02); metindeki sayılar aynı oranda ölçeklenir.
const number=n=>new Intl.NumberFormat('tr-TR',{maximumFractionDigits:1}).format(n);
export function coachEffect(coach,{rulesVersion=0}={}){
 const stars=coach.stars*(rulesVersion>=7?COACH_SPECIALTY_PER_STAR/.02:1);
 switch(coach.specialty){
  case 'press':return `Yoğun pres seçildiğinde enerji tüketimini %${number(stars*2)} azaltır.`;
  case 'passing':return `Kısa pas taktiğinde başarılı pas ihtimaline ${number(stars*1.2)} yüzde puan ekler.`;
  case 'defense':return `Temkinli oyunda rakibin penaltı dışındaki şutlarının gol ihtimalini ${number(stars*.5)} yüzde puan azaltır.`;
  case 'transition':return `Kontra atakta, hücum bölgesine ulaşmadan önce başarılı pas ihtimaline ${number(stars*.6)} yüzde puan ekler.`;
  case 'development':return `Reytingi 81 ve altında olan futbolcuların başarılı pas ihtimaline ${number(stars*.6)} yüzde puan ekler.`;
  case 'discipline':return `Müdahalelerde faul yapma ihtimalini %${number(stars*2)} azaltır. Kart riskini faulleri azaltarak dolaylı düşürür.`;
  case 'attack':return `Hücum riski seçildiğinde penaltı dışındaki şutlarının gol ihtimaline ${number(stars*.5)} yüzde puan ekler.`;
  case 'fitness':return `Takımının maç boyunca harcadığı enerjiyi %${number(stars*1.5)} azaltır.`;
  default:return 'Uzmanlık bilgisi bulunamadı.';
 }
}
export function coachCard(coach,opts={}){
 const photo=COACH_PORTRAITS[coach.id];
 return `<article class="panel coach-card"><span class="eyebrow">TEKNİK DİREKTÖR</span>${photo?framedPhoto(photo.path,coach.name,COACH_FOCUS[coach.id]||[50,0,1],'coach-photo',240,250):'<div class="coach-silhouette" aria-hidden="true">♟</div>'}<h2>${esc(coach.name)}</h2><p>${esc(SPECIALTIES[coach.specialty])} · <span aria-label="${coach.stars} yıldız">${'★'.repeat(coach.stars)}${'☆'.repeat(5-coach.stars)}</span></p><p class="coach-boost">Takım gücü: tüm futbolcu özelliklerine <strong>+%${number(coachRatingBoost(coach)*100)}</strong></p><p class="coach-effect">${esc(coachEffect(coach,opts))}</p>${photo?`<details class="photo-credit"><summary>Fotoğraf kaynağı ve lisansı</summary><p>${esc(photo.author)} · <a href="${esc(photo.source)}" target="_blank" rel="noopener noreferrer">Wikimedia Commons</a> · <a href="${esc(photo.licenseURL||photo.source)}" target="_blank" rel="noopener noreferrer">${esc(photo.license)}</a></p><p>Yakın kadraj</p></details>`:''}</article>`;
}
