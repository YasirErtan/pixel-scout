import {random,makeMarket,openLot,bid,settle,completePool,eligible,shuffle} from './market.js';
import {fixtures,validatePlan,DEFAULT_PLAN,beginMatch,simulateHalf,resolveFinal,simulateSegment,finishFinal,ALL_IN_WINDOW} from './simulation.js';
import {formationLimits} from '../../dist/games/transfer-arenasi/formation.js';
import {bonusCardById} from '../../dist/games/transfer-arenasi/bonus-cards.js';
import {standings} from './standings.js';
import {LOGO_IDS} from '../../dist/games/transfer-arenasi/logos.js';

export function createRoom(id,owner,name,seed,now,options={}){return {id,owner,seed,rulesVersion:6,playbackSpeed:1,assignments:[],createdAt:now,options:{bonusEnabled:options.bonusEnabled===true,bonusCardsEnabled:options.bonusCardsEnabled===true},phase:'lobby',version:0,phaseVersion:0,teams:[member(owner,name,LOGO_IDS[0])],requests:[],history:[],pool:[],lotIndex:0,plans:{},matches:[],round:0};}
function freeLogo(teams){return LOGO_IDS.find(id=>!teams.some(team=>team.logo===id))||null;}
function member(id,name,logo=null){const clean=String(name||'').trim().slice(0,18);if(!clean)throw Error('Takım adı gerekli');return {id,name:clean,balance:200,players:[],coach:null,formation:null,logo,ready:false,points:0,gf:0,ga:0,wins:0};}
function deadline(room,phase,now,ms){if(room.rulesVersion===2&&['squadReview','prepare','halftime'].includes(phase)){room.rulesVersion=3;ms=180000;}room.phase=phase;room.phaseVersion++;room.deadline=now+ms;room.plans={};}
function nextLot(room,now){
 const market=room.phase==='players'?room.market.players:room.market.coaches;
 if(room.lotIndex<market.length){room.lot=openLot(market[room.lotIndex],now,`${room.phase}-${room.lotIndex}`,room.rulesVersion>=2,shuffle(room.teams.map(t=>t.id),random(room.seed+room.lotIndex*937+(room.phase==='coaches'?90001:0))),room.rulesVersion>=3,room.rulesVersion>=4);return;}
 room.assignments??=[];room.assignments.push(...completePool(room.teams,room.pool,random(room.seed+room.version)));room.pool=[];
 if(room.phase==='players'){room.phase='coaches';room.lotIndex=0;nextLot(room,now);}
 else {room.lot=null;room.schedule=fixtures(room.teams.map(t=>t.id),room.rulesVersion>=4);deadline(room,room.rulesVersion>=2?'squadReview':'prepare',now,room.rulesVersion>=3?180000:room.rulesVersion>=2?120000:40000);}
}
function finishLot(room,now){
 const lot=room.lot;
 const rows=room.teams.map(t=>({team:t.id,amount:lot.bids?.[t.id]??null,status:lot.bids?.[t.id]!==undefined?'bid':!eligible(t,lot.card)?'ineligible':lot.passed.includes(t.id)?'pass':'timeout'}));
 settle(lot,room.teams,room.pool);room.history.push({card:lot.card,amount:lot.amount,bidder:lot.bidder,offers:lot.offers||[],rows,tied:lot.tied||false,...(lot.tied?{tieBreak:lot.bidOrder?'firstLocked':'draw'}:{})});room.lotIndex++;
 if(lot.single){room.auctionKind=room.phase;room.auctionResult=room.history.at(-1);room.lot=null;deadline(room,'auctionResult',now,8000);}
 else nextLot(room,now);
}
function allOffersLocked(room){return room.lot?.single&&room.teams.every(t=>!eligible(t,room.lot.card)||Object.hasOwn(room.lot.bids,t.id)||room.lot.passed.includes(t.id));}
function clockRate(room){return (room.rulesVersion>=3?1.5:1)*(room.playbackSpeed||1);}

