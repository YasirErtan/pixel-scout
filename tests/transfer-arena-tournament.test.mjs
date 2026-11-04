import test from 'node:test';import assert from 'node:assert/strict';
import {createRoom,command,publicView} from '../server/transfer-arena/room.js';
import {arenaData} from '../server/transfer-arena/data.js';
test('complete 3–6 seat tournaments reach one champion, including offline deadlines',async()=>{
 const data=await arenaData();
 for(let count=3;count<=6;count++)for(let seed=1;seed<=8;seed++){
  let r=createRoom('123456','t0','Team0',seed,0,{bonusEnabled:seed%2===0}),now=0,seq=0;
  const act=(uid,type,extra={})=>{r=command(r,uid,{type,requestId:String(++seq),...extra},now,data);};
  for(let i=1;i<count;i++)act('t'+i,'join',{name:'Team'+i});
  for(const t of r.teams)act(t.id,'ready');act('t0','start');
  let steps=0;
  while(r.phase!=='finished'&&steps++<100){now=(r.lot&&['players','coaches'].includes(r.phase)?r.lot.deadline:r.deadline)+1;act('t0','poll');}
  assert.equal(r.phase,'finished');assert.ok(r.finalists.includes(r.champion));
  assert.equal(new Set(r.teams.flatMap(t=>t.players.map(p=>p.id))).size,count*7);
  assert.equal(r.teams.flatMap(t=>t.players).filter(p=>p.bonus).length,Number(seed%2===0));
  assert.ok(r.teams.every(t=>t.players.length===7&&t.coach&&t.balance===192));
  assert.equal(r.results.flat().length,count*(count-1)/2);
  const view=publicView(r,'t0',now);assert.ok(view.matches[0].score.every(Number.isInteger));
  assert.equal(view.champion,r.champion);assert.equal(view.matches[0].minute,r.matches[0].minute);
 }
});
