import test from 'node:test';import assert from 'node:assert/strict';
import {makeMarket,random,completePool,LIMITS} from '../server/transfer-arena/market.js';
import {arenaData} from '../server/transfer-arena/data.js';
import {BONUS_PLAYER} from '../dist/games/transfer-arenasi/bonus-player.js';
import {playerCard} from '../dist/games/transfer-arenasi/cards.js';
import {beginMatch,simulateHalf,DEFAULT_PLAN} from '../server/transfer-arena/simulation.js';
import {createRoom,command,publicView} from '../server/transfer-arena/room.js';

test('optional bonus enters once and preserves exact role/quality totals and automatic allocation',async()=>{
 const data=await arenaData();
 for(let seats=3;seats<=6;seats++)for(let seed=1;seed<=30;seed++)for(const bonusEnabled of [false,true]){
  const next=random(seed),market=makeMarket(data.players,data.coaches,seats,next,{bonusEnabled});
  assert.equal(market.players.length,7*seats);assert.equal(market.players.filter(p=>p.id===BONUS_PLAYER.id).length,Number(bonusEnabled));
  assert.deepEqual([[70,75],[76,81],[82,87],[88,100]].map(([lo,hi])=>market.players.filter(p=>p.overall>=lo&&p.overall<=hi).length),[2*seats,2*seats,2*seats,seats]);
  const teams=Array.from({length:seats},(_,i)=>({id:'t'+i,balance:200,players:[],coach:null}));
  completePool(teams,market.players,next);completePool(teams,market.coaches,next);
  for(const team of teams){assert.equal(team.balance,192);for(const [role,count] of Object.entries(LIMITS))assert.equal(team.players.filter(p=>p.position===role).length,count);}
 }
 const html=playerCard(BONUS_PLAYER);assert.ok(html.includes(BONUS_PLAYER.portraitURL));assert.ok(html.includes('BONUS'));assert.ok(!html.includes('FC 27'));
});
const keys=['finishing','shotPower','sprintSpeed','vision','shortPassing','ballControl','defensiveAwareness','interceptions','standingTackle','stamina','gkReflexes','gkPositioning','penalties'];
const team=id=>({id,players:['GK','DEF','DEF','MID','MID','ATT','ATT'].map((position,i)=>({id:id+i,name:id+i,position,overall:80,attributes:Object.fromEntries(keys.map(k=>[k,80]))}))});
test('captain boost affects a real shooting opportunity without changing ratings or stacking across halves',()=>{
 const start=beginMatch(team('a'),team('b'),139);
 const base=simulateHalf(start,[{...DEFAULT_PLAN,captainId:'a0'},{...DEFAULT_PLAN,captainId:'b0'}]);
 const boosted=simulateHalf(start,[{...DEFAULT_PLAN,captainId:'a6'},{...DEFAULT_PLAN,captainId:'b0'}]);
 assert.equal(base.events[0].playerId,'a6');assert.equal(boosted.events[0].minute,base.events[0].minute);
 assert.ok(Math.abs(boosted.events[0].xg-base.events[0].xg-.0072)<1e-10);
 assert.equal(boosted.teams[0].players.filter(p=>p.captain).length,1);
 assert.equal(boosted.teams[0].captainId,'a6');assert.equal(boosted.teams[0].players[6].attributes.finishing,80);
 const changed=simulateHalf(boosted,[{...DEFAULT_PLAN,captainId:'a5'},{...DEFAULT_PLAN,captainId:'b0'}]);
 assert.equal(changed.teams[0].captainId,'a5');assert.equal(changed.teams[0].players.filter(p=>p.captain).length,1);
 assert.deepEqual(changed.events.slice(0,boosted.events.length),boosted.events);assert.equal(start.teams[0].players[6].attributes.finishing,80);
 assert.throws(()=>simulateHalf(start,[{...DEFAULT_PLAN,captainId:'b5'},DEFAULT_PLAN]),/kaptan/);
});
test('room locks the bonus option and rejects foreign or dismissed captain selections',()=>{
 const r=createRoom('123456','a','A',1,0,{bonusEnabled:true});r.teams.push({...r.teams[0],id:'b',name:'B'});
 r.teams[0].players=team('a').players;r.teams[1].players=team('b').players;
 r.phase='prepare';r.phaseVersion=7;r.deadline=10000;r.schedule=[[['a','b']]];
 const action={type:'plan',requestId:'1',phaseVersion:7,plan:{...DEFAULT_PLAN,captainId:'b6'}};
 assert.throws(()=>command(r,'a',action,1,{}),/kaptan/);
 const valid=command(r,'a',{...action,plan:{...DEFAULT_PLAN,captainId:'a6'}},1,{});
 assert.equal(valid.plans.a.captainId,'a6');assert.equal(publicView(valid,'a',1).options.bonusEnabled,true);
 const half=structuredClone(r);half.phase='halftime';half.matches=[{teams:[{id:'a',players:[{id:'a6',red:true}]}]}];
 assert.throws(()=>command(half,'a',{...action,plan:{...DEFAULT_PLAN,captainId:'a6'}},1,{}),/kaptan/);
});
