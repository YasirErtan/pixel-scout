import {playerCard,escapeHTML as esc} from './cards.js';
import {coachCard} from './coach-card.js';
import {ATTRIBUTE_KEYS,PLAYER_ATTRIBUTES} from '../fut-draft/player-attributes.js';
const $=s=>document.querySelector(s),status=$('#status'),game=$('#game');
const storage='pixel-scout:transfer-arenasi:v1';
let room=null,busy=false,key='',offset=0,code='';
try{code=localStorage.getItem(storage)||'';}catch{}
const phases={lobby:'Lobi',players:'Futbolcu ihalesi',coaches:'Teknik direktör ihalesi',prepare:'Maç öncesi',firstHalf:'İlk yarı',halftime:'Devre arası',secondHalf:'İkinci yarı',finalResolution:'Uzatma ve penaltılar',finished:'Kupa sahibi belli'};
const names=id=>esc(room.teams.find(t=>t.id===id)?.name||'—');
async function send(type,extra={}){
 if(busy){if(type==='poll')return;await new Promise(resolve=>setTimeout(resolve,80));return send(type,extra);}busy=true;
 const action={type,requestId:crypto.randomUUID(),code:room?.id||$('#code').value.trim()||code,...extra};
 try{
  const response=await fetch('/api/transfer-arena',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(action),signal:AbortSignal.timeout(12000)});
  const data=await response.json();if(!response.ok)throw Error(data.error||'Bağlantı kurulamadı');
  room=data;code=room.id;offset=data.serverNow-Date.now();
  try{localStorage.setItem(storage,code);}catch{}
  status.textContent='Bağlandı · Oda '+code+' · '+phases[room.phase];render();
 }catch(e){status.textContent=e.message==='Failed to fetch'?'Bağlantı koptu; yeniden deneniyor…':e.message;}
 finally{busy=false;}
}
function button(type,label,disabled=false){return `<button data-action="${type}" ${disabled?'disabled':''}>${label}</button>`;}
function select(name,label,options,value){return `<label>${label}<select name="${name}">${options.map(([v,l])=>`<option value="${v}" ${String(v)===String(value)?'selected':''}>${l}</option>`).join('')}</select></label>`;}
function tactics(){
 const p=room.myPlan;
 return `<form id="plan-form" class="tactics-grid">${select('formation','Diziliş',[['2-2-2','2-2-2 Dengeli'],['2-3-1','2-3-1 Orta saha'],['3-2-1','3-2-1 Savunma'],['1-3-2','1-3-2 Hücum']],p.formation)}${select('style','Oyun tarzı',[['short','Kısa pas'],['wide','Kanat oyunu'],['direct','Direkt oyun'],['counter','Kontra atak']],p.style)}${[['press','Pres',['Geri çekil','Dengeli','Yoğun pres']],['risk','Risk',['Temkinli','Dengeli','Hücum']],['tempo','Tempo',['Sakin','Normal','Yüksek']],['width','Genişlik',['Dar','Dengeli','Geniş']],['tackle','Müdahale',['Temiz','Normal','Sert','Çok sert']]].map(([k,label,opts])=>select(k,label,opts.map((l,i)=>[i,l]),p[k])).join('')}<p class="muted small">Yoğun pres ve tempo enerji tüketir. Sert müdahale top kazanmayı artırır; faul ve kırmızı kart riski yükselir. Taktiğini yalnız sen görürsün.</p><button>Gizli taktiği kilitle</button></form>`;
}
function stage(){
 const me=room.teams.find(t=>t.id===room.uid);
 if(room.phase==='lobby')return `<h2>Arkadaşlarını bekle</h2><p>Oda kodu <strong class="room-code">${room.id}</strong> · 3–6 takım</p><ul>${room.teams.map(t=>`<li>${esc(t.name)} ${t.ready?'✓ Hazır':'· Bekliyor'}</li>`).join('')}</ul><div class="actions">${button('ready',me.ready?'Hazırsın':'Hazırım',me.ready)}${room.owner===room.uid?button('start','İhaleyi başlat',room.teams.length<3||!room.teams.every(t=>t.ready)):''}</div>`;
 if(['players','coaches'].includes(room.phase)){
  const lot=room.lot,c=lot.card,allowed=c.kind==='coach'?!me.coach:me.players.filter(p=>p.position===c.position).length<({GK:1,DEF:2,MID:2,ATT:2}[c.position]);
  const max=me.balance-(8-me.players.length-Number(Boolean(me.coach))-1);
  const can=allowed&&!lot.passed.includes(me.id)&&lot.bidder!==me.id&&max>lot.amount;
  return `<h2>${phases[room.phase]}</h2><p>${lot.bidder?names(lot.bidder)+' · '+lot.amount+' kredi':'Henüz teklif yok'} · Senin bütçen: <b>${me.balance}</b></p><p class="muted">Her boş futbolcu ve hoca yeri için 1 kredi ayrılır. En yüksek teklifin: ${max}</p><div class="auction-card">${c.kind==='coach'?coachCard(c):playerCard(c)}</div><form id="bid-form" class="actions"><label>Teklif<input id="amount" type="number" min="${lot.amount+1}" max="${max}" step="1" value="${lot.amount+1}" ${can?'':'disabled'}></label><button ${can?'':'disabled'}>Teklif ver</button>${button('pass','Pas geç',lot.passed.includes(me.id)||!allowed)}</form><p class="muted small">Pas bu kart için kesindir. Teklif gelmezse kart havuza gider; pazar sonunda boş mevkiler arasında dengeli dağıtılır.</p>`;
 }
 if(['prepare','halftime'].includes(room.phase)){
  const playing=room.pairs.flat().includes(me.id);
  const referee=room.referees?.find(r=>r.teams.includes(me.id));
  return `<h2>${room.final?'Final · ':''}${phases[room.phase]}</h2>${referee?'<p>Hakem: '+['Toleranslı','Normal','Katı'][referee.strictness]+' · Sertliğin kart riski buna göre değişir.</p>':''}${!playing?'<p>Bu hafta maçın yok. Diğer maçları izleyebilirsin.</p>':room.locked.includes(me.id)?'<p>✓ Taktiğin kilitlendi. Rakip bekleniyor.</p>':tactics()}`;
 }
 if(room.phase==='finished')return `<p class="eyebrow">KUPANIN SAHİBİ</p><h2>🏆 ${names(room.champion)}</h2><p>Tebrikler! Lig ve final tamamlandı.</p><button id="leave">Başlangıca dön</button>`;
 return `<h2>${room.final?'Final · ':''}${phases[room.phase]}</h2><p>Maçlar ortak zaman çizelgesinde oynanıyor.</p>`;
}
function render(){
 $('#connection').hidden=true;document.querySelector('.preview-wrap').hidden=true;
 if(!$('#stage'))game.innerHTML='<div class="room-bar"><strong id="room-label"></strong><span id="timer"></span></div><section id="stage" class="panel"></section><section id="matches" class="match-grid"></section><section class="panel"><h2>Puan durumu</h2><div id="table" class="table-scroll"></div></section><section id="squads"></section><details class="panel"><summary>Açılan kartlar ve pas havuzu</summary><div id="history"></div></details>';
 $('#room-label').textContent='ODA '+room.id+' · '+(room.final?'Final':(room.round+1)+'. hafta');
 const nextKey=[room.phase,room.phaseVersion,room.lot?.id,room.lot?.amount,room.lot?.bidder,room.lot?.passed.includes(room.uid),room.locked.includes(room.uid),room.teams.map(t=>t.id+t.ready).join(),room.champion].join('|');
 if(nextKey!==key){key=nextKey;$('#stage').innerHTML=stage();bindStage();}
 $('#table').innerHTML='<table><thead><tr><th>Takım</th><th>P</th><th>G</th><th>Av.</th><th>Gol</th></tr></thead><tbody>'+room.table.map(id=>{const t=room.teams.find(t=>t.id===id);return `<tr ${id===room.uid?'class="my-team"':''}><th>${esc(t.name)}</th><td>${t.points}</td><td>${t.wins}</td><td>${t.gf-t.ga}</td><td>${t.gf}:${t.ga}</td></tr>`;}).join('')+'</tbody></table>'+(room.draws.length?'<p class="small">Tam eşitlikte uygulanan kura sırası: '+room.draws.map(group=>group.map(names).join(' → ')).join(' / ')+'</p>':'');
 const events={goal:'⚽ Gol',shot:'Şut dışarı',save:'Kaleci kurtardı',yellow:'🟨 Sarı kart',red:'🟥 Kırmızı kart',foul:'Faul',forfeit:'Hükmen sonuç',extraTime:'Uzatmalar başladı',shootout:'Penaltı'};
 $('#matches').innerHTML=room.matches.map(m=>`<article class="panel match"><h3>${names(m.teams[0].id)} <strong>${m.score.join(' : ')}</strong> ${names(m.teams[1].id)}</h3><p>${m.minute.toFixed(1)}′ ${m.shootout?'· Penaltılar '+m.shootout.score.join(':'):''}</p><ol class="event-log">${m.events.slice(-8).reverse().map(e=>`<li>${e.minute.toFixed(1)}′ ${events[e.type]||esc(e.type)} ${e.playerName?esc(e.playerName):''}${e.type==='shootout'?(e.scored?' ✓':' ✕'):''}</li>`).join('')}</ol></article>`).join('');
 const squadsKey=room.teams.map(t=>t.id+':'+t.players.length+':'+t.coach?.id).join('|');
 if($('#squads').dataset.key!==squadsKey){$('#squads').dataset.key=squadsKey;$('#squads').innerHTML=room.teams.map(t=>`<details class="panel"><summary>${esc(t.name)} · ${t.players.length}/7 futbolcu · ${t.balance} kredi</summary><div class="squad-cards">${t.players.map(playerCard).join('')}${t.coach?coachCard(t.coach):''}</div></details>`).join('');}
 $('#history').innerHTML=room.history.map(h=>`<p>${esc(h.card.name)} · ${h.bidder?names(h.bidder)+' · '+h.amount+' kredi':'Pas havuzu'}</p>`).join('');
 $('#matches').insertAdjacentHTML('beforeend',(['prepare','lobby'].includes(room.phase)?[]:room.discipline||[]).map(m=>'<div class="panel small">'+m.teams.map(t=>{const cards=t.players.filter(p=>p.red||p.yellow);return cards.length?'<p>'+names(t.id)+': '+cards.map(p=>esc(p.name)+' '+(p.red?'🟥 Oyun dışında':'🟨 '+p.yellow)).join(' · ')+'</p>':'';}).filter(Boolean).join('')+'</div>').filter(s=>s!=='<div class="panel small"></div>').join(''));
 tick();
}
function bindStage(){
 $('#stage').querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();send(b.dataset.action,{lotId:room.lot?.id});}));
 $('#bid-form')?.addEventListener('submit',e=>{e.preventDefault();send('bid',{amount:Number($('#amount').value),lotId:room.lot.id});});
 $('#plan-form')?.addEventListener('submit',e=>{e.preventDefault();const plan=Object.fromEntries(new FormData(e.currentTarget));for(const k of ['press','risk','tempo','width','tackle'])plan[k]=Number(plan[k]);send('plan',{phaseVersion:room.phaseVersion,plan});});
 $('#leave')?.addEventListener('click',()=>{try{localStorage.removeItem(storage);}catch{}location.reload();});
}
function tick(){if($('#timer')&&room)$('#timer').textContent=room.phase==='finished'?'Tamamlandı':room.phase==='lobby'?'Arkadaşların bekleniyor':Math.max(0,Math.ceil((room.deadline-Date.now()-offset)/1000))+' sn';}
$('#create').disabled=false;$('#join').disabled=false;
$('#create').addEventListener('click',()=>send('create',{name:$('#name').value}));$('#join').addEventListener('click',()=>send('join',{name:$('#name').value}));
setInterval(()=>{if(room&&room.phase!=='finished')send('poll');},1500);setInterval(tick,200);
try{const response=await fetch('../fut-draft/players.json');const data=await response.json(),p=data.players[0],values=PLAYER_ATTRIBUTES[p.id]||[];$('#preview').innerHTML=playerCard({...p,attributes:Object.fromEntries(ATTRIBUTE_KEYS.map((k,i)=>[k,values[i]]))});}catch{}
status.textContent='200 kredi · 7 futbolcu · 1 hoca. Bir oda kur veya arkadaşının kodunu gir.';
if(code)send('poll');
