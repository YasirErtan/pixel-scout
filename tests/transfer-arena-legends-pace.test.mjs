import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
import {LEGENDS} from '../server/transfer-arena/legends.js';
import {LEGEND_PORTRAITS} from '../dist/games/transfer-arenasi/legend-portraits.js';
import {arenaData} from '../server/transfer-arena/data.js';
import {makeMarket,random,completePool,LIMITS} from '../server/transfer-arena/market.js';
import {beginMatch,simulateHalf,DEFAULT_PLAN,teamSprint,sprintAdvantage} from '../server/transfer-arena/simulation.js';
import {playerCard,ATTRIBUTES} from '../dist/games/transfer-arenasi/cards.js';

test('15 base legends retain sourced ratings, complete attributes and credited bundled photos',()=>{
 assert.equal(LEGENDS.length,15);assert.equal(new Set(LEGENDS.map(p=>p.id)).size,15);
 assert.deepEqual(LEGENDS.map(p=>p.overall),[95,95,94,94,93,93,93,93,92,92,92,92,91,91,91]);
 for(const p of LEGENDS){
  assert.ok(p.legend&&p.overall>90);for(const key of Object.keys(ATTRIBUTES))assert.ok(Number.isInteger(p.attributes[key])&&p.attributes[key]>=0&&p.attributes[key]<=99);
  const photo=LEGEND_PORTRAITS[p.id];assert.ok(photo?.author&&photo.source&&photo.license);
  assert.match(photo.source,/^https:\/\/commons.wikimedia.org\//);
  const bytes=fs.readFileSync(new URL('../dist/games/transfer-arenasi/'+photo.path,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),photo.sha256);
  const html=playerCard({...p,portraitURL:photo.path});assert.match(html,/EFSANE KART/);assert.ok(html.includes(photo.path)&&html.includes('Fotoğraf kaynağı ve lisansı'));assert.ok(!html.includes('FC 27'));
 }
 const html=playerCard(LEGENDS.find(p=>p.position==='ATT'));
 assert.ok(html.indexOf('Bitiricilik')<html.indexOf('Şut gücü')&&html.indexOf('Şut gücü')<html.indexOf('Kısa pas'));
 assert.ok(!playerCard({name:'Normal',overall:80,position:'ATT'}).includes('FC 27'));
});
test('every 3–6 seat market auctions exactly one legend with bonus on or off and preserves all capacities',async()=>{
 const data=await arenaData(),seen=new Set();
 for(let seats=3;seats<=6;seats++)for(let seed=1;seed<=100;seed++)for(const bonusEnabled of [false,true]){
  const rng=random(Math.imul(seed,2654435761)>>>0),market=makeMarket(data.players,data.coaches,seats,rng,{bonusEnabled});
  const legends=market.players.filter(p=>p.legend);assert.equal(legends.length,1);seen.add(legends[0].id);
  assert.equal(market.players.length,seats*7);assert.equal(market.players.filter(p=>p.bonus).length,Number(bonusEnabled));
  assert.deepEqual([[70,75],[76,81],[82,87],[88,100]].map(([lo,hi])=>market.players.filter(p=>p.overall>=lo&&p.overall<=hi).length),[seats,seats,seats*3,seats*2]);
  const teams=Array.from({length:seats},(_,i)=>({id:'t'+i,balance:200,players:[],coach:null}));completePool(teams,market.players,rng);completePool(teams,market.coaches,rng);
  assert.equal(teams.flatMap(t=>t.players).filter(p=>p.legend).length,1);
  for(const t of teams){assert.equal(t.balance,192);for(const [role,count]of Object.entries(LIMITS))assert.equal(t.players.filter(p=>p.position===role).length,count);}
 }
 assert.equal(seen.size,15);
});
const attributes=Object.fromEntries(Object.keys(ATTRIBUTES).map(k=>[k,80]));
const team=id=>({id,players:['GK','DEF','DEF','MID','MID','ATT','ATT'].map((position,i)=>({id:id+i,name:id+i,position,overall:80,attributes:{...attributes}}))});
const plans=[{...DEFAULT_PLAN,captainId:'a0'},{...DEFAULT_PLAN,captainId:'b0'}];
test('shot power changes actual shot xG with a 25% weight while legacy matches retain their first-half model',()=>{
 const low=beginMatch(team('a'),team('b'),139),high=structuredClone(low);
 low.teams[0].players[6].attributes.shotPower=40;
 const a=simulateHalf(low,plans),b=simulateHalf(high,plans);
 assert.equal(a.events[0].playerId,'a6');assert.equal(a.events[0].minute,b.events[0].minute);
 assert.ok(Math.abs(b.events[0].xg-a.events[0].xg-.03)<1e-10);
 low.version=1;high.version=1;
 assert.deepEqual(simulateHalf(low,plans).events,simulateHalf(high,plans).events);
});
test('sprint uses active outfield average, excludes goalkeeper and dismissal, is bounded and improves real progression',()=>{
 const t=beginMatch(team('a'),team('b'),1).teams[0];
 assert.equal(teamSprint(t),80);t.players[0].attributes.sprintSpeed=1;assert.equal(teamSprint(t),80);
 t.players[6].red=true;t.players[6].attributes.sprintSpeed=1;assert.equal(teamSprint(t),80);
 const opponent=beginMatch(team('a'),team('b'),1).teams[1];
 for(const p of t.players)p.attributes.sprintSpeed=90;assert.ok(Math.abs(sprintAdvantage(t,opponent)-.02)<1e-10);
 for(const p of t.players)p.attributes.sprintSpeed=99;for(const p of opponent.players)p.attributes.sprintSpeed=1;
 assert.equal(sprintAdvantage(t,opponent),.06);assert.equal(sprintAdvantage(opponent,t),-.06);
 let fastShots=0,slowShots=0;
 for(let seed=1;seed<=300;seed++){
  const fast=team('a'),slow=team('a');for(const p of fast.players)p.attributes.sprintSpeed=95;for(const p of slow.players)p.attributes.sprintSpeed=60;
  fastShots+=simulateHalf(beginMatch(fast,team('b'),seed),plans).teams[0].shots;
  slowShots+=simulateHalf(beginMatch(slow,team('b'),seed),plans).teams[0].shots;
 }
 assert.ok(fastShots>slowShots,`${fastShots} fast vs ${slowShots} slow`);
});
