import {auctionResult} from './auction-result.js';
import {coachTactics} from './coach-tactics.js';
import {pitch,minuteLabel,displayMinute} from './pitch.js';
import {playerCard,escapeHTML as esc} from './cards.js';
import {coachCard} from './coach-card.js';
import {CAPTAIN_BOOST} from './bonus-player.js';
import {ATTRIBUTE_KEYS,PLAYER_ATTRIBUTES} from './player-attributes.js';
import {hasBidSlot} from './ui-rules.js';
import {BONUS_CARDS} from './bonus-cards.js';
import {LOGOS,logoSVG} from './logos.js';
import {squadBoard} from './formation-board.js';
import {mechanicsHTML} from './mechanics.js';
import {playCeremony} from './ceremony.js';
import {championsTable} from './champions-table.js';
const $=s=>document.querySelector(s),status=$('#status'),game=$('#game');
const storage='pixel-scout:transfer-arenasi:v1';
let room=null,busy=false,key='',offset=0,code='',previewPlayer=null;
try{code=localStorage.getItem(storage)||'';}catch{}
const phases={lobby:'Lobi',players:'Futbolcu ihalesi',coaches:'Hoca ihalesi',auctionResult:'İhale sonucu',squadReview:'Takımın ve ilk taktiğin',prepare:'Maç öncesi',firstHalf:'İlk yarı',halftime:'Devre arası',secondHalf:'İkinci yarı',finalResolution:'Uzatma ve penaltılar',finished:'Kupa sahibi belli'};
const formations=[['2-2-2','2-2-2 Dengeli'],['2-3-1','2-3-1 Orta saha'],['3-2-1','3-2-1 Savunma'],['1-3-2','1-3-2 Hücum']];
const bonusNames={president:'Bonkör Başkan',fan:'Taraftar Desteği',fitness:'Kondisyon Ekibi',passing:'Pas Ustası'};
const bonusCards=BONUS_CARDS.map(card=>[card.id,bonusNames[card.id]||card.name,card.description]);
const sprintAverage=t=>{const outfield=t.players.filter(p=>p.position!=='GK');return outfield.length?Math.round(outfield.reduce((sum,p)=>sum+p.attributes.sprintSpeed,0)/outfield.length):'—';};
const teamName=t=>t?(t.logo?logoSVG(t.logo,18)+' ':'')+esc(t.name):'—';
const names=id=>teamName(room.teams.find(t=>t.id===id));
const ceremonyKey=id=>storage+':toren:'+id;
function lobbyLogos(me){
 return `<fieldset class="logo-picker" ${me.ready?'disabled':''}><legend>Takım logosu</legend>${LOGOS.map(logo=>{const owner=room.teams.find(t=>t.logo===logo.id);const taken=owner&&owner.id!==me.id;return `<label class="logo-option ${taken?'taken':''}" title="${taken?esc(owner.name)+' seçti':logo.name}"><input type="radio" name="logo" value="${logo.id}" ${me.logo===logo.id?'checked':''} ${taken?'disabled':''}>${logoSVG(logo.id,40)}<span>${taken?esc(owner.name):logo.name}</span></label>`;}).join('')}</fieldset>`;
}
async function send(type,extra={}){
 if(busy){if(type==='poll')return;await new Promise(resolve=>setTimeout(resolve,80));return send(type,extra);}busy=true;
 if(!room){$('#create').disabled=true;$('#join').disabled=true;}
 const action={type,requestId:crypto.randomUUID(),code:room?.id||$('#code').value.trim()||code,...extra};
 try{
  const response=await fetch('/api/transfer-arena',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(action),signal:AbortSignal.timeout(12000)});
  const data=await response.json();if(!response.ok)throw Error(typeof data.error==='string'?data.error:'Bağlantı kurulamadı');
  if(data.phase==='left'){room=null;key='';code='';try{localStorage.removeItem(storage);}catch{}status.textContent='Lobiden ayrıldın.';status.classList.remove('error');$('#game').innerHTML='';$('#connection').hidden=false;return;}
  if(data.phase==='closed'){room=null;key='';code='';try{localStorage.removeItem(storage);}catch{}status.textContent='';status.classList.remove('error');$('#connection').hidden=false;document.querySelector('.preview-wrap').hidden=true;$('#game').innerHTML='<section class="panel"><h2>Oda kapatıldı</h2><p>Kurucu bu oyunu kapattı.</p></section>';return;}
  room=data;code=room.id;offset=data.serverNow-Date.now();
  try{localStorage.setItem(storage,code);}catch{}
  status.textContent='';status.classList.remove('error');render();
 }catch(e){if(type==='poll'&&!room&&/^(Oda bulunamadı|Oda üyesi değilsin)/.test(e.message)){code='';try{localStorage.removeItem(storage);}catch{}status.textContent='';return;}status.textContent=['TimeoutError','AbortError'].includes(e.name)?'Bağlantı yavaşladı. Tekrar dene.':e.message==='Failed to fetch'?'Bağlantı koptu; yeniden deneniyor…':e.message;status.classList.add('error');}
 finally{busy=false;if(!room){$('#create').disabled=false;$('#join').disabled=false;}}
}
function button(type,label,disabled=false){return `<button data-action="${type}" ${disabled?'disabled':''}>${label}</button>`;}
function select(name,label,options,value){return `<label ${name==='captainId'?'class="captain-select"':''}>${label}<select name="${name}">${options.map(([v,l])=>`<option value="${esc(v)}" ${String(v)===String(value)?'selected':''}>${esc(l)}</option>`).join('')}</select></label>`;}
function sentOffIds(id){return room.phase==='halftime'?(room.discipline||[]).flatMap(m=>m.teams.filter(t=>t.id===id).flatMap(t=>t.players.filter(p=>p.red).map(p=>p.id))):[];}
function bonusSummary(next=room.nextMatch){
 const card=BONUS_CARDS.find(item=>item.id===room.myBonusCard);if(!card)return '';
 const active=card.id==='president'?'Bütçeye uygulandı':card.id==='fan'?(next&&!next.bye&&!next.neutral&&!next.final&&next.home?'Bu iç saha maçında etkin':'Bu maçta etkin değil'):'Etkin';
 return `<div class="bonus-callout"><strong>${esc(bonusNames[card.id]||card.name)}</strong><small>${esc(card.description)}</small><span>${active}</span></div>`;
}
function tactics(){
 const me=room.teams.find(t=>t.id===room.uid),p=room.myPlan;
 const sentOff=new Set(sentOffIds(me.id));
 const available=me.players.filter(p=>!sentOff.has(p.id));
 const selected=available.find(player=>String(player.id)===String(p.captainId))||available.toSorted((a,b)=>b.overall-a.overall)[0];
 return `<div id="tactic-coach">${coachTactics(me.coach,p,available)}</div><div id="tactic-pitch">${pitch(me,p.formation,selected?.id,[...sentOff])}</div><form id="plan-form" class="tactics-grid">${select('formation','Diziliş',[['2-2-2','2-2-2 Dengeli'],['2-3-1','2-3-1 Orta saha'],['3-2-1','3-2-1 Savunma'],['1-3-2','1-3-2 Hücum']],p.formation)}${select('style','Oyun tarzı',[['short','Kısa pas'],['wide','Kanat oyunu'],['direct','Direkt oyun'],['counter','Kontra atak']],p.style)}${select('captainId','Kaptan · +%'+Math.round(CAPTAIN_BOOST*100),available.map(player=>[player.id,player.name+' · '+player.overall]),selected?.id)}${[['press','Pres',['Geri çekil','Dengeli','Yoğun pres']],['risk','Risk',['Temkinli','Dengeli','Hücum']],['tempo','Tempo',['Sakin','Normal','Yüksek']],['width','Genişlik',['Dar','Dengeli','Geniş']],['tackle','Müdahale',['Temiz','Normal','Sert','Çok sert']]].map(([k,label,opts])=>select(k,label,opts.map((l,i)=>[i,l]),p[k])).join('')}<button>Taktiği kilitle</button></form>`;
}
function stage(){
 const me=room.teams.find(t=>t.id===room.uid);
 if(room.phase==='lobby'){const needsChoices=room.rulesVersion>=4,chosen=!needsChoices||(Boolean(me.formation)&&(!room.options?.bonusCardsEnabled||Boolean(room.myBonusCard))),selectedDescription=BONUS_CARDS.find(card=>card.id===room.myBonusCard)?.description||'Kartın etkisi burada görünür.';return `<h2>Lobi</h2><p>Oda kodu <strong class="room-code">${room.id}</strong></p>${room.options?.bonusEnabled?'<span class="lobby-options">Bonus oyuncu açık</span>':''}${lobbyLogos(me)}${needsChoices?`<form id="lobby-choice" class="lobby-choice"><label>İhale dizilişi<select name="formation" ${me.ready?'disabled':''}><option value="" ${me.formation?'':'selected'}>Diziliş seç</option>${formations.map(([v,l])=>`<option value="${v}" ${me.formation===v?'selected':''}>${l}</option>`).join('')}</select></label>${room.options?.bonusCardsEnabled?`<label>Bonus kartı <select name="bonusCard" ${me.ready?'disabled':''}><option value="">Kart seç</option>${bonusCards.map(([id,name,desc])=>`<option value="${id}" ${room.myBonusCard===id?'selected':''}>${name} · ${desc}</option>`).join('')}</select><small id="bonus-description">${esc(selectedDescription)}</small></label>`:''}</form>`:''}<p class="small muted">${me.ready?'Seçimlerin kilitli. Hazır durumunu kaldırarak değiştirebilirsin.':chosen?'Seçimlerin hazır olduğunda kilitlenir.':room.options?.bonusCardsEnabled?'Dizilişini ve bonus kartını seç.':'Dizilişini seç.'}</p><ul class="lobby-list">${room.teams.map(t=>{const card=room.bonusCardSelected?.includes(t.id)?(t.id===room.uid?room.myBonusCard:null):null;return `<li><span>${teamName(t)}${needsChoices?` · ${esc(formations.find(x=>x[0]===t.formation)?.[1]||'Diziliş seçilmedi')}${room.options?.bonusCardsEnabled&&card?` · ${esc(bonusCards.find(x=>x[0]===card)?.[1]||'Bonus kart seçildi')}`:room.options?.bonusCardsEnabled&&room.bonusCardSelected?.includes(t.id)?' · Bonus kart seçildi':''}`:''}</span><span>${t.ready?'✓ Hazır':'Bekliyor'}</span></li>`;}).join('')}</ul><div class="actions">${button('ready',me.ready?'Hazırsın':'Hazırım',me.ready||!chosen)}${me.ready?button('unready','Seçimi değiştir'):''}${room.owner===room.uid?button('start','İhaleyi başlat',room.teams.length<3||!room.teams.every(t=>t.ready)):button('leave','Lobiden ayrıl')}</div>`;}
 if(room.phase==='closed')return `<h2>Oda kapatıldı</h2><p>Kurucu bu oyunu kapattı.</p><button id="leave">Lobiyi kapat</button>`;
 if(room.phase==='auctionResult')return (room.lotTotal?`<p class="lot-progress-text">${room.lotKind==='coaches'?'Hoca':'Futbolcu'} ${room.lotNumber}/${room.lotTotal}</p>`:'')+auctionResult(room.auctionResult,room.teams);
 if(['players','coaches'].includes(room.phase)){
  const lot=room.lot,c=lot.card,allowed=c.kind==='coach'?!me.coach:hasBidSlot(me,c.position);
  const max=me.balance-(8-me.players.length-Number(Boolean(me.coach))-1);
  const sealed=lot.sealed,can=allowed&&!(lot.single&&lot.myLocked)&&(sealed||(!lot.passed.includes(me.id)&&lot.bidder!==me.id&&max>lot.amount));
  const own=sealed?(lot.myBid?(lot.single?'Kilitli teklifin: <strong>':'Teklifin: <strong>')+lot.myBid+' kredi</strong>':lot.passed.includes(me.id)?'Pas geçtin':'Gizli teklifini ver'):lot.bidder?names(lot.bidder)+' · <strong>'+lot.amount+' kredi</strong>':'İlk teklifi ver';
  const progress=room.lotTotal?`<div class="lot-progress"><span>${room.phase==='coaches'?'Hoca':'Futbolcu'} <strong>${room.lotNumber}/${room.lotTotal}</strong></span><div class="lot-bar" role="progressbar" aria-label="İhale ilerlemesi" aria-valuemin="1" aria-valuemax="${room.lotTotal}" aria-valuenow="${room.lotNumber}"><i style="width:${Math.round(room.lotNumber/room.lotTotal*100)}%"></i></div></div>`:'';
  const board=`<section class="auction-board"><h3>Dizilişin · ${esc(me.formation||'2-2-2')} · ${me.players.length}/7</h3>${squadBoard(me)}</section>`;
  return `<h2>${phases[room.phase]}</h2>${progress}<div class="auction-info"><span>${own}</span><span>Bütçen <strong>${me.balance}</strong></span></div><div class="auction-card">${c.kind==='coach'?coachCard(c):playerCard(c)}</div><p class="bid-limit">Teklif tavanın: ${max} kredi</p><form id="bid-form"><label><input id="amount" aria-label="Teklif miktarı" inputmode="numeric" type="number" min="${sealed?1:lot.amount+1}" max="${max}" step="1" value="${sealed?lot.myBid||1:lot.amount+1}" ${can?'':'disabled'}></label><button ${can?'':'disabled'}>${lot.single?(lot.myLocked?'Kilitlendi':'Teklifi kilitle'):sealed?(lot.myBid?'Değiştir':'Teklif ver'):'Teklif ver'}</button>${button('pass',lot.single?'Pası kilitle':'Pas geç',(lot.single&&lot.myLocked)||lot.passed.includes(me.id)||!allowed)}</form>${board}`;

 }
 if(['squadReview','prepare','halftime'].includes(room.phase)){
  const playing=room.phase==='squadReview'||room.pairs.flat().includes(me.id),referee=room.referees?.find(r=>r.teams.includes(me.id));
  const next=room.nextMatch,nextLabel=next?.bye?'Bu hafta bay':next?.neutral?(next.final?'Final · Tarafsız saha':'Tarafsız saha'):next?.home?'İç saha':'Deplasman';const matchup=next?`<div class="next-match"><strong>${nextLabel}</strong>${next.opponentId?` · ${names(next.opponentId)}`:''}</div>`:'';
  return `<h2>${room.final?'Final · ':''}${phases[room.phase]}</h2>${matchup}${bonusSummary(next)}${referee?'<p class="referee">Hakem: '+['Toleranslı','Normal','Katı'][referee.strictness]+'</p>':''}${!playing?'<p>Bu hafta maçın yok.</p>':room.locked.includes(me.id)?coachTactics(me.coach,room.myPlan,me.players.filter(p=>!sentOffIds(me.id).includes(p.id)))+pitch(me,room.myPlan.formation,room.myPlan.captainId,sentOffIds(me.id))+'<p>✓ Hazırsın. Diğer takımlar bekleniyor.</p>':tactics()}`;
 }
 if(room.phase==='finished')return `<p class="eyebrow">KUPANIN SAHİBİ</p><h2 class="champion-title">🏆 ${names(room.champion)}</h2><div class="actions"><button id="replay-ceremony" class="secondary">Töreni izle</button><button id="leave">Yeni oyun</button></div>`;
 return `<h2>${room.final?'Final · ':''}${phases[room.phase]}</h2>`;
}
let championsRoom='';
async function loadChampions(){
 try{
  const response=await fetch('/api/transfer-arena',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'champions',requestId:crypto.randomUUID()}),signal:AbortSignal.timeout(12000)});
  const data=await response.json();if(!response.ok)throw Error();
  $('#champions').innerHTML=championsTable(data.champions);
 }catch{$('#champions').innerHTML='<p class="small muted">Şampiyon listesi şu an yüklenemedi.</p>';}
}
function render(){
 if(room.phase==='finished'&&championsRoom!==room.id){championsRoom=room.id;loadChampions();}
 $('#connection').hidden=true;document.querySelector('.preview-wrap').hidden=true;
 if(!$('#stage')){game.innerHTML='<div class="room-bar"><strong id="room-label"></strong><button id="open-guide" class="secondary" aria-haspopup="dialog">Nasıl işler?</button>'+(room.owner===room.uid?'<button id="close-room" class="secondary">Odayı kapat</button>':'')+'<span id="timer"></span></div><dialog id="guide" class="guide" aria-labelledby="guide-title"><div class="guide-head"><h2 id="guide-title">Simülasyon nasıl işler?</h2><button class="secondary" data-close-guide aria-label="Kapat">✕</button></div>'+mechanicsHTML()+'</dialog><section id="stage" class="panel"></section><section id="allin" class="allin-panel" aria-live="polite" hidden></section><section id="speed-controls" class="panel" hidden></section><section id="allocations" class="panel" hidden></section><section id="matches" class="match-grid"></section><section class="panel"><h2>Puan durumu</h2><div id="table" class="table-scroll"></div></section><section id="squads"></section><details class="panel"><summary>Transfer geçmişi</summary><div id="history"></div></details>';$('#close-room')?.addEventListener('click',()=>confirm('Oda kapatılacak ve oyun sona erecek. Devam edilsin mi?')&&send('close'));$('#open-guide').addEventListener('click',()=>$('#guide').showModal());$('#guide').addEventListener('click',e=>{if(e.target===e.currentTarget||e.target.closest('[data-close-guide]'))$('#guide').close();});}
 $('#room-label').textContent='ODA '+room.id+' · '+(room.final?'Final':room.phase==='lobby'?room.teams.length+'/6 takım':(room.round+1)+'. hafta');
 const nextKey=[room.phase,room.phaseVersion,room.lot?.id,room.lot?.amount,room.lot?.bidder,room.lot?.myBid,room.lot?.myLocked,room.lot?.passed.includes(room.uid),room.locked.includes(room.uid),room.teams.map(t=>t.id+t.ready+':'+t.formation+':'+t.logo).join(),room.lotNumber,room.bonusCardSelected?.join(','),room.myBonusCard,room.champion].join('|');
 if(nextKey!==key){key=nextKey;$('#stage').innerHTML=stage();bindStage();}
 $('#table').innerHTML='<table><thead><tr><th>Takım</th><th>P</th><th>G</th><th>Av.</th><th>Gol</th></tr></thead><tbody>'+room.table.map(id=>{const t=room.teams.find(t=>t.id===id);return `<tr ${id===room.uid?'class="my-team"':''}><th>${teamName(t)}</th><td>${t.points}</td><td>${t.wins}</td><td>${t.gf-t.ga}</td><td>${t.gf}:${t.ga}</td></tr>`;}).join('')+'</tbody></table>'+(room.draws.length?'<p class="small">Kura sırası: '+room.draws.map(group=>group.map(names).join(' → ')).join(' / ')+'</p>':'');
 const board=room.leaderboard||[];$('#table').insertAdjacentHTML('beforeend',board.length?'<section class="leaderboards"><div><h3>Gol krallığı</h3><ol>'+board.slice().sort((a,b)=>b.goals-a.goals||a.name.localeCompare(b.name,'tr')).slice(0,5).map(x=>`<li>${logoSVG(room.teams.find(t=>t.id===x.team)?.logo,14)} ${esc(x.name)} <span>${x.goals}</span></li>`).join('')+'</ol></div><div><h3>Asist krallığı</h3><ol>'+board.slice().sort((a,b)=>b.assists-a.assists||a.name.localeCompare(b.name,'tr')).slice(0,5).map(x=>`<li>${logoSVG(room.teams.find(t=>t.id===x.team)?.logo,14)} ${esc(x.name)} <span>${x.assists}</span></li>`).join('')+'</ol></div></section>':'');
 const events={goal:'⚽ Gol',shot:'Şut dışarı',save:'Kaleci kurtardı',yellow:'🟨 Sarı kart',red:'🟥 Kırmızı kart',foul:'Faul',forfeit:'Hükmen sonuç',extraTime:'Uzatmalar başladı',shootout:'Penaltı',allIn:'🔥 Tüm riskleri aldı',post:'Direkten döndü'};
 const setPieces={penalty:'penaltı',freeKick:'serbest vuruş',corner:'korner'};
 // Model 6 olay ekleri: büyük fırsat ve duran top kısa notu; "Tüm riskleri al!" olayında takım adı.
 const eventExtra=e=>(e.type==='allIn'?' '+names(e.team):'')+(e.setPiece&&setPieces[e.setPiece]?' · '+setPieces[e.setPiece]:'')+(e.big?' · büyük fırsat':'');
 const matches=[...room.matches].sort((a,b)=>Number(b.teams.some(t=>t.id===room.uid))-Number(a.teams.some(t=>t.id===room.uid)));
 $('#matches').innerHTML=matches.map(m=>`<article class="panel match"><h3><span>${names(m.teams[0].id)}</span><strong>${m.score.join(' : ')}</strong><span>${names(m.teams[1].id)}</span></h3><p>${minuteLabel(Math.min(displayMinute(m.minute,m.regulationMinutes||(room.rulesVersion>=2?90:20)),120))} ${m.shootout?'· Penaltılar '+m.shootout.score.join(':'):''}</p>${m.teams.some(t=>t.captainName)?'<p class="match-captains">ⓒ '+m.teams.map(t=>esc(t.captainName||'—')).join(' · ')+'</p>':''}<ol class="event-log">${m.events.slice(-8).reverse().map(e=>`<li>${minuteLabel(displayMinute(e.minute,m.regulationMinutes||(room.rulesVersion>=2?90:20)),e.type==='shootout')} ${events[e.type]||esc(e.type)} ${e.playerName?esc(e.playerName):''}${e.type==='shootout'?(e.scored?' ✓':' ✕'):''}${eventExtra(e)}</li>`).join('')}</ol></article>`).join('');
 const captains=new Set(room.matches.flatMap(m=>m.teams.map(t=>t.captainId)).filter(id=>id!==undefined));
 const squadsKey=room.phase+'|'+room.teams.map(t=>t.id+':'+t.players.length+':'+t.coach?.id+':'+t.logo).join('|')+'|'+[...captains].join(',');
 if($('#squads').dataset.key!==squadsKey){$('#squads').dataset.key=squadsKey;$('#squads').innerHTML=[...room.teams].sort((a,b)=>Number(b.id===room.uid)-Number(a.id===room.uid)).map(t=>`<details class="panel" ${room.phase==='squadReview'&&t.id===room.uid?'open':''}><summary>${teamName(t)} · ${t.players.length}/7 · ${t.balance} kredi</summary><p class="small muted">${esc(t.formation||'2-2-2')} · Sprint ortalaması: ${sprintAverage(t)}</p>${squadBoard(t,{captains})}<details class="squad-detail"><summary>Kartları göster</summary><div class="squad-cards">${t.players.map(p=>playerCard({...p,isCaptain:captains.has(p.id)})).join('')}${t.coach?coachCard(t.coach):''}</div></details></details>`).join('');}
 $('#history').innerHTML=room.history.map(h=>`<p>${esc(h.card.name)} · ${h.bidder?names(h.bidder)+' · '+h.amount+' kredi':'Pas havuzu'}${h.tied?' · '+(h.tieBreak==='firstLocked'?'İlk kilitleyen kazandı':'Eşit teklif kurası'):''}${h.offers?.length?' · Teklifler: '+h.offers.map(o=>names(o.team)+' '+o.amount).join(' / '):''}</p>`).join('');
 $('#matches').insertAdjacentHTML('beforeend',(['prepare','lobby'].includes(room.phase)?[]:room.discipline||[]).map(m=>'<div class="panel small">'+m.teams.map(t=>{const cards=t.players.filter(p=>p.red||p.yellow);return cards.length?'<p>'+names(t.id)+': '+cards.map(p=>esc(p.name)+' '+(p.red?'🟥 Oyun dışında':'🟨 '+p.yellow)).join(' · ')+'</p>':'';}).filter(Boolean).join('')+'</div>').filter(s=>s!=='<div class="panel small"></div>').join(''));
 const allocations=room.assignments||[];$('#allocations').hidden=!allocations.length;const allocationKey=allocations.length+'|'+room.phase;if($('#allocations').dataset.key!==allocationKey){$('#allocations').dataset.key=allocationKey;$('#allocations').innerHTML='<details><summary>Pas havuzu dağıtımı · '+allocations.length+' kart</summary>'+allocations.map(a=>'<p>'+esc(a.card.name)+' → <strong>'+names(a.team)+'</strong> · 1 kredi</p>').join('')+'</details>';}
 const live=room.rulesVersion>=2&&['firstHalf','secondHalf','finalResolution'].includes(room.phase);$('#speed-controls').hidden=!live;
 if(live){const speedKey=room.phase+'|'+room.playbackSpeed;if($('#speed-controls').dataset.key!==speedKey){$('#speed-controls').dataset.key=speedKey;$('#speed-controls').innerHTML='<div class="speed-row"><strong>Maç hızı</strong><div>'+[1,2,4,8].map(n=>'<button data-speed="'+n+'" aria-pressed="'+(n===room.playbackSpeed)+'" '+(room.owner!==room.uid?'disabled':'')+'>'+n+'×</button>').join('')+'</div></div>';$('#speed-controls').querySelectorAll('[data-speed]').forEach(b=>b.onclick=()=>send('speed',{speed:Number(b.dataset.speed)}));}}
 if(room.phase==='finished'&&room.champion){let seen=false;try{seen=localStorage.getItem(ceremonyKey(room.id))==='1';}catch{}if(!seen&&!document.querySelector('.ceremony')){try{localStorage.setItem(ceremonyKey(room.id),'1');}catch{}playCeremony(room,names);}}
 tick();
}
function bindStage(){
 $('#stage').querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();const action=b.dataset.action;if(action==='unready')return send('ready',{ready:false});send(action,{lotId:room.lot?.id});}));
 $('#lobby-choice')?.addEventListener('change',e=>{const f=e.target;if(f.name==='formation')send('formation',{formation:f.value});if(f.name==='bonusCard'){const card=BONUS_CARDS.find(item=>item.id===f.value);$('#bonus-description').textContent=card?.description||'Kartın etkisi burada görünür.';if(f.value)send('bonusCard',{cardId:f.value});}});
 $('#bid-form')?.addEventListener('submit',e=>{e.preventDefault();send('bid',{amount:Number($('#amount').value),lotId:room.lot.id});});
 $('#plan-form')?.addEventListener('change',()=>{const form=$('#plan-form'),me=room.teams.find(t=>t.id===room.uid),reds=room.phase==='halftime'?(room.discipline||[]).flatMap(m=>m.teams.filter(t=>t.id===me.id).flatMap(t=>t.players.filter(p=>p.red).map(p=>p.id))):[];$('#tactic-pitch').innerHTML=pitch(me,form.elements.formation.value,form.elements.captainId.value,reds);$('#tactic-coach').innerHTML=coachTactics(me.coach,Object.fromEntries(new FormData(form)),me.players.filter(p=>!reds.includes(p.id)));});
 $('#plan-form')?.addEventListener('submit',e=>{e.preventDefault();const plan=Object.fromEntries(new FormData(e.currentTarget));for(const k of ['press','risk','tempo','width','tackle'])plan[k]=Number(plan[k]);send('plan',{phaseVersion:room.phaseVersion,plan});});
 $('#replay-ceremony')?.addEventListener('click',()=>playCeremony(room,names));
 $('#stage').querySelector('.logo-picker')?.addEventListener('change',e=>{if(e.target.name==='logo')send('logo',{logo:e.target.value});});
 $('#leave')?.addEventListener('click',()=>{try{localStorage.removeItem(storage);}catch{}location.reload();});
}
// "Tüm riskleri al!" (model 6): pencere sunucu saatine göre açılır/kilitlenir; sunucu her komutu yeniden doğrular.
let allInSent='';
const allInKey=()=>room?.allIn?room.id+':'+room.phaseVersion+':'+room.allIn.lock:'';
function allInState(){
 const a=room?.allIn;if(!a||!a.locksAt)return a?.chosen?'locked':'';
 const now=Date.now()+offset,match=room.matches.find(m=>m.teams.some(t=>t.id===room.uid));
 const side=match?match.teams.findIndex(t=>t.id===room.uid):-1;
 const behind=match&&match.score[side]<=match.score[1-side]&&!match.events.some(e=>e.type==='forfeit');
 if(a.chosen||allInSent===allInKey())return now<a.locksAt+1000?'locked':'';
 return now>=a.opensAt&&now<a.locksAt&&behind?'open':'';
}
function renderAllIn(){
 const box=$('#allin');if(!box)return;
 const state=allInState(),a=room?.allIn;
 const left=a?.locksAt?Math.max(1,Math.ceil((a.locksAt-Date.now()-offset)/1000*1.5*(room.playbackSpeed||1))):0;
 // Düğme durum değişmedikçe yeniden çizilmez (basış sırasında DOM'dan kopmasın); yalnız geri sayım güncellenir.
 const nextKey=state+'|'+allInKey();
 box.hidden=!state;
 if(box.dataset.key===nextKey){const sub=$('#allin-left');if(sub)sub.textContent=left+' dk kaldı';return;}
 box.dataset.key=nextKey;
 if(state==='open'){
  box.innerHTML=`<button id="allin-button" class="allin-button"><span class="allin-title">🔥 Tüm riskleri al!</span><span class="allin-sub">${a.lock}′ kilit · <span id="allin-left">${left} dk kaldı</span></span></button><p class="allin-note">Bütün hatlarla hücum: daha çok şut, ama gol yeme riski de artar.</p>`;
  $('#allin-button').addEventListener('click',()=>{allInSent=allInKey();renderAllIn();send('allIn',{phaseVersion:room.phaseVersion,lock:a.lock}).then(()=>{if(!room?.allIn?.chosen&&$('#status').classList.contains('error'))allInSent='';});});
 }else if(state==='locked')box.innerHTML=`<div class="allin-locked" role="status">🔥 Tüm riskler alındı <small>${a?.lock||''}′ kilidinde uygulanır</small></div>`;
 else box.innerHTML='';
}
// Pencere yaklaşırken ve açıkken sık yoklanır; 8× hızda pencere bir saniyeden kısa sürebilir.
setInterval(()=>{const a=room?.allIn;if(!a?.locksAt)return;const now=Date.now()+offset;if(now>=a.opensAt-3000&&now<=a.locksAt+1500)send('poll');},300);
function tick(){renderAllIn();if($('#timer')&&room)$('#timer').textContent=room.phase==='finished'?'Tamamlandı':room.phase==='lobby'?'Lobi':Math.max(0,Math.ceil((room.deadline-Date.now()-offset)/1000))+' sn';}
function renderPreview(){const p=previewPlayer;if(p)$('#preview').innerHTML=playerCard(p);}
$('#create').disabled=false;$('#join').disabled=false;
$('#create').addEventListener('click',()=>send('create',{name:$('#name').value,bonusEnabled:$('#bonus-enabled').checked,bonusCardsEnabled:$('#bonus-cards-enabled').checked}));$('#join').addEventListener('click',()=>send('join',{name:$('#name').value}));

setInterval(()=>{if(room&&!['finished','closed'].includes(room.phase))send('poll');},1500);setInterval(tick,200);
try{const response=await fetch('./players.json');const data=await response.json(),p=data.players[0],values=PLAYER_ATTRIBUTES[p.id]||[];previewPlayer={...p,attributes:Object.fromEntries(ATTRIBUTE_KEYS.map((k,i)=>[k,values[i]]))};renderPreview();}catch{}
$('#mechanics-help').innerHTML=mechanicsHTML();
status.textContent='';
loadChampions();
if(code)send('poll');
