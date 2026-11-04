import test from 'node:test';import assert from 'node:assert/strict';
import {createRoom,command,publicView} from '../server/transfer-arena/room.js';
import {arenaData} from '../server/transfer-arena/data.js';
import {DEFAULT_PLAN,beginMatch,simulateHalf,resolveFinal,shape} from '../server/transfer-arena/simulation.js';
import {assignFormation} from '../dist/games/transfer-arenasi/formation.js';
import {minuteLabel,pitch} from '../dist/games/transfer-arenasi/pitch.js';
let seq=0;const act=(r,uid,type,now,data,extra={})=>command(r,uid,{type,requestId:String(++seq),...extra},now,data);
async function setup(){const data=await arenaData();let r=createRoom('123456','a','A',9871,0);for(const id of ['b','c'])r=act(r,id,'join',1,data,{name:id});for(const id of ['a','b','c'])r=act(r,id,'ready',2,data);r=act(r,'a','start',3,data);return {r,data};}
test('simultaneous sealed offers stay private, can be revised, settle at the deadline and reveal all offers',async()=>{
 let {r,data}=await setup();const lotId=r.lot.id,deadline=r.lot.deadline;
 r=act(r,'a','bid',4,data,{lotId,amount:20});r=act(r,'b','bid',5,data,{lotId,amount:24});r=act(r,'a','bid',6,data,{lotId,amount:25});
 for(const uid of ['a','b','c']){const v=publicView(r,uid,7);assert.ok(!('bids'in v.lot)&&!('tieOrder'in v.lot));assert.equal(v.lot.bidder,null);assert.equal(v.lot.amount,0);assert.equal(v.lot.myBid,uid==='a'?25:uid==='b'?24:null);}
 assert.equal(r.lot.deadline,deadline);r=act(r,'c','pass',7,data,{lotId});assert.equal(r.lot.id,lotId);
 r=act(r,'c','poll',deadline,data);assert.equal(r.history[0].bidder,'a');assert.equal(r.history[0].amount,25);assert.equal(r.history[0].offers.length,2);assert.equal(r.teams[0].balance,175);
 assert.throws(()=>act(r,'b','bid',deadline+1,data,{lotId,amount:99}),/ihale/i);
});
test('equal highest offers use the predetermined draw regardless of request order; all passes wait for deadline',async()=>{
 const {r,data}=await setup(),lotId=r.lot.id;let a=r,b=r;
 for(const uid of ['a','b'])a=act(a,uid,'bid',4,data,{lotId,amount:10});for(const uid of ['b','a'])b=act(b,uid,'bid',4,data,{lotId,amount:10});
 a=act(a,'c','poll',r.lot.deadline,data);b=act(b,'c','poll',r.lot.deadline,data);assert.equal(a.history[0].bidder,b.history[0].bidder);assert.ok(a.history[0].tied);
 let empty=r;for(const uid of ['a','b','c'])empty=act(empty,uid,'pass',4,data,{lotId});assert.equal(empty.lot.id,lotId);
});
test('auction ends with visible allocations and an all-team squad review, including the bye team',async()=>{
 let {r,data}=await setup();while(['players','coaches'].includes(r.phase))r=act(r,'a','poll',r.lot.deadline,data);
 assert.equal(r.phase,'squadReview');assert.equal(r.assignments.length,24);assert.ok(r.assignments.every(a=>a.team&&a.amount===1));
 for(const uid of ['a','b','c'])r=act(r,uid,'plan',r.deadline-1,data,{phaseVersion:r.phaseVersion,plan:DEFAULT_PLAN});
 assert.equal(r.phase,'prepare');assert.equal(Object.keys(r.lastPlans).length,3);
});
test('90-minute shared clock changes speed continuously without revealing future goals or cards',async()=>{
 let {r,data}=await setup();while(['players','coaches','squadReview','prepare'].includes(r.phase))r=act(r,'a','poll',r.lot?.deadline||r.deadline,data);
 const start=r.playbackStart;assert.equal(r.matches[0].minute,45);assert.equal(publicView(r,'a',start+10000).matches[0].minute,10);
 assert.throws(()=>act(r,'b','speed',start+10000,data,{speed:4}),/hız/);
 r=act(r,'a','speed',start+10000,data,{speed:4});assert.equal(publicView(r,'b',start+10000).matches[0].minute,10);assert.equal(publicView(r,'b',start+15000).matches[0].minute,30);
 assert.ok(publicView(r,'a',start+15000).matches.every(m=>m.events.every(e=>e.minute<=30)));
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
