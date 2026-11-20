import {LEGEND_PORTRAITS} from './legend-portraits.js';
import {playerAvatarSVG} from './avatar.js';
// FC snapshot values are displayed individually; no invented aggregate PAC/PHY ratings.
export const ATTRIBUTES = {
  finishing:'Bitiricilik',positioning:'Hücum konumu',composure:'Soğukkanlılık',shotPower:'Şut gücü',
  vision:'Görüş',shortPassing:'Kısa pas',ballControl:'Top kontrolü',defensiveAwareness:'Savunma',
  interceptions:'Araya girme',standingTackle:'Müdahale',stamina:'Kondisyon',sprintSpeed:'Sprint',
  gkDiving:'Uzanma',gkHandling:'Top tutma',gkPositioning:'Kaleci konumu',gkReflexes:'Refleks',penalties:'Penaltı'
};
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const displayPosition = p => { const pos = p?.detailPosition || p?.position || ''; return pos === 'RM' ? 'RW' : pos === 'LM' ? 'LW' : pos; };
// Fotoğrafı çerçeveye oturtur: focus=[x%,y%,yakınlaştırma,shiftX%] yüzü merkezde tutar.
export function framedPhoto(src,alt,focus,className,width=240,height=240){
  const [x,y,zoom,shiftX=0]=focus||[50,15,1,0];
  const shift=shiftX?` translateX(${shiftX}%)`:'';
  return `<span class="${className}"><img src="${escapeHTML(src)}" alt="${escapeHTML(alt)}" width="${width}" height="${height}" loading="lazy" style="object-position:${x}% ${y}%;transform-origin:${x}% ${y}%;transform:scale(${zoom})${shift}"></span>`;
}
export function playerCard(player) {
  const keys=player.position==='GK'?['gkDiving','gkHandling','gkPositioning','gkReflexes','shortPassing','composure']:['sprintSpeed','finishing','shotPower','shortPassing','ballControl','standingTackle','stamina'];
  const value=k=>Number.isFinite(player.attributes?.[k])?player.attributes[k]:'—';
  const photo=player.legend?LEGEND_PORTRAITS[player.id]:null;
  const focus=photo?.focus||player.portraitFocus||(player.bonus?[50,16,1.18,-6.5]:null);
  return `<article class="football-card ${player.legend?'legend-card ':''}${player.bonus?'bonus-card ':''}tier-${player.overall>=88?'elite':player.overall>=82?'gold':'silver'}" aria-label="${escapeHTML(player.name)}, ${player.overall} overall">
    <div class="card-top"><div class="overall"><strong>${player.overall}</strong><span>${escapeHTML(displayPosition(player))}</span></div><span class="edition">${player.legend?'EFSANE KART':player.bonus?'BONUS':''}${player.isCaptain?'<b class="captain-badge" aria-label="Kaptan">ⓒ</b>':''}</span></div>
    <div class="portrait-slot">${player.portraitURL?framedPhoto(player.portraitURL,player.name,focus,'portrait-photo'):playerAvatarSVG(player)}</div>
    <h2>${escapeHTML(player.name)}</h2><p class="identity">${[player.country,player.club].filter(Boolean).map(escapeHTML).join(' · ')}</p>
    <dl class="card-stats">${keys.map(k=>`<div><dd>${value(k)}</dd><dt>${ATTRIBUTES[k]}</dt></div>`).join('')}</dl>
    <details><summary>Tüm özellikler</summary><dl class="all-stats">${Object.keys(ATTRIBUTES).map(k=>`<div><dt>${ATTRIBUTES[k]}</dt><dd>${value(k)}</dd></div>`).join('')}</dl></details>
    ${photo?`<details class="photo-credit"><summary>Fotoğraf kaynağı ve lisansı</summary><p>${escapeHTML(photo.author)} · <a href="${escapeHTML(photo.source)}" target="_blank" rel="noopener noreferrer">Wikimedia Commons</a> · <a href="${escapeHTML(photo.licenseURL||photo.source)}" target="_blank" rel="noopener noreferrer">${escapeHTML(photo.license)}</a></p><p>Yakın kadraj</p></details>`:''}
  </article>`;
}
