import {playerCard,escapeHTML as esc} from './cards.js';
import {coachCard} from './coach-card.js';
import {CAPTAIN_BOOST} from './bonus-player.js';
import {ATTRIBUTE_KEYS,PLAYER_ATTRIBUTES} from '../fut-draft/player-attributes.js';
const $=s=>document.querySelector(s),status=$('#status'),game=$('#game');
const storage='pixel-scout:transfer-arenasi:v1';
let room=null,busy=false,key='',offset=0,code='',previewPlayer=null;
try{code=localStorage.getItem(storage)||'';}catch{}
const phases={lobby:'Lobi',players:'Futbolcu ihalesi',coaches:'Hoca ihalesi',prepare:'Maç öncesi',firstHalf:'İlk yarı',halftime:'Devre arası',secondHalf:'İkinci yarı',finalResolution:'Uzatma ve penaltılar',finished:'Kupa sahibi belli'};
const names=id=>esc(room.teams.find(t=>t.id===id)?.name||'—');
async function send(type,extra={}){
 if(busy){if(type==='poll')return;await new Promise(resolve=>setTimeout(resolve,80));return send(type,extra);}busy=true;
 if(!room){$('#create').disabled=true;$('#join').disabled=true;}
 const action={type,requestId:crypto.randomUUID(),code:room?.id||$('#code').value.trim()||code,...extra};
 try{
  const response=await fetch('/api/transfer-arena',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(action),signal:AbortSignal.timeout(12000)});
  const data=await response.json();if(!response.ok)throw Error(typeof data.error==='string'?data.error:'Bağlantı kurulamadı');
  room=data;code=room.id;offset=data.serverNow-Date.now();
  try{localStorage.setItem(storage,code);}catch{}
  status.textContent='';status.classList.remove('error');render();
 }catch(e){if(type==='poll'&&!room&&/^(Oda bulunamadı|Oda üyesi değilsin)/.test(e.message)){code='';try{localStorage.removeItem(storage);}catch{}status.textContent='';return;}status.textContent=['TimeoutError','AbortError'].includes(e.name)?'Bağlantı yavaşladı. Tekrar dene.':e.message==='Failed to fetch'?'Bağlantı koptu; yeniden deneniyor…':e.message;status.classList.add('error');}
 finally{busy=false;if(!room){$('#create').disabled=false;$('#join').disabled=false;}}
}
function button(type,label,disabled=false){return `<button data-action="${type}" ${disabled?'disabled':''}>${label}</button>`;}
function select(name,label,options,value){return `<label ${name==='captainId'?'class="captain-select"':''}>${label}<select name="${name}">${options.map(([v,l])=>`<option value="${esc(v)}" ${String(v)===String(value)?'selected':''}>${esc(l)}</option>`).join('')}</select></label>`;}
function tactics(){
 const me=room.teams.find(t=>t.id===room.uid),p=room.myPlan;
 const sentOff=new Set(room.phase==='halftime'?(room.discipline||[]).flatMap(m=>m.teams.filter(t=>t.id===me.id).flatMap(t=>t.players.filter(p=>p.red).map(p=>p.id))):[]);
 const available=me.players.filter(p=>!sentOff.has(p.id));
 const selected=available.find(player=>String(player.id)===String(p.captainId))||available.toSorted((a,b)=>b.overall-a.overall)[0];
 return `<form id="plan-form" class="tactics-grid">${select('formation','Diziliş',[['2-2-2','2-2-2 Dengeli'],['2-3-1','2-3-1 Orta saha'],['3-2-1','3-2-1 Savunma'],['1-3-2','1-3-2 Hücum']],p.formation)}${select('style','Oyun tarzı',[['short','Kısa pas'],['wide','Kanat oyunu'],['direct','Direkt oyun'],['counter','Kontra atak']],p.style)}${select('captainId','Kaptan · +%'+Math.round(CAPTAIN_BOOST*100),available.map(player=>[player.id,player.name+' · '+player.overall]),selected?.id)}${[['press','Pres',['Geri çekil','Dengeli','Yoğun pres']],['risk','Risk',['Temkinli','Dengeli','Hücum']],['tempo','Tempo',['Sakin','Normal','Yüksek']],['width','Genişlik',['Dar','Dengeli','Geniş']],['tackle','Müdahale',['Temiz','Normal','Sert','Çok sert']]].map(([k,label,opts])=>select(k,label,opts.map((l,i)=>[i,l]),p[k])).join('')}<button>Taktiği kilitle</button></form>`;
}
function stage(){
 const me=room.teams.find(t=>t.id===room.uid);
 if(room.phase==='lobby')return `<h2>Odan hazır</h2><p>Oda kodu <strong class="room-code">${room.id}</strong></p>${room.options?.bonusEnabled?'<span class="lobby-options">Bonus oyuncu açık</span>':''}<ul class="lobby-list">${room.teams.map(t=>`<li>${esc(t.name)}<span>${t.ready?'✓ Hazır':'Bekliyor'}</span></li>`).join('')}</ul><div class="actions">${button('ready',me.ready?'Hazırsın':'Hazırım',me.ready)}${room.owner===room.uid?button('start','İhaleyi başlat',room.teams.length<3||!room.teams.every(t=>t.ready)):''}</div>`;
 if(['players','coaches'].includes(room.phase)){
  const lot=room.lot,c=lot.card,allowed=c.kind==='coach'?!me.coach:me.players.filter(p=>p.position===c.position).length<({GK:1,DEF:2,MID:2,ATT:2}[c.position]);
  const max=me.balance-(8-me.players.length-Number(Boolean(me.coach))-1);
  const can=allowed&&!lot.passed.includes(me.id)&&lot.bidder!==me.id&&max>lot.amount;
  return `<h2>${phases[room.phase]}</h2><div class="auction-info"><span>${lot.bidder?names(lot.bidder)+' · <strong>'+lot.amount+' kredi</strong>':'İlk teklifi ver'}</span><span>Bütçen <strong>${me.balance}</strong></span></div><div class="auction-card">${c.kind==='coach'?coachCard(c):playerCard(c)}</div><p class="bid-limit">Teklif tavanın: ${max} kredi</p><form id="bid-form"><label><input id="amount" aria-label="Teklif miktarı" inputmode="numeric" type="number" min="${lot.amount+1}" max="${max}" step="1" value="${lot.amount+1}" ${can?'':'disabled'}></label><button ${can?'':'disabled'}>Teklif ver</button>${button('pass','Pas geç',lot.passed.includes(me.id)||!allowed)}</form>`;
 }
 if(['prepare','halftime'].includes(room.phase)){
  const playing=room.pairs.flat().includes(me.id),referee=room.referees?.find(r=>r.teams.includes(me.id));
  return `<h2>${room.final?'Final · ':''}${phases[room.phase]}</h2>${referee?'<p class="referee">Hakem: '+['Toleranslı','Normal','Katı'][referee.strictness]+'</p>':''}${!playing?'<p>Bu hafta maçın yok.</p>':room.locked.includes(me.id)?'<p>✓ Hazırsın. Rakip bekleniyor.</p>':tactics()}`;
 }
 if(room.phase==='finished')return `<p class="eyebrow">KUPANIN SAHİBİ</p><h2>🏆 ${names(room.champion)}</h2><button id="leave">Yeni oyun</button>`;
 return `<h2>${room.final?'Final · ':''}${phases[room.phase]}</h2>`;
}
function render(){
 $('#connection').hidden=true;document.querySelector('.preview-wrap').hidden=true;
 if(!$('#stage'))game.innerHTML='<div class="room-bar"><strong id="room-label"></strong><span id="timer"></span></div><section id="stage" class="panel"></section><section id="matches" class="match-grid"></section><section class="panel"><h2>Puan durumu</h2><div id="table" class="table-scroll"></div></section><section id="squads"></section><details class="panel"><summary>Transfer geçmişi</summary><div id="history"></div></details>';
 $('#room-label').textContent='ODA '+room.id+' · '+(room.final?'Final':room.phase==='lobby'?room.teams.length+'/6 takım':(room.round+1)+'. hafta');
 const nextKey=[room.phase,room.phaseVersion,room.lot?.id,room.lot?.amount,room.lot?.bidder,room.lot?.passed.includes(room.uid),room.locked.includes(room.uid),room.teams.map(t=>t.id+t.ready).join(),room.champion].join('|');
 if(nextKey!==key){key=nextKey;$('#stage').innerHTML=stage();bindStage();}
 $('#table').innerHTML='<table><thead><tr><th>Takım</th><th>P</th><th>G</th><th>Av.</th><th>Gol</th></tr></thead><tbody>'+room.table.map(id=>{const t=room.teams.find(t=>t.id===id);return `<tr ${id===room.uid?'class="my-team"':''}><th>${esc(t.name)}</th><td>${t.points}</td><td>${t.wins}</td><td>${t.gf-t.ga}</td><td>${t.gf}:${t.ga}</td></tr>`;}).join('')+'</tbody></table>'+(room.draws.length?'<p class="small">Kura sırası: '+room.draws.map(group=>group.map(names).join(' → ')).join(' / ')+'</p>':'');
 const events={goal:'⚽ Gol',shot:'Şut dışarı',save:'Kaleci kurtardı',yellow:'🟨 Sarı kart',red:'🟥 Kırmızı kart',foul:'Faul',forfeit:'Hükmen sonuç',extraTime:'Uzatmalar başladı',shootout:'Penaltı'};
 const matches=[...room.matches].sort((a,b)=>Number(b.teams.some(t=>t.id===room.uid))-Number(a.teams.some(t=>t.id===room.uid)));
 $('#matches').innerHTML=matches.map(m=>`<article class="panel match"><h3><span>${names(m.teams[0].id)}</span><strong>${m.score.join(' : ')}</strong><span>${names(m.teams[1].id)}</span></h3><p>${m.minute.toFixed(1)}′ ${m.shootout?'· Penaltılar '+m.shootout.score.join(':'):''}</p>${m.teams.some(t=>t.captainName)?'<p class="match-captains">ⓒ '+m.teams.map(t=>esc(t.captainName||'—')).join(' · ')+'</p>':''}<ol class="event-log">${m.events.slice(-8).reverse().map(e=>`<li>${e.minute.toFixed(1)}′ ${events[e.type]||esc(e.type)} ${e.playerName?esc(e.playerName):''}${e.type==='shootout'?(e.scored?' ✓':' ✕'):''}</li>`).join('')}</ol></article>`).join('');
 const captains=new Set(room.matches.flatMap(m=>m.teams.map(t=>t.captainId)).filter(id=>id!==undefined));
 const squadsKey=room.teams.map(t=>t.id+':'+t.players.length+':'+t.coach?.id).join('|')+'|'+[...captains].join(',');
 if($('#squads').dataset.key!==squadsKey){$('#squads').dataset.key=squadsKey;$('#squads').innerHTML=[...room.teams].sort((a,b)=>Number(b.id===room.uid)-Number(a.id===room.uid)).map(t=>`<details class="panel"><summary>${esc(t.name)} · ${t.players.length}/7 · ${t.balance} kredi</summary><div class="squad-cards">${t.players.map(p=>playerCard({...p,isCaptain:captains.has(p.id)})).join('')}${t.coach?coachCard(t.coach):''}</div></details>`).join('');}
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
function tick(){if($('#timer')&&room)$('#timer').textContent=room.phase==='finished'?'Tamamlandı':room.phase==='lobby'?'Lobi':Math.max(0,Math.ceil((room.deadline-Date.now()-offset)/1000))+' sn';}
function renderPreview(){const p=previewPlayer;if(p)$('#preview').innerHTML=playerCard(p);}
$('#create').disabled=false;$('#join').disabled=false;
$('#create').addEventListener('click',()=>send('create',{name:$('#name').value,bonusEnabled:$('#bonus-enabled').checked}));$('#join').addEventListener('click',()=>send('join',{name:$('#name').value}));

setInterval(()=>{if(room&&room.phase!=='finished')send('poll');},1500);setInterval(tick,200);
try{const response=await fetch('../fut-draft/players.json');const data=await response.json(),p=data.players[0],values=PLAYER_ATTRIBUTES[p.id]||[];previewPlayer={...p,attributes:Object.fromEntries(ATTRIBUTE_KEYS.map((k,i)=>[k,values[i]]))};renderPreview();}catch{}
status.textContent='';
if(code)send('poll');
