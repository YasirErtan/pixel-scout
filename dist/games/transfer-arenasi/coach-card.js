import {escapeHTML as esc} from './cards.js';
import {COACH_PORTRAITS} from './coach-portraits.js';

export const SPECIALTIES={press:'Pres',passing:'Pas oyunu',defense:'Savunma',transition:'Geçiş hücumu',development:'Gelişim',discipline:'Disiplin'};
const number=n=>new Intl.NumberFormat('tr-TR',{maximumFractionDigits:1}).format(n);
export function coachEffect(coach){
 const stars=coach.stars;
 switch(coach.specialty){
  case 'press':return `Yoğun pres seçildiğinde enerji tüketimini %${number(stars*2)} azaltır.`;
  case 'passing':return `Kısa pas taktiğinde başarılı pas ihtimaline ${number(stars*1.2)} yüzde puan ekler.`;
  case 'defense':return `Temkinli oyunda rakibin penaltı dışındaki şutlarının gol ihtimalini ${number(stars*.5)} yüzde puan azaltır.`;
  case 'transition':return `Kontra atakta, hücum bölgesine ulaşmadan önce başarılı pas ihtimaline ${number(stars*.6)} yüzde puan ekler.`;
  case 'development':return `Reytingi 81 ve altında olan futbolcuların başarılı pas ihtimaline ${number(stars*.6)} yüzde puan ekler.`;
  case 'discipline':return `Müdahalelerde faul yapma ihtimalini %${number(stars*2)} azaltır. Kart riskini faulleri azaltarak dolaylı düşürür.`;
  default:return 'Uzmanlık bilgisi bulunamadı.';
 }
}
export function coachCard(coach){
 const photo=COACH_PORTRAITS[coach.id];
 return `<article class="panel coach-card"><span class="eyebrow">TEKNİK DİREKTÖR</span>${photo?`<img class="coach-photo" src="${esc(photo.path)}" alt="${esc(coach.name)}" width="240" height="250" loading="lazy">`:'<div class="coach-silhouette" aria-hidden="true">♟</div>'}<h2>${esc(coach.name)}</h2><p>${esc(SPECIALTIES[coach.specialty])} · <span aria-label="${coach.stars} yıldız">${'★'.repeat(coach.stars)}${'☆'.repeat(5-coach.stars)}</span></p><p class="coach-effect">${esc(coachEffect(coach))}</p>${photo?`<details class="photo-credit"><summary>Fotoğraf kaynağı ve lisansı</summary><p>${esc(photo.author)} · <a href="${esc(photo.source)}" target="_blank" rel="noopener noreferrer">Wikimedia Commons</a> · <a href="${esc(photo.licenseURL||photo.source)}" target="_blank" rel="noopener noreferrer">${esc(photo.license)}</a></p><p>Yakın kadraj</p></details>`:''}</article>`;
}