function activePairs(room){return room.final?[[room.finalists[0],room.finalists[1]]]:room.schedule[room.round];}
function matchSeed(room,i){return room.seed+room.round*719+i*31+(room.final?100003:0);}
function startPlayback(room,phase,now,start,end){
 if(room.rulesVersion<2||!room.rulesVersion){room.playbackStart=now;deadline(room,phase,now,(end-start)*3000);return;}
 room.playbackCursor=start;room.playbackEnd=end;room.playbackStart=now;deadline(room,phase,now,(end-start)*1000/clockRate(room));
}
function currentMinute(room,now){
 if(room.rulesVersion>=2)return Math.min(room.playbackEnd,room.playbackCursor+Math.max(0,now-room.playbackStart)/1000*clockRate(room));
 const start=room.phase==='firstHalf'?0:room.phase==='secondHalf'?10:20;
 return start+Math.min(room.phase==='finalResolution'?room.matches[0].minute-20:10,Math.max(0,(now-room.playbackStart)/3000));
}
function finishReview(room,now){room.lastPlans={...room.lastPlans,...room.plans};if(room.rulesVersion>=3)startHalf(room,now,1);else deadline(room,'prepare',now,30000);}
function startHalf(room,now,half){
 const pairs=activePairs(room);
 if(room.rulesVersion>=6)return startSegmentedHalf(room,now,half,pairs);
 room.matches=pairs.map(([a,b],i)=>{
  const teams=[a,b].map(id=>room.teams.find(t=>t.id===id));
  const plans=[a,b].map(id=>room.plans[id]||room.lastPlans?.[id]||initialPlan(room,id));
  const previous=half===1?beginMatch(...teams,matchSeed(room,i),matchSeed(room,i)%3,{version:room.rulesVersion>=5?5:room.rulesVersion>=4?4:3,neutral:!!room.final}):room.matches[i];
  if(half===1&&!(room.rulesVersion>=2))previous.version=2;
  return previous.finished?previous:simulateHalf(previous,plans);
 });
 room.lastPlans={...room.lastPlans,...room.plans};const length=room.matches[0].version>=3?45:10;startPlayback(room,half===1?'firstHalf':'secondHalf',now,(half-1)*length,half*length);
}
// Model 6: maç dilimlerle hesaplanır. İlk yarı 0–45, ikinci yarı önce 45–70; 70–90 dilimi
// oynatma 70'e ulaşınca "Tüm riskleri al!" seçimleriyle hesaplanır (bkz. runPendingSegment).
function startSegmentedHalf(room,now,half,pairs){
 if(half===1)room.allInPicks={};
 room.matches=pairs.map(([a,b],i)=>{
  const plans=[a,b].map(id=>room.plans[id]||room.lastPlans?.[id]||initialPlan(room,id));
  if(half===1){
   const teams=[a,b].map(id=>room.teams.find(t=>t.id===id));
   return simulateSegment(beginMatch(...teams,matchSeed(room,i),matchSeed(room,i)%3,{version:6,neutral:!!room.final}),plans,{start:0,end:45});
  }
  const previous=room.matches[i];
  return previous.finished?previous:simulateSegment(previous,plans,{start:45,end:70});
 });
 room.lastPlans={...room.lastPlans,...room.plans};
 room.nextSegment=half===2?{start:70,end:90}:null;
 startPlayback(room,half===1?'firstHalf':'secondHalf',now,(half-1)*45,half*45);
}
const segmentPlans=(room,match)=>match.teams.map(t=>room.lastPlans?.[t.id]||initialPlan(room,t.id));
// Oynatma imleci bekleyen dilimin başına (kilit dakikasına) ulaştıysa dilimi hesaplar. Oynatma durmaz:
// imleç, başlangıç zamanı ve faz sürümü değişmez; yalnız uzatma sonunda bitiş dakikası düzeltilir.
function runPendingSegment(room,now){
 const segment=room.nextSegment;
 if(!(room.rulesVersion>=6)||!segment||!['secondHalf','finalResolution'].includes(room.phase))return;
 if(currentMinute(room,now)<segment.start)return;
 room.nextSegment=null;
 const picks=room.allInPicks?.[segment.start]||[];
 room.matches=room.matches.map(m=>m.finished?m:simulateSegment(m,segmentPlans(room,m),{start:segment.start,end:segment.end,allIn:m.teams.map(t=>picks.includes(t.id))}));
 if(room.phase==='finalResolution'){
  room.matches[0]=finishFinal(room.matches[0]);
  // Hükmen biten uzatmada oynatma erken biter. Penaltılar 120'ye gelince ayrıca açılır (advance);
  // böylece bitiş saati penaltı olup olmayacağını önceden ele vermez.
  const end=Math.max(currentMinute(room,now),Math.min(120,room.matches[0].minute));
  room.playbackCursor=currentMinute(room,now);room.playbackStart=now;room.playbackEnd=end;
  room.deadline=now+(end-room.playbackCursor)*1000/clockRate(room);
 }
}
function finishRound(room,now){
 if(room.final&&room.rulesVersion>=6){
  const match=room.matches[0];
  if(match.teams[0].goals===match.teams[1].goals&&!match.forfeit){
   room.matches[0]=simulateSegment(match,segmentPlans(room,match),{start:90,end:105});
   startPlayback(room,'finalResolution',now,90,120);
   room.allInPicks={...room.allInPicks,105:[]};room.nextSegment={start:105,end:120};return;
  }
  room.matches[0]=finishFinal(match);room.champion=room.matches[0].winner;room.phase='finished';return;
 }
 if(room.final){
  const match=room.matches[0],a=match.teams[0],b=match.teams[1];
  if(a.goals===b.goals){
   room.matches[0]=resolveFinal(match,match.teams.map(t=>room.lastPlans?.[t.id]||DEFAULT_PLAN));
   startPlayback(room,'finalResolution',now,room.matches[0].version>=3?90:20,room.matches[0].minute);return;
  }
  room.champion=a.goals>b.goals?a.id:b.id;room.phase='finished';return;
 }
 for(const m of room.matches){for(let i=0;i<2;i++){const a=m.teams[i],b=m.teams[1-i],t=room.teams.find(x=>x.id===a.id);t.gf+=a.goals;t.ga+=b.goals;t.points+=a.goals>b.goals?3:a.goals===b.goals?1:0;t.wins+=Number(a.goals>b.goals);}}
 room.results??=[];room.results.push(room.matches);room.round++;
 if(room.round===room.schedule.length){const table=standings(room.teams,room.results,room.seed+900001);room.final=true;room.finalists=table.teams.slice(0,2).map(t=>t.id);room.draws=table.draws;}
 deadline(room,'prepare',now,room.rulesVersion>=3?180000:20000);
}
export function advance(room,now){
 runPendingSegment(room,now);
 if(['players','coaches'].includes(room.phase)&&now>=room.lot.deadline)finishLot(room,now);
 else if(room.phase==='auctionResult'&&now>=room.deadline){room.phase=room.auctionKind;room.auctionResult=null;nextLot(room,now);}
 else if(room.phase==='squadReview'&&now>=room.deadline)finishReview(room,now);
 else if(room.phase==='prepare'&&now>=room.deadline)startHalf(room,now,1);
 else if(room.phase==='firstHalf'&&now>=room.deadline)deadline(room,'halftime',now,room.rulesVersion>=3?180000:25000);
 else if(room.phase==='halftime'&&now>=room.deadline)startHalf(room,now,2);
 else if(room.phase==='secondHalf'&&now>=room.deadline)finishRound(room,now);
 else if(room.phase==='finalResolution'&&now>=room.deadline){
  // Model 6: 120'ye gelindiğinde penaltı serisi varsa oynatma kesintisiz penaltılara uzar.
  if(room.rulesVersion>=6&&room.matches[0].minute>room.playbackEnd){
   const reached=room.deadline;room.playbackCursor=room.playbackEnd;room.playbackStart=reached;room.playbackEnd=room.matches[0].minute;
   room.deadline=reached+(room.playbackEnd-room.playbackCursor)*1000/clockRate(room);
  }
  if(now>=room.deadline){room.champion=room.matches[0].winner;room.phase='finished';}
 }
 return room;
}
export function command(input,uid,action,now,data){
 const r=structuredClone(input);if(!uid||!action.requestId)throw Error('Oturum ve istek kimliği gerekli');
 if(r.requests.includes(`${uid}:${action.requestId}`))return r;
 if(r.rulesVersion===2){
  if(['players','coaches'].includes(r.phase)){r.rulesVersion=3;r.lot.single=true;r.lot.deadline=now+60000;r.lot.hardDeadline=r.lot.deadline;if(allOffersLocked(r))finishLot(r,now);}
  else if(['squadReview','prepare','halftime'].includes(r.phase)){r.rulesVersion=3;r.deadline=now+180000;}
 }
 advance(r,now);
 let t=r.teams.find(x=>x.id===uid);
 if(r.phase==='closed'){
  if(t&&(action.type==='poll'||action.type==='close'&&uid===r.owner))return r;
  if(!t&&action.type==='poll'&&r.departed?.includes(uid))return r;
  throw Error('Oda kapatıldı');
 }
 if(action.type==='join'){
  if(!t){if(r.phase!=='lobby'||r.teams.length>=6)throw Error('Oda katılıma kapalı');r.teams.push(member(uid,action.name,freeLogo(r.teams)));if(r.departed)r.departed=r.departed.filter(id=>id!==uid);}
 }else{
  if(!t){if(['leave','poll'].includes(action.type)&&r.departed?.includes(uid))return r;throw Error('Oda üyesi değilsin');}
  switch(action.type){
   case 'poll':break;
   case 'formation':
    if(r.phase!=='lobby'||r.rulesVersion<4||t.ready)throw Error('Diziliş seçimi kapalı');
    formationLimits(action.formation);
    t.formation=action.formation;
    break;
   case 'logo':
    if(r.phase!=='lobby'||t.ready)throw Error('Logo seçimi kapalı');
    if(!LOGO_IDS.includes(action.logo))throw Error('Geçersiz logo');
    if(r.teams.some(team=>team.id!==uid&&team.logo===action.logo))throw Error('Bu logo başka bir takımda');
    t.logo=action.logo;
    break;
   case 'bonusCard':
    if(r.phase!=='lobby'||r.rulesVersion<4||!r.options.bonusCardsEnabled||t.ready)throw Error('Bonus kartı seçimi kapalı');
    if(!bonusCardById(action.cardId))throw Error('Geçersiz bonus kartı');
    t.bonusCard=action.cardId;
    break;
   case 'ready':
    if(r.phase!=='lobby')throw Error('Lobi kapandı');
    if(action.ready===false){t.ready=false;break;}
    if(r.rulesVersion>=4&&!t.formation)throw Error('Önce diziliş seç');
    if(r.rulesVersion>=4&&r.options.bonusCardsEnabled&&!t.bonusCard)throw Error('Önce bonus kartı seç');
    t.ready=true;
    break;
   case 'close':
    if(uid!==r.owner)throw Error('Yalnızca kurucu odayı kapatabilir');
    r.phase='closed';r.phaseVersion++;r.deadline=null;
    break;
   case 'leave':
    if(uid===r.owner||r.phase!=='lobby')throw Error('Bu odadan ayrılamazsın');
    r.teams=r.teams.filter(team=>team.id!==uid);
    r.departed??=[];r.departed.push(uid);r.departed=r.departed.slice(-32);
    break;
   case 'start':{
    if(uid!==r.owner||r.phase!=='lobby'||r.teams.length<3||!r.teams.every(x=>x.ready))throw Error('En az üç hazır takım ve kurucu gerekli');
    if(r.rulesVersion>=4){
     const formations=r.teams.map(team=>team.formation);
     r.market=makeMarket(data.players,data.coaches,r.teams.length,random(r.seed),{...r.options,formations,randomBonus:true});
     for(const team of r.teams)team.balance+=bonusCardById(team.bonusCard)?.credits||0;
    }else{
     r.rulesVersion=3;
     r.market=makeMarket(data.players,data.coaches,r.teams.length,random(r.seed),r.options);
    }
    r.phase='players';nextLot(r,now);break;
   }
   case 'speed':{
    if(uid!==r.owner||![1,2,4,8].includes(action.speed))throw Error('Geçersiz hız seçimi');
    if(['firstHalf','secondHalf','finalResolution'].includes(r.phase)&&r.rulesVersion>=2){r.playbackCursor=currentMinute(r,now);r.playbackStart=now;r.deadline=now+(r.playbackEnd-r.playbackCursor)*1000/(action.speed*(r.rulesVersion>=3?1.5:1));}
    r.playbackSpeed=action.speed;break;
   }
   case 'bid':if(!['players','coaches'].includes(r.phase))throw Error('İhale açık değil');bid(r.lot,t,action.amount,now,action.lotId);if(allOffersLocked(r))finishLot(r,now);break;
   case 'pass':{
    if(!['players','coaches'].includes(r.phase)||action.lotId!==r.lot.id)throw Error('İhale kapandı');
    if(r.lot.single&&(Object.hasOwn(r.lot.bids,uid)||r.lot.passed.includes(uid)))throw Error('Bu teklif zaten kilitli');
    if(r.lot.sealed)delete r.lot.bids[uid];
    if(!r.lot.passed.includes(uid))r.lot.passed.push(uid);
    const buyers=r.teams.filter(x=>eligible(x,r.lot.card)&&x.id!==r.lot.bidder);
    if(allOffersLocked(r)||(!r.lot.sealed&&buyers.every(x=>r.lot.passed.includes(x.id))))finishLot(r,now);break;
   }
   case 'plan':{
    if(!['squadReview','prepare','halftime'].includes(r.phase)||action.phaseVersion!==r.phaseVersion)throw Error('Taktik süresi değişti');
    if(r.phase!=='squadReview'&&!activePairs(r).flat().includes(uid))throw Error('Bu hafta maçın yok');
    if(r.plans[uid])throw Error('Taktik zaten kilitli');
    const plan=validatePlan(action.plan);
    if(plan.captainId!==null){
     const player=t.players.find(p=>String(p.id)===String(plan.captainId));
     const sentOff=r.phase==='halftime'&&r.matches.some(m=>m.teams.some(team=>team.id===uid&&team.players.some(p=>p.id===player?.id&&p.red)));
     if(!player||sentOff)throw Error('Geçersiz kaptan seçimi');plan.captainId=player.id;
    }
    r.plans[uid]=plan;
    if(r.phase==='squadReview'){if(r.teams.every(t=>r.plans[t.id]))finishReview(r,now);break;}
    if(activePairs(r).flat().every(id=>r.plans[id]))startHalf(r,now,r.phase==='prepare'?1:2);break;
   }
   case 'allIn':{
    if(!(r.rulesVersion>=6))throw Error('Bu odada "Tüm riskleri al!" yok');
    const lock=allInLock(r);
    if(!lock||action.lock!==lock||action.phaseVersion!==r.phaseVersion||r.nextSegment?.start!==lock)throw Error('"Tüm riskleri al!" süresi doldu');
    const match=r.matches.find(m=>m.teams.some(team=>team.id===uid));
    if(!match)throw Error('Bu maçta oynamıyorsun');
    const minute=currentMinute(r,now);
    if(minute<lock-ALL_IN_WINDOW||minute>=lock)throw Error('"Tüm riskleri al!" penceresi kapalı');
    const visible=visibleScore(match,minute,uid);
    if(visible.forfeit)throw Error('Maç hükmen sonuçlandı');
    if(visible.own>visible.opponent)throw Error('Önde olan takım tüm riskleri alamaz');
    // Seçim geri alınamaz; tekrar basmak bir şey değiştirmez. Kesin uygunluk kilitte allInEligible ile belirlenir.
    r.allInPicks??={};r.allInPicks[lock]??=[];
    if(!r.allInPicks[lock].includes(uid))r.allInPicks[lock].push(uid);
    break;
   }
   default:throw Error('Bilinmeyen komut');
  }
 }
 if(action.type==='poll'){
  if(JSON.stringify(r)!==JSON.stringify(input))r.version++;
  return r;
 }
 r.requests.push(`${uid}:${action.requestId}`);r.requests=r.requests.slice(-256);r.version++;return r;
}
// Canlı fazın "Tüm riskleri al!" kilit dakikası (model 6): ikinci yarıda 70, uzatmada 105.
function allInLock(room){return room.phase==='secondHalf'?70:room.phase==='finalResolution'?105:null;}
// Görünen dakikaya kadarki skor; gelecek goller sayılmaz.
function visibleScore(match,minute,uid){
 const side=match.teams.findIndex(team=>team.id===uid);
 const goals=match.teams.map(team=>match.events.filter(e=>e.type==='goal'&&e.team===team.id&&e.minute<=minute).length);
 return {own:goals[side],opponent:goals[1-side],forfeit:match.events.some(e=>e.type==='forfeit'&&e.minute<=minute)};
}
// Yalnız oyuncunun kendi maçı; rakibin seçimi kilitten önce hiçbir alanda görünmez.
function allInView(r,uid,minute){
 const lock=r.rulesVersion>=6&&['secondHalf','finalResolution'].includes(r.phase)?allInLock(r):null;
 const match=lock&&r.matches.find(m=>m.teams.some(team=>team.id===uid));
 if(!match)return null;
 const pending=r.nextSegment?.start===lock,from=lock-ALL_IN_WINDOW,visible=visibleScore(match,minute,uid);
 const chosen=(r.allInPicks?.[lock]||[]).includes(uid);
 // Sunucu saatine göre pencerenin açılış/kilit anı; istemci geri sayımı ve sık yoklamayı buna göre yapar.
 const at=target=>pending?Math.round(r.playbackStart+(target-r.playbackCursor)*1000/clockRate(r)):null;
 return {lock,from,available:pending&&!chosen&&!visible.forfeit&&minute>=from&&minute<lock&&visible.own<=visible.opponent,chosen,opensAt:at(from),locksAt:at(lock)};
}
function initialPlan(room,uid){
 const formation=room.teams.find(team=>team.id===uid)?.formation;
 return formation?{...DEFAULT_PLAN,formation}:DEFAULT_PLAN;
}

