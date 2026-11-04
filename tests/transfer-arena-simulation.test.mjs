import test from 'node:test';
import assert from 'node:assert/strict';
import {beginMatch,simulateHalf,fixtures,DEFAULT_PLAN,validatePlan} from '../server/transfer-arena/simulation.js';
const attributes=Object.fromEntries(['finishing','shotPower','sprintSpeed','vision','shortPassing','ballControl','defensiveAwareness','interceptions','standingTackle','stamina','gkReflexes','gkPositioning','penalties'].map(k=>[k,80]));
const team=id=>({id,players:['GK','DEF','DEF','MID','MID','ATT','ATT'].map((position,i)=>({id:id+i,name:id+i,position,attributes}))});
test('round robin visits each pair once without double-booking, for 3–6 seats',()=>{for(let n=3;n<=6;n++){const rounds=fixtures(Array.from({length:n},(_,i)=>i));const all=rounds.flat();assert.equal(all.length,n*(n-1)/2);assert.equal(new Set(all.map(p=>p.toSorted().join('-'))).size,all.length);for(const r of rounds)assert.equal(new Set(r.flat()).size,r.flat().length);}});
test('halftime preserves history, same seed is reproducible, shots and goals conserve events',()=>{for(let seed=1;seed<50;seed++){const start=beginMatch(team('a'),team('b'),seed);const half=simulateHalf(start,[DEFAULT_PLAN,DEFAULT_PLAN]);assert.deepEqual(half,simulateHalf(start,[DEFAULT_PLAN,DEFAULT_PLAN]));const second=simulateHalf(half,[{...DEFAULT_PLAN,tempo:2,tackle:3},DEFAULT_PLAN]);assert.deepEqual(second.events.slice(0,half.events.length),half.events);assert.equal(start.minute,0);if(!second.forfeit)for(let i=0;i<2;i++){const t=second.teams[i];assert.ok(t.shots>=t.onTarget&&t.onTarget>=t.goals);assert.equal(second.teams[1-i].saves,t.onTarget-t.goals);assert.equal(t.goals,second.events.filter(e=>e.type==='goal'&&e.team===t.id).length);}assert.throws(()=>simulateHalf(second,[DEFAULT_PLAN,DEFAULT_PLAN]));}});
test('client cannot submit unknown tactical settings',()=>{assert.throws(()=>validatePlan({tackle:9}));assert.throws(()=>validatePlan({style:'cheat'}));});

test('tied finals carry discipline into extra time and settle reproducibly without shootout goals entering score',async()=>{
 const {resolveFinal}=await import('../server/transfer-arena/simulation.js');
 let penalties=0;
 for(let seed=1;seed<=80;seed++){
  const start=beginMatch(team('a'),team('b'),seed);start.half=2;start.finished=true;start.minute=20;
  start.teams[0].players[6].red=true;start.teams[0].players[6].yellow=2;
  start.events=[{type:'red',minute:19,team:'a',playerId:'a6'}];
  const final=resolveFinal(start,[DEFAULT_PLAN,DEFAULT_PLAN]);
  assert.deepEqual(final,resolveFinal(start,[DEFAULT_PLAN,DEFAULT_PLAN]));
  assert.ok(final.finished);assert.ok(['a','b'].includes(final.winner));
  assert.equal(final.teams[0].players[6].red,true);assert.equal(start.events.length,1);
  assert.deepEqual(final.events[0],start.events[0]);
  for(const t of final.teams)assert.equal(t.goals,final.events.filter(e=>e.type==='goal'&&e.team===t.id).length);
  if(final.shootout){penalties++;assert.notEqual(...final.shootout.score);assert.equal(final.shootout.winner,final.winner);assert.equal(final.teams[0].goals,final.teams[1].goals);assert.ok(!final.events.some(e=>e.type==='shootout'&&e.playerId==='a6'));}
 }
 assert.ok(penalties>0);assert.throws(()=>resolveFinal(beginMatch(team('a'),team('b'),1),[DEFAULT_PLAN,DEFAULT_PLAN]));
});
