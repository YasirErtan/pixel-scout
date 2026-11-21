import {escapeHTML as esc} from './cards.js';
import {logoSVG} from './logos.js';

const date=value=>new Intl.DateTimeFormat('tr-TR',{day:'numeric',month:'short',year:'numeric'}).format(value);
const team=row=>`${row.logo?logoSVG(row.logo,18)+' ':''}${esc(row.name)}`;
const score=row=>row.score.join(' – ')+(row.shootout?` <small>(pen. ${row.shootout.join('–')})</small>`:'');

export function championsTable(list){
 if(!list.length)return '<p class="small muted">Henüz şampiyon yok. İlk kupayı sen kaldır.</p>';
 return `<table class="champions-table"><thead><tr><th>Şampiyon</th><th>Final</th><th>İkinci</th><th>Hoca</th><th>Gol kralı</th><th>Tarih</th></tr></thead><tbody>${list.map(row=>`<tr><th>${team(row.champion)}</th><td>${score(row)}</td><td>${team(row.runnerUp)}</td><td>${esc(row.champion.coach||'—')}</td><td>${row.topScorer?`${esc(row.topScorer.name)} · ${row.topScorer.goals}`:'—'}</td><td>${date(row.finishedAt)}</td></tr>`).join('')}</tbody></table>`;
}
