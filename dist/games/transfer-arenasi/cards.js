// FC snapshot values are displayed individually; no invented aggregate PAC/PHY ratings.
export const ATTRIBUTES = {
  finishing:'Bitiricilik',positioning:'Hücum konumu',composure:'Soğukkanlılık',shotPower:'Şut gücü',
  vision:'Görüş',shortPassing:'Kısa pas',ballControl:'Top kontrolü',defensiveAwareness:'Savunma',
  interceptions:'Araya girme',standingTackle:'Müdahale',stamina:'Kondisyon',sprintSpeed:'Sprint',
  gkDiving:'Uzanma',gkHandling:'Top tutma',gkPositioning:'Kaleci konumu',gkReflexes:'Refleks',penalties:'Penaltı'
};
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function playerCard(player) {
  const keys=player.position==='GK'?['gkDiving','gkHandling','gkPositioning','gkReflexes','shortPassing','composure']:['sprintSpeed','finishing','shortPassing','ballControl','standingTackle','stamina'];
  const value=k=>Number.isFinite(player.attributes?.[k])?player.attributes[k]:'—';
  return `<article class="football-card tier-${player.overall>=88?'elite':player.overall>=82?'gold':'silver'}" aria-label="${escapeHTML(player.name)}, ${player.overall} overall">
    <div class="card-top"><div class="overall"><strong>${player.overall}</strong><span>${escapeHTML(player.detailPosition||player.position)}</span></div><span class="edition">${player.bonus?'BONUS':'FC 27'}${player.isCaptain?'<b class="captain-badge" aria-label="Kaptan">ⓒ</b>':''}</span></div>
    <div class="portrait-slot">${player.portraitURL?`<img src="${escapeHTML(player.portraitURL)}" alt="${escapeHTML(player.name)}" width="240" height="240">`:'<svg viewBox="0 0 160 160" aria-hidden="true"><circle cx="80" cy="51" r="29"/><path d="M18 155v-20c0-35 25-55 62-55s62 20 62 55v20z"/></svg>'}</div>
    <h2>${escapeHTML(player.name)}</h2><p class="identity">${[player.country,player.club].filter(Boolean).map(escapeHTML).join(' · ')}</p>
    <dl class="card-stats">${keys.map(k=>`<div><dd>${value(k)}</dd><dt>${ATTRIBUTES[k]}</dt></div>`).join('')}</dl>
    <details><summary>Tüm özellikler</summary><dl class="all-stats">${Object.keys(ATTRIBUTES).map(k=>`<div><dt>${ATTRIBUTES[k]}</dt><dd>${value(k)}</dd></div>`).join('')}</dl></details>
  </article>`;
}
