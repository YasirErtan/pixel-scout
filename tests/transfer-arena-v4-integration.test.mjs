import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoom,command,publicView} from '../server/transfer-arena/room.js';
import {arenaData} from '../server/transfer-arena/data.js';
import {makeMarket,random,completePool} from '../server/transfer-arena/market.js';

const formations=['2-2-2','2-3-1','3-2-1','1-3-2'];
const perks=['president','fan','fitness','passing'];
const quota=f=>Object.fromEntries(['GK','DEF','MID','ATT'].map((r,i)=>[r,i?Number(f.split('-')[i-1]):1]));

test('extreme formation markets keep exact rating bands and assign every card across random bonus ratings',async()=>{
 const data=await arenaData(),ratings=new Set();
 for(let count=3;count<=6;count++)for(const formation of formations)for(let seed=1;seed<=48;seed++){
  const fs=Array(count).fill(formation),market=makeMarket(data.players,data.coaches,count,random(seed*298973),{formations:fs,bonusEnabled:true,randomBonus:true});
  const bonus=market.players.find(p=>p.bonus);ratings.add(bonus.overall);
  assert.equal(market.players.length,7*count);assert.equal(new Set(market.players.map(p=>p.id)).size,7*count);
  const bands=[[70,75],[76,81],[82,87],[88,100]];
  bands.forEach(([lo,hi],i)=>assert.equal(market.players.filter(p=>p.overall>=lo&&p.overall<=hi).length,[1,1,3,2][i]*count));
  const teams=fs.map((f,i)=>({id:String(i),formation:f,balance:200,players:[],coach:null}));
  completePool(teams,[...market.players,...market.coaches],random(seed));
  assert.ok(teams.every(t=>t.players.length===7&&t.coach));
 }
 assert.ok(ratings.has(70)&&ratings.has(90));assert.ok(ratings.size>=18);
});

test('mixed formations and all bonus choices survive complete 3–6 team tournaments',async()=>{
 const data=await arenaData();
 for(let count=3;count<=6;count++)for(let seed=1;seed<=8;seed++){
  const enabled=seed%2===0;
  let room=createRoom('123456','t0','Team 0',seed,0,{bonusEnabled:true,bonusCardsEnabled:enabled}),now=0,seq=0;
  const act=(uid,type,extra={})=>{room=command(room,uid,{type,requestId:String(++seq),...extra},now,data);};
  for(let i=1;i<count;i++)act('t'+i,'join',{name:'Team '+i});
  const chosen=new Map();
  for(let i=0;i<count;i++){
   const id='t'+i,f=formations[(i+seed)%4];chosen.set(id,f);
   act(id,'formation',{formation:f});
   if(enabled)act(id,'bonusCard',{cardId:perks[i%4]});
   act(id,'ready');
  }
  act('t0','start');
  assert.equal(room.market.players.length,count*7);
  for(const role of ['GK','DEF','MID','ATT'])assert.equal(room.market.players.filter(p=>p.position===role).length,[...chosen.values()].reduce((s,f)=>s+quota(f)[role],0));
  const bonus=room.market.players.find(p=>p.bonus);assert.ok(bonus.overall>=70&&bonus.overall<=90);
  let steps=0;
  while(room.phase!=='finished'&&steps++<200){
   const view=publicView(room,'t0',now);
   if(room.phase==='firstHalf'){
    // No goal from the newly precomputed half may appear before its playback.
    const completedGoals=(room.results||[]).flat().flatMap(m=>m.events).filter(e=>e.type==='goal').length;
    assert.equal(view.leaderboard.reduce((s,r)=>s+r.goals,0),completedGoals);
   }
   now=(room.lot&&['players','coaches'].includes(room.phase)?room.lot.deadline:room.deadline)+1;
   act('t0','poll');
  }
  assert.equal(room.phase,'finished');
  for(const [i,t] of room.teams.entries()){
   for(const [role,n] of Object.entries(quota(chosen.get(t.id))))assert.equal(t.players.filter(p=>p.position===role).length,n);
   assert.equal(t.players.length,7);assert.ok(t.coach);
   assert.equal(t.balance,192+(enabled&&perks[i%4]==='president'?15:0));
  }
  const allMatches=[...(room.results||[]).flat(),...room.matches];
  const goals=allMatches.flatMap(m=>m.events).filter(e=>e.type==='goal');
  const board=publicView(room,'t0',now).leaderboard;
  assert.equal(board.reduce((s,r)=>s+r.goals,0),goals.length);
  assert.equal(board.reduce((s,r)=>s+r.assists,0),goals.filter(e=>e.assisterId!=null).length);
  for(const e of goals.filter(e=>e.assisterId!=null)){
   assert.notEqual(e.assisterId,e.playerId);assert.ok(!e.penalty);
   assert.ok(room.teams.find(t=>t.id===e.team).players.some(p=>p.id===e.assisterId));
  }
  assert.ok(room.finalists.includes(room.champion));
 }
});