function upcomingMatch(room,uid){
 if(!room.schedule||!['squadReview','prepare','halftime'].includes(room.phase))return null;
 const pairs=activePairs(room),index=pairs.findIndex(pair=>pair.includes(uid));
 const neutral=!(room.rulesVersion>=4)||!!room.final;
 if(index===-1)return {opponentId:null,home:null,neutral,round:room.round,final:!!room.final,referee:null,bye:true};
 const [home,away]=pairs[index];
 return {opponentId:home===uid?away:home,home:neutral?null:home===uid,neutral,round:room.round,final:!!room.final,referee:matchSeed(room,index)%3,bye:false};
}

function scoringLeaders(room,minute){
 const players=new Map();
 function count(team,id,name,kind){
  const key=JSON.stringify([team,id]);
  const row=players.get(key)||{id,name,team,goals:0,assists:0,total:0};
  row[kind]++;row.total++;players.set(key,row);
 }
 function add(match,until){
  for(const event of match.events){
   if(event.type!=='goal'||event.minute>until)continue;
   count(event.team,event.playerId,event.playerName,'goals');
   if(event.assisterId!=null)count(event.team,event.assisterId,event.assisterName,'assists');
  }
 }
 for(const round of room.results||[])for(const match of round)add(match,Infinity);
 const currentVisible=['firstHalf','halftime','secondHalf','finalResolution','finished'].includes(room.phase);
 if(currentVisible&&(room.phase!=='finished'||room.final)){
  for(const match of room.matches)add(match,minute);
 }
 return [...players.values()].sort((a,b)=>b.total-a.total||b.goals-a.goals||String(a.name).localeCompare(String(b.name),'tr')||String(a.id).localeCompare(String(b.id)));
}

