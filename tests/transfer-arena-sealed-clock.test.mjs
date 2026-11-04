import test from 'node:test';import assert from 'node:assert/strict';
import {createRoom,command,publicView} from '../server/transfer-arena/room.js';
import {arenaData} from '../server/transfer-arena/data.js';
import {DEFAULT_PLAN,beginMatch,simulateHalf,resolveFinal,shape} from '../server/transfer-arena/simulation.js';
import {assignFormation} from '../dist/games/transfer-arenasi/formation.js';
import {minuteLabel,pitch} from '../dist/games/transfer-arenasi/pitch.js';
let seq=0;const act=(r,uid,type,now,data,extra={})=>command(r,uid,{type,requestId:String(++seq),...extra},now,data);
async function setup(){const data=await arenaData();let r=createRoom('123456','a','A',9871,0);for(const id of ['b','c'])r=act(r,id,'join',1,data,{name:id});for(const id of ['a','b','c'])r=act(r,id,'ready',2,data);r=act(r,'a','start',3,data);return {r,data};}
test('auction ends with visible allocations and an all-team squad review, including the bye team',async()=>{
 let {r,data}=await setup();while(['players','coaches','auctionResult'].includes(r.phase))r=act(r,'a','poll',r.lot?.deadline||r.deadline,data);
 assert.equal(r.phase,'squadReview');assert.equal(r.assignments.length,24);assert.ok(r.assignments.every(a=>a.team&&a.amount===1));
 for(const uid of ['a','b','c'])r=act(r,uid,'plan',r.deadline-1,data,{phaseVersion:r.phaseVersion,plan:DEFAULT_PLAN});
 assert.equal(r.phase,'firstHalf');assert.equal(Object.keys(r.lastPlans).length,3);
});
test('90-minute shared clock changes speed continuously without revealing future goals or cards',async()=>{
 let {r,data}=await setup();while(['players','coaches','auctionResult','squadReview','prepare'].includes(r.phase))r=act(r,'a','poll',r.lot?.deadline||r.deadline,data);
 const start=r.playbackStart;assert.equal(r.matches[0].minute,45);assert.equal(publicView(r,'a',start+10000).matches[0].minute,15);
 assert.throws(()=>act(r,'b','speed',start+10000,data,{speed:4}),/hız/);
 r=act(r,'a','speed',start+10000,data,{speed:4});assert.equal(publicView(r,'b',start+10000).matches[0].minute,15);assert.equal(publicView(r,'b',start+12500).matches[0].minute,30);
 assert.ok(publicView(r,'a',start+12500).matches.every(m=>m.events.every(e=>e.minute<=30)));
 r=act(r,'a','poll',r.deadline,data);assert.equal(r.phase,'halftime');assert.equal(publicView(r,'a',r.deadline-1).matches[0].minute,45);
 r=act(r,'a','poll',r.deadline,data);assert.equal(r.phase,'secondHalf');assert.equal(r.matches[0].minute,90);
});
test('pitch uses the actual match assignments, escapes names, excludes dismissals and shows whole minutes',async()=>{
 const data=await arenaData();const players=['GK','DEF','DEF','MID','MID','ATT','ATT'].map((role,i)=>({...data.players.find(p=>p.position===role),id:'p'+i,name:i===6?'<img>':'Player'+i}));
 for(const formation of ['2-2-2','2-3-1','3-2-1','1-3-2']){
  const t={players:structuredClone(players)};shape(t,formation);assert.deepEqual(t.players.filter(p=>p.position!=='GK').map(p=>[p.id,p.matchRole,p.roleFit]),assignFormation(players.slice(1),formation).map(p=>[p.id,p.matchRole,p.roleFit]));
  assert.ok(pitch({name:'A',players},formation,'p5').includes('&lt;img&gt;'));
 }
 assert.ok(!pitch({name:'A',players},'2-2-2','p5',['p6']).includes('&lt;img&gt;'));
 assert.equal(minuteLabel(9.1),'10′');assert.equal(minuteLabel(45),'45′');assert.equal(minuteLabel(120.5,true),'Penaltı');
 const a={id:'a',players},b={id:'b',players:players.map(p=>({...p,id:'b'+p.id}))};let m=beginMatch(a,b,11);m=simulateHalf(m,[DEFAULT_PLAN,DEFAULT_PLAN]);assert.equal(m.minute,45);m=simulateHalf(m,[DEFAULT_PLAN,DEFAULT_PLAN]);assert.equal(m.minute,90);
 m.teams.forEach(t=>t.goals=0);const final=resolveFinal(m,[DEFAULT_PLAN,DEFAULT_PLAN]);assert.ok(final.minute>=120);
});
