import {random,makeMarket,openLot,bid,settle,completePool,eligible,shuffle} from './market.js';
import {fixtures,validatePlan,DEFAULT_PLAN,beginMatch,simulateHalf,resolveFinal} from './simulation.js';
import {standings} from './standings.js';

export function createRoom(id,owner,name,seed,now,options={}){return {id,owner,seed,rulesVersion:3,playbackSpeed:1,assignments:[],createdAt:now,options:{bonusEnabled:options.bonusEnabled===true},phase:'lobby',version:0,phaseVersion:0,teams:[member(owner,name)],requests:[],history:[],pool:[],lotIndex:0,plans:{},matches:[],round:0};}
function member(id,name){const clean=String(name||'').trim().slice(0,18);if(!clean)throw Error('Takım adı gerekli');return {id,name:clean,balance:200,players:[],coach:null,ready:false,points:0,gf:0,ga:0,wins:0};}
function deadline(room,phase,now,ms){if(room.rulesVersion===2&&['squadReview','prepare','halftime'].includes(phase)){room.rulesVersion=3;ms=180000;}room.phase=phase;room.phaseVersion++;room.deadline=now+ms;room.plans={};}
function nextLot(room,now){
 const market=room.phase==='players'?room.market.players:room.market.coaches;
 if(room.lotIndex<market.length){room.lot=openLot(market[room.lotIndex],now,`${room.phase}-${room.lotIndex}`,room.rulesVersion>=2,shuffle(room.teams.map(t=>t.id),random(room.seed+room.lotIndex*937+(room.phase==='coaches'?90001:0))),room.rulesVersion>=3);return;}
 room.assignments??=[];room.assignments.push(...completePool(room.teams,room.pool,random(room.seed+room.version)));room.pool=[];
 if(room.phase==='players'){room.phase='coaches';room.lotIndex=0;nextLot(room,now);}
 else {room.lot=null;room.schedule=fixtures(room.teams.map(t=>t.id));deadline(room,room.rulesVersion>=2?'squadReview':'prepare',now,room.rulesVersion>=3?180000:room.rulesVersion>=2?120000:40000);}
}
function finishLot(room,now){
 const lot=room.lot;
 const rows=room.teams.map(t=>({team:t.id,amount:lot.bids?.[t.id]??null,status:lot.bids?.[t.id]!==undefined?'bid':!eligible(t,lot.card)?'ineligible':lot.passed.includes(t.id)?'pass':'timeout'}));
 settle(lot,room.teams,room.pool);room.history.push({card:lot.card,amount:lot.amount,bidder:lot.bidder,offers:lot.offers||[],rows,tied:lot.tied||false});room.lotIndex++;
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
 room.matches=pairs.map(([a,b],i)=>{
  const teams=[a,b].map(id=>room.teams.find(t=>t.id===id));
  const plans=[a,b].map(id=>room.plans[id]||room.lastPlans?.[id]||DEFAULT_PLAN);
  const previous=half===1?beginMatch(...teams,matchSeed(room,i),matchSeed(room,i)%3):room.matches[i];
  if(half===1&&!(room.rulesVersion>=2))previous.version=2;
  return previous.finished?previous:simulateHalf(previous,plans);
 });
 room.lastPlans={...room.lastPlans,...room.plans};const length=room.matches[0].version>=3?45:10;startPlayback(room,half===1?'firstHalf':'secondHalf',now,(half-1)*length,half*length);
}
function finishRound(room,now){
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
 if(['players','coaches'].includes(room.phase)&&now>=room.lot.deadline)finishLot(room,now);
 else if(room.phase==='auctionResult'&&now>=room.deadline){room.phase=room.auctionKind;room.auctionResult=null;nextLot(room,now);}
 else if(room.phase==='squadReview'&&now>=room.deadline)finishReview(room,now);
 else if(room.phase==='prepare'&&now>=room.deadline)startHalf(room,now,1);
 else if(room.phase==='firstHalf'&&now>=room.deadline)deadline(room,'halftime',now,room.rulesVersion>=3?180000:25000);
 else if(room.phase==='halftime'&&now>=room.deadline)startHalf(room,now,2);
 else if(room.phase==='secondHalf'&&now>=room.deadline)finishRound(room,now);
 else if(room.phase==='finalResolution'&&now>=room.deadline){room.champion=room.matches[0].winner;room.phase='finished';}
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
 if(action.type==='join'){
  if(!t){if(r.phase!=='lobby'||r.teams.length>=6)throw Error('Oda katılıma kapalı');r.teams.push(member(uid,action.name));}
 }else{
  if(!t)throw Error('Oda üyesi değilsin');
  switch(action.type){
   case 'poll':break;
   case 'ready':if(r.phase!=='lobby')throw Error('Lobi kapandı');t.ready=true;break;
   case 'start':{
    if(uid!==r.owner||r.phase!=='lobby'||r.teams.length<3||!r.teams.every(x=>x.ready))throw Error('En az üç hazır takım ve kurucu gerekli');
    r.rulesVersion=3;r.market=makeMarket(data.players,data.coaches,r.teams.length,random(r.seed),r.options);r.phase='players';nextLot(r,now);break;
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
   default:throw Error('Bilinmeyen komut');
  }
 }
 if(action.type==='poll'){
  if(JSON.stringify(r)!==JSON.stringify(input))r.version++;
  return r;
 }
 r.requests.push(`${uid}:${action.requestId}`);r.requests=r.requests.slice(-256);r.version++;return r;
}
export function publicView(r,uid,now){
 if(!r.teams.some(t=>t.id===uid))throw Error('Oda üyesi değilsin');
 const live=['firstHalf','secondHalf','finalResolution'].includes(r.phase);
 const length=r.matches[0]?.version>=3?45:10;
 const minute=live?currentMinute(r,now):r.phase==='halftime'?length:r.phase==='finished'?Infinity:length*2;
 const lot=r.lot?.sealed?{id:r.lot.id,card:r.lot.card,deadline:r.lot.deadline,sealed:true,single:r.lot.single||false,myLocked:Object.hasOwn(r.lot.bids,uid)||r.lot.passed.includes(uid),myBid:r.lot.bids[uid]??null,passed:r.lot.passed.includes(uid)?[uid]:[],amount:0,bidder:null}:r.lot;
 return {id:r.id,owner:r.owner,rulesVersion:r.rulesVersion||1,playbackSpeed:r.playbackSpeed||1,assignments:r.assignments||[],auctionResult:r.auctionResult||null,options:r.options||{bonusEnabled:false},phase:r.phase,version:r.version,phaseVersion:r.phaseVersion,deadline:r.lot&&['players','coaches'].includes(r.phase)?r.lot.deadline:r.deadline,
  teams:r.teams,pairs:r.schedule?activePairs(r):[],table:standings(r.teams,r.results||[],r.seed+900001).teams.map(t=>t.id),draws:r.draws||[],lot,history:r.history,pool:r.pool,round:r.round,final:r.final||false,champion:r.champion,
  referees:r.schedule?activePairs(r).map((pair,i)=>({teams:pair,strictness:matchSeed(r,i)%3})):[],
  discipline:r.matches.map(m=>({teams:m.teams.map(t=>({id:t.id,players:t.players.map(p=>({id:p.id,name:p.name,red:m.events.some(e=>e.type==='red'&&e.playerId===p.id&&e.minute<=minute),yellow:m.events.filter(e=>e.type==='yellow'&&e.playerId===p.id&&e.minute<=minute).length}))}))})),
  myPlan:r.plans[uid]||r.lastPlans?.[uid]||DEFAULT_PLAN,locked:Object.keys(r.plans),
  matches:r.matches.map(m=>({regulationMinutes:m.version>=3?90:20,minute:Math.min(minute,m.minute),teams:m.teams.map(t=>({id:t.id,captainId:t.captainId,captainName:t.players.find(p=>p.id===t.captainId)?.name})),events:m.events.filter(e=>e.minute<=minute),score:m.forfeit&&m.events.some(e=>e.type==='forfeit'&&e.minute<=minute)?m.teams.map(t=>t.goals):m.teams.map(t=>m.events.filter(e=>e.minute<=minute&&e.team===t.id&&e.type==='goal').length),shootout:minute>=m.minute?m.shootout:null}))};
}
