import {formationLimits} from './formation.js';
import {escapeHTML as esc} from './cards.js';
import {SPECIALTIES} from './coach-card.js';
import {playerAvatarSVG} from './avatar.js';

const ROLE_NAMES={GK:'KL',DEF:'DEF',MID:'OS',ATT:'FV'};
const tier=p=>p.legend?'legend':p.overall>=88?'elite':p.overall>=82?'gold':'silver';
// Satır sırası FIFA taktik ekranı gibi: forvet üstte, kaleci altta.
function rows(team){
 const formation=team.formation||'2-2-2',limits=formationLimits(formation);
 return ['ATT','MID','DEF','GK'].map(role=>{
  const players=team.players.filter(p=>p.position===role).toSorted((a,b)=>b.overall-a.overall);
  const slots=Math.max(limits[role],players.length);
  return {role,cells:Array.from({length:slots},(_,i)=>players[i]||null)};
 });
}
function chip(p,role,captains){
 if(!p)return `<div class="board-chip empty"><span>${ROLE_NAMES[role]}</span><small>Boş</small></div>`;
 const photo=p.portraitURL?`<img src="${esc(p.portraitURL)}" alt="" loading="lazy" width="48" height="48">`:`<span class="chip-avatar">${playerAvatarSVG(p,{compact:true})}</span>`;
 return `<div class="board-chip tier-${tier(p)}" title="${esc(p.name)} · ${p.overall}"><b>${p.overall}</b><i>${esc(p.detailPosition||p.position)}</i>${photo}<strong>${esc(p.name)}</strong>${captains.has(p.id)?'<em aria-label="Kaptan">ⓒ</em>':''}</div>`;
}
// İhalede kendi dizilişin (boş yerler kesikli) ve rakip kadrolarının saha görünümü.
export function squadBoard(team,{captains=new Set(),coach=true}={}){
 const filled=team.players.length;
 return `<div class="squad-board"><div class="board-pitch" role="img" aria-label="${esc(team.name)} · ${esc(team.formation||'2-2-2')} · ${filled}/7 futbolcu"><div class="pitch-markings" aria-hidden="true"></div>${rows(team).map(row=>`<div class="board-row">${row.cells.map(p=>chip(p,row.role,captains)).join('')}</div>`).join('')}</div>${coach?`<div class="board-coach">${team.coach?`<span>Teknik direktör</span><strong>${esc(team.coach.name)}</strong><small>${esc(SPECIALTIES[team.coach.specialty]||'')} · ${'★'.repeat(team.coach.stars)}</small>`:'<span>Teknik direktör</span><small>Henüz yok</small>'}</div>`:''}</div>`;
}
