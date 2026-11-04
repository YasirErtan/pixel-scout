import {assignFormation} from './formation.js';
import {escapeHTML as esc} from './cards.js';
export function pitch(team,formation,captainId,redIds=[]){
 const active=team.players.filter(p=>!redIds.includes(p.id));
 const keeper=active.find(p=>p.position==='GK')||active.toSorted((a,b)=>a.attributes.finishing-b.attributes.finishing)[0];
 const field=assignFormation(active.filter(p=>p!==keeper&&p.position!=='GK'),formation);
 const shirt=p=>`<div class="pitch-player ${p.roleFit===.92?'out-of-position':''}" title="${esc(p.name)}"><span class="shirt">${p.overall}${String(p.id)===String(captainId)?'<b>ⓒ</b>':''}</span><strong>${esc(p.name)}</strong><small>${esc(p.detailPosition||p.position)}${p.roleFit===.92?' · Mevki dışı':''}</small></div>`;
 return `<div class="pitch" role="img" aria-label="${esc(team.name)} · ${formation} dizilişi"><div class="pitch-markings" aria-hidden="true"></div>${['ATT','MID','DEF'].map(role=>'<div class="pitch-row">'+field.filter(p=>p.matchRole===role).map(shirt).join('')+'</div>').join('')}<div class="pitch-row">${keeper?shirt(keeper):''}</div></div>`;
}
export function minuteLabel(minute,shootout=false){return shootout?'Penaltı':Math.max(1,Math.ceil(minute))+'′';}
