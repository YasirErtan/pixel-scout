import {random,makeMarket,openLot,bid,settle,completePool,eligible} from './market.js';
import {fixtures,validatePlan,DEFAULT_PLAN,beginMatch,simulateHalf,resolveFinal} from './simulation.js';
import {standings} from './standings.js';

export function createRoom(id,owner,name,seed,now){return {id,owner,seed,createdAt:now,phase:'lobby',version:0,phaseVersion:0,teams:[member(owner,name)],requests:[],history:[],pool:[],lotIndex:0,plans:{},matches:[],round:0};}
function member(id,name){const clean=String(name||'').trim().slice(0,18);if(!clean)throw Error('Takım adı gerekli');return {id,name:clean,balance:200,players:[],coach:null,ready:false,points:0,gf:0,ga:0,wins:0};}
function deadline(room,phase,now,ms){room.phase=phase;room.phaseVersion++;room.deadline=now+ms;room.plans={};}
function nextLot(room,now){
 const market=room.phase==='players'?room.market.players:room.market.coaches;
 if(room.lotIndex<market.length){room.lot=openLot(market[room.lotIndex],now,`${room.phase}-${room.lotIndex}`);return;}
 completePool(room.teams,room.pool,random(room.seed+room.version));room.pool=[];
 if(room.phase==='players'){room.phase='coaches';room.lotIndex=0;nextLot(room,now);}
 else {room.lot=null;room.schedule=fixtures(room.teams.map(t=>t.id));deadline(room,'prepare',now,40000);}
}
function finishLot(room,now){settle(room.lot,room.teams,room.pool);room.history.push({card:room.lot.card,amount:room.lot.amount,bidder:room.lot.bidder});room.lotIndex++;nextLot(room,now);}
function activePairs(room){return room.final?[[room.finalists[0],room.finalists[1]]]:room.schedule[room.round];}
function matchSeed(room,i){return room.seed+room.round*719+i*31+(room.final?100003:0);}
function startHalf(room,now,half){
 const pairs=activePairs(room);
 room.matches=pairs.map(([a,b],i)=>{
  const teams=[a,b].map(id=>room.teams.find(t=>t.id===id));
  const plans=[a,b].map(id=>room.plans[id]||room.lastPlans?.[id]||DEFAULT_PLAN);
  const previous=half===1?beginMatch(...teams,matchSeed(room,i),matchSeed(room,i)%3):room.matches[i];
  return previous.finished?previous:simulateHalf(previous,plans);
 });
 room.lastPlans={...room.lastPlans,...room.plans};room.playbackStart=now;deadline(room,half===1?'firstHalf':'secondHalf',now,30000);
}
function finishRound(room,now){
 if(room.final){
  const match=room.matches[0],a=match.teams[0],b=match.teams[1];
  if(a.goals===b.goals){
   room.matches[0]=resolveFinal(match,match.teams.map(t=>room.lastPlans?.[t.id]||DEFAULT_PLAN));
   room.playbackStart=now;deadline(room,'finalResolution',now,Math.max(12000,(room.matches[0].minute-20)*3000));return;
  }
  room.champion=a.goals>b.goals?a.id:b.id;room.phase='finished';return;
 }
 for(const m of room.matches){for(let i=0;i<2;i++){const a=m.teams[i],b=m.teams[1-i],t=room.teams.find(x=>x.id===a.id);t.gf+=a.goals;t.ga+=b.goals;t.points+=a.goals>b.goals?3:a.goals===b.goals?1:0;t.wins+=Number(a.goals>b.goals);}}
 room.results??=[];room.results.push(room.matches);room.round++;
 if(room.round===room.schedule.length){const table=standings(room.teams,room.results,room.seed+900001);room.final=true;room.finalists=table.teams.slice(0,2).map(t=>t.id);room.draws=table.draws;}
 deadline(room,'prepare',now,20000);
}
export function advance(room,now){
 if(['players','coaches'].includes(room.phase)&&now>=room.lot.deadline)finishLot(room,now);
 else if(room.phase==='prepare'&&now>=room.deadline)startHalf(room,now,1);
 else if(room.phase==='firstHalf'&&now>=room.deadline)deadline(room,'halftime',now,25000);
 else if(room.phase==='halftime'&&now>=room.deadline)startHalf(room,now,2);
 else if(room.phase==='secondHalf'&&now>=room.deadline)finishRound(room,now);
 else if(room.phase==='finalResolution'&&now>=room.deadline){room.champion=room.matches[0].winner;room.phase='finished';}
 return room;
}
export function command(input,uid,action,now,data){
 const r=structuredClone(input);if(!uid||!action.requestId)throw Error('Oturum ve istek kimliği gerekli');
 if(r.requests.includes(`${uid}:${action.requestId}`))return r;
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
    r.market=makeMarket(data.players,data.coaches,r.teams.length,random(r.seed));r.phase='players';nextLot(r,now);break;
   }
   case 'bid':if(!['players','coaches'].includes(r.phase))throw Error('İhale açık değil');bid(r.lot,t,action.amount,now,action.lotId);break;
   case 'pass':{
    if(!['players','coaches'].includes(r.phase)||action.lotId!==r.lot.id)throw Error('İhale kapandı');
    if(!r.lot.passed.includes(uid))r.lot.passed.push(uid);
    const buyers=r.teams.filter(x=>eligible(x,r.lot.card)&&x.id!==r.lot.bidder);
    if(buyers.every(x=>r.lot.passed.includes(x.id)))finishLot(r,now);break;
   }
   case 'plan':{
    if(!['prepare','halftime'].includes(r.phase)||action.phaseVersion!==r.phaseVersion)throw Error('Taktik süresi değişti');
    if(!activePairs(r).flat().includes(uid))throw Error('Bu hafta maçın yok');
    if(r.plans[uid])throw Error('Taktik zaten kilitli');r.plans[uid]=validatePlan(action.plan);
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
 const minute=live?(r.phase==='firstHalf'?0:r.phase==='secondHalf'?10:20)+Math.min(r.phase==='finalResolution'?r.matches[0].minute-20:10,Math.max(0,(now-r.playbackStart)/3000)):r.phase==='halftime'?10:r.phase==='finished'?Infinity:20;
 return {id:r.id,owner:r.owner,phase:r.phase,version:r.version,phaseVersion:r.phaseVersion,deadline:r.lot&&['players','coaches'].includes(r.phase)?r.lot.deadline:r.deadline,
  teams:r.teams,pairs:r.schedule?activePairs(r):[],table:standings(r.teams,r.results||[],r.seed+900001).teams.map(t=>t.id),draws:r.draws||[],lot:r.lot,history:r.history,pool:r.pool,round:r.round,final:r.final||false,champion:r.champion,
  referees:r.schedule?activePairs(r).map((pair,i)=>({teams:pair,strictness:matchSeed(r,i)%3})):[],
  myPlan:r.plans[uid]||r.lastPlans?.[uid]||DEFAULT_PLAN,locked:Object.keys(r.plans),
  matches:r.matches.map(m=>({minute:Math.min(minute,m.minute),teams:m.teams.map(t=>({id:t.id})),events:m.events.filter(e=>e.minute<=minute),score:m.forfeit&&m.events.some(e=>e.type==='forfeit'&&e.minute<=minute)?m.teams.map(t=>t.goals):m.teams.map(t=>m.events.filter(e=>e.minute<=minute&&e.team===t.id&&e.type==='goal').length),shootout:minute>=m.minute?m.shootout:null}))};
}