// İhalede kaçıncı kartta olunduğu: açık kart için sırası, sonuç ekranında az önce kapanan kart.
function lotProgress(r){
 const kind=['players','coaches'].includes(r.phase)?r.phase:r.phase==='auctionResult'?r.auctionKind:null;
 const market=kind&&r.market?.[kind];if(!market)return {lotNumber:null,lotTotal:null,lotKind:null};
 return {lotNumber:Math.min(market.length,r.phase==='auctionResult'?r.lotIndex:r.lotIndex+1),lotTotal:market.length,lotKind:kind};
}
export function publicView(r,uid,now){
 const member=r.teams.find(t=>t.id===uid);
 if(!member){
  if(r.departed?.includes(uid))return {id:r.id,owner:r.owner,phase:'left',version:r.version};
  throw Error('Oda üyesi değilsin');
 }
 if(r.phase==='closed')return {id:r.id,owner:r.owner,phase:'closed',version:r.version};
 const live=['firstHalf','secondHalf','finalResolution'].includes(r.phase);
 const length=r.matches[0]?.version>=3?45:10;
 const minute=live?currentMinute(r,now):r.phase==='halftime'?length:r.phase==='finished'?Infinity:length*2;
 const lot=r.lot?.sealed?{id:r.lot.id,card:r.lot.card,deadline:r.lot.deadline,sealed:true,single:r.lot.single||false,myLocked:Object.hasOwn(r.lot.bids,uid)||r.lot.passed.includes(uid),myBid:r.lot.bids[uid]??null,passed:r.lot.passed.includes(uid)?[uid]:[],amount:0,bidder:null}:r.lot;
 return {id:r.id,owner:r.owner,rulesVersion:r.rulesVersion||1,playbackSpeed:r.playbackSpeed||1,assignments:r.assignments||[],auctionResult:r.auctionResult||null,options:r.options||{bonusEnabled:false},phase:r.phase,version:r.version,phaseVersion:r.phaseVersion,deadline:r.lot&&['players','coaches'].includes(r.phase)?r.lot.deadline:r.deadline,
  teams:r.teams.map(({bonusCard,...team})=>team),myBonusCard:member.bonusCard||null,bonusCardSelected:r.teams.filter(team=>team.bonusCard).map(team=>team.id),nextMatch:upcomingMatch(r,uid),leaderboard:scoringLeaders(r,minute),pairs:r.schedule?activePairs(r):[],table:standings(r.teams,r.results||[],r.seed+900001).teams.map(t=>t.id),draws:r.draws||[],lot,...lotProgress(r),history:r.history,pool:r.pool,round:r.round,final:r.final||false,finalists:r.finalists||[],champion:r.champion,
  referees:r.schedule?activePairs(r).map((pair,i)=>({teams:pair,strictness:matchSeed(r,i)%3})):[],
  discipline:r.matches.map(m=>({teams:m.teams.map(t=>({id:t.id,players:t.players.map(p=>({id:p.id,name:p.name,red:m.events.some(e=>e.type==='red'&&e.playerId===p.id&&e.minute<=minute),yellow:m.events.filter(e=>e.type==='yellow'&&e.playerId===p.id&&e.minute<=minute).length}))}))})),
  allIn:allInView(r,uid,minute),
  myPlan:r.plans[uid]||r.lastPlans?.[uid]||initialPlan(r,uid),locked:Object.keys(r.plans),
  matches:r.matches.map(m=>({neutral:!(m.version>=4)||m.neutral===true,regulationMinutes:m.version>=3?90:20,minute:Math.min(minute,m.minute),teams:m.teams.map(t=>({id:t.id,captainId:t.captainId,captainName:t.players.find(p=>p.id===t.captainId)?.name})),events:m.events.filter(e=>e.minute<=minute),score:m.forfeit&&m.events.some(e=>e.type==='forfeit'&&e.minute<=minute)?m.teams.map(t=>t.goals):m.teams.map(t=>m.events.filter(e=>e.minute<=minute&&e.team===t.id&&e.type==='goal').length),shootout:minute>=m.minute?m.shootout:null,...(m.snapshots?{snapshots:m.snapshots.filter(s=>s.minute<=minute)}:{})}))};
}
