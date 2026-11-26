// Mobil öncelikli maç ekranı: kendi maçın için skor tabelası, canlı istatistik şeridi ve anlatım;
// diğer maçlar sade satırlar. Yalnız sunucunun gösterdiği (görünen dakikaya kadar) veriyi kullanır.
import {escapeHTML as esc} from './cards.js';
import {minuteLabel,displayMinute} from './pitch.js';
import {commentaryLine,isKeyMoment} from './commentary.js';
import {matchReport} from './match-report.js';

const SHOT_TYPES=new Set(['goal','shot','save','post']);
const regulation=(m,room)=>m.regulationMinutes||(room.rulesVersion>=2?90:20);
const clock=(m,room)=>minuteLabel(Math.min(displayMinute(m.minute,regulation(m,room)),120));

export function liveStats(match){
 const sides=match.teams.map(t=>({id:t.id,shots:0,onTarget:0,xg:0}));
 for(const e of match.events||[]){
  if(!SHOT_TYPES.has(e.type))continue;
  const s=sides.find(x=>x.id===e.team);if(!s)continue;
  s.shots++;if(e.type==='goal'||e.type==='save')s.onTarget++;
  if(Number.isFinite(e.xg))s.xg+=e.xg;
 }
 // Topa sahip olma ve pas yalnız dilim sonu kayıtlarında var; son görünen kayıt kullanılır.
 const snap=(match.snapshots||[]).filter(x=>x.minute<=match.minute).at(-1);
 if(snap)for(const s of sides){
  const t=snap.teams.find(x=>x.id===s.id),total=snap.teams.reduce((n,x)=>n+(x.possessionTicks||0),0);
  if(t&&total)s.possession=Math.round(100*(t.possessionTicks||0)/total);
  if(t?.passes)s.passPct=Math.round(100*t.completed/t.passes);
 }
 return {sides,snapMinute:snap?.minute??null};
}

const isForfeit=m=>(m.events||[]).some(e=>e.type==='forfeit');

function stateLabel(room,m){
 if(m.shootout)return 'Penaltılar';
 if(isForfeit(m))return 'Hükmen';
 if(room.phase==='finished'||(room.phase==='prepare'&&m.minute>=90))return 'Maç sonu';
 if(room.phase==='halftime')return 'Devre arası';
 if(m.minute>90)return 'Uzatma';
 if(room.phase==='firstHalf')return 'İlk yarı';
 if(room.phase==='secondHalf')return 'İkinci yarı';
 return '';
}

function scorers(m,teamId,room){
 return m.events.filter(e=>e.type==='goal'&&e.team===teamId).map(e=>`<li>${esc(e.playerName||'—')} ${minuteLabel(displayMinute(e.minute,regulation(m,room)))}${e.setPiece==='penalty'||e.penalty?' (P)':''}</li>`).join('');
}

function statRow(label,a,b,fmt=v=>v){
 if(a==null||b==null)return '';
 const total=(+a)+(+b),left=total?Math.round(100*a/total):50;
 return `<div class="ms-stat"><b>${fmt(a)}</b><span>${label}<i aria-hidden="true"><em style="width:${left}%"></em></i></span><b>${fmt(b)}</b></div>`;
}

function board(room,m,names){
 const [a,b]=m.teams,allIn=new Set(m.events.filter(e=>e.type==='allIn').map(e=>e.team)),st=liveStats(m);
 const [sa,sb]=st.sides,label=stateLabel(room,m);
 const side=(t,cls)=>`<div class="ms-side ${cls}"><strong class="ms-name">${names(t.id)}</strong>${t.captainName?`<span class="ms-captain" title="Kaptan">ⓒ ${esc(t.captainName)}</span>`:''}${allIn.has(t.id)?'<span class="ms-allin">🔥 Tüm riskler</span>':''}<ul class="ms-scorers">${scorers(m,t.id,room)}</ul></div>`;
 const pct=v=>'%'+v,xg=v=>v.toFixed(1).replace('.',',');
 const feed=m.events.map((e,i)=>({e,i})).filter(({e})=>e.type!=='foul').slice(-6).reverse();
 const report=['halftime','finished'].includes(room.phase)||m.minute>=90||isForfeit(m)?matchReport(m,room.teams,{minute:m.minute}):'';
 return `<article class="ms-main" aria-label="Senin maçın">
  <div class="ms-board">${side(a,'home')}<div class="ms-score"><span class="ms-goals" aria-label="Skor ${m.score.join(' - ')}">${m.score.join('<i>–</i>')}</span><span class="ms-clock">${clock(m,room)}</span>${label?`<span class="ms-state">${label}</span>`:''}${m.shootout?`<span class="ms-pens">Pen. ${m.shootout.score.join('–')}</span>`:''}</div>${side(b,'away')}</div>
  <div class="ms-stats" aria-label="Canlı istatistik">${statRow('Şut',sa.shots,sb.shots)}${statRow('İsabetli',sa.onTarget,sb.onTarget)}${statRow('xG',sa.xg,sb.xg,xg)}${statRow('Topa sahip',sa.possession,sb.possession,pct)}${statRow('Pas',sa.passPct,sb.passPct,pct)}${st.snapMinute!=null&&sa.possession!=null?`<p class="ms-note">Topa sahip olma ve pas ${st.snapMinute}′ itibarıyla</p>`:''}</div>
  ${feed.length?`<ol class="ms-feed">${feed.map(({e})=>`<li class="${isKeyMoment(e)?'key':''}"><time>${minuteLabel(displayMinute(e.minute,regulation(m,room)),e.type==='shootout')}</time><span>${commentaryLine(e,m,names)}</span></li>`).join('')}</ol>`:'<p class="ms-empty">Maç başlamak üzere.</p>'}
  ${report?`<details class="ms-report" ${room.phase==='finished'?'open':''}><summary>${room.phase==='halftime'?'Devre arası raporu':'Maç raporu'}</summary>${report}</details>`:''}
 </article>`;
}

function row(room,m,names){
 return `<li class="ms-row"><span class="ms-row-team">${names(m.teams[0].id)}</span><strong>${m.score.join(' – ')}</strong><span class="ms-row-team away">${names(m.teams[1].id)}</span><small>${m.shootout?'Pen. '+m.shootout.score.join('–'):clock(m,room)}</small></li>`;
}

export function matchScreen(room,names){
 const mine=room.matches.find(m=>m.teams.some(t=>t.id===room.uid));
 const others=room.matches.filter(m=>m!==mine);
 return (mine?board(room,mine,names):'<p class="ms-bye panel">Bu hafta maçın yok; diğer maçları izliyorsun.</p>')+
  (others.length?`<section class="ms-others panel" aria-label="Diğer maçlar"><h3>Diğer maçlar</h3><ol>${others.map(m=>row(room,m,names)).join('')}</ol></section>`:'');
}
