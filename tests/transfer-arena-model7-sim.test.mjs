// Model 7 birim testleri: model 6 birebir koruması, tarz üstünlüğü, hoca uyumu ve uzmanlık katsayısı.
// Model 6 altın kaydını bilinçli bir değişiklikte yenilemek için: ARENA_GOLDEN_UPDATE=1 node --test tests/transfer-arena-model7-sim.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync} from 'node:fs';
import {beginMatch, simulateSegment, DEFAULT_PLAN} from '../server/transfer-arena/simulation.js';
import {arenaData} from '../server/transfer-arena/data.js';
import {makeMarket, random, shuffle} from '../server/transfer-arena/market.js';
import {COACHES} from '../server/transfer-arena/coaches.js';
import {STYLE_EDGE,COACH_SPECIALTY_PER_STAR,COACH_FIT_PER_STAR} from '../dist/games/transfer-arenasi/tactic-presets.js';

const FIXTURE=new URL('./fixtures/arena-model6-golden.json',import.meta.url);
const FORMS=['2-2-2','2-3-1','3-2-1','1-3-2'],STYLES=['short','wide','direct','counter'];
function makeTeams(data,next){
 const pick=a=>a[Math.floor(next()*a.length)];
 const formations=[pick(FORMS),pick(FORMS)];
 const market=makeMarket(data.players,COACHES,3,next,{formations:[...formations,'2-2-2']});
 const pool=shuffle(market.players,next);
 return formations.map((formation,i)=>{
  const [D,M,A]=formation.split('-').map(Number),need={GK:1,DEF:D,MID:M,ATT:A},players=[];
  for(const role of Object.keys(need))for(let k=0;k<need[role];k++){const j=pool.findIndex(p=>p.position===role);if(j>=0)players.push(pool.splice(j,1)[0]);}
  return {id:'t'+i,players,coach:market.coaches[i],formation};
 });
}
const makePlan=(team,next)=>({...DEFAULT_PLAN,formation:team.formation,style:STYLES[Math.floor(next()*4)],press:Math.floor(next()*3),risk:Math.floor(next()*3),tempo:Math.floor(next()*3),width:Math.floor(next()*3),tackle:Math.floor(next()*4)});
const play=(teams,plans,seed,version)=>{let m=beginMatch(teams[0],teams[1],seed,seed%3,{version,neutral:true});for(const [start,end] of [[0,45],[45,70],[70,90]]){if(m.finished)break;m=simulateSegment(m,plans,{start,end});}return m;};
const digest=m=>createHash('sha256').update(JSON.stringify({events:m.events,score:m.teams.map(t=>t.goals),forfeit:m.forfeit||null})).digest('hex');

test('model 6 maçları birebir aynı sonucu verir (altın kayıt)',async()=>{
 const data=await arenaData(),next=random(777),out=[];
 for(let i=0;i<20;i++){const teams=makeTeams(data,next),plans=teams.map(t=>makePlan(t,next));out.push(digest(play(teams,plans,9000+i,6)));}
 if(process.env.ARENA_GOLDEN_UPDATE){writeFileSync(FIXTURE,JSON.stringify(out,null,1)+'\n');return;}
 assert.deepEqual(out,JSON.parse(readFileSync(FIXTURE,'utf8')));
});

const coachTeam=(team,specialty,stars=5)=>({...team,coach:{id:'c'+specialty,name:'Hoca',stars,specialty}});
async function pair(next){const data=await arenaData();return makeTeams(data,next);}

test('model 7: hoca uyumu her dilimde yeniden hesaplanır ve dilim görüntüsüne yazılır; model 6 alan eklemez',async()=>{
 const next=random(5),[a,b]=await pair(next);
 const teams=[coachTeam(a,'press'),coachTeam(b,'press')];
 const fitPlan={...DEFAULT_PLAN,formation:a.formation,press:2},noFit={...DEFAULT_PLAN,formation:b.formation,press:1};
 let m=beginMatch(teams[0],teams[1],42,1,{version:7,neutral:true});
 m=simulateSegment(m,[fitPlan,noFit],{start:0,end:45});
 assert.deepEqual(m.snapshots.at(-1).teams.map(t=>t.coachFit),[true,false]);
 const boost=side=>m.teams[side].players[0].coachBoost;
 assert.ok(boost(0)>boost(1),'uyumlu takımın çarpanı daha büyük');
 assert.ok(Math.abs(boost(0)-boost(1)-5*COACH_FIT_PER_STAR)<1e-9);
 // Devre arasında plan değişirse uyum da değişir.
 m=simulateSegment(m,[noFit,fitPlan],{start:45,end:70});
 assert.deepEqual(m.snapshots.at(-1).teams.map(t=>t.coachFit),[false,true]);
 let old=beginMatch(teams[0],teams[1],42,1,{version:6,neutral:true});
 old=simulateSegment(old,[fitPlan,noFit],{start:0,end:45});
 assert.ok(old.snapshots.at(-1).teams.every(t=>!('coachFit' in t)));
 assert.equal(old.teams[0].specialtyStar,undefined);
 assert.equal(m.teams[0].specialtyStar,COACH_SPECIALTY_PER_STAR);
});

test('model 7: uzmanlık katsayısı yıldız başına COACH_SPECIALTY_PER_STAR; hoca yoksa uyum yok',async()=>{
 const [a,b]=await pair(random(6));
 const plan=p=>({...DEFAULT_PLAN,formation:p.formation});
 let m=beginMatch({...a,coach:null},{...b,coach:null},7,1,{version:7,neutral:true});
 m=simulateSegment(m,[plan(a),plan(b)],{start:0,end:45});
 assert.deepEqual(m.snapshots.at(-1).teams.map(t=>t.coachFit),[false,false]);
 assert.equal(m.teams[0].players[0].coachBoost,0);
});

test('model 7: tarz üstünlüğü yalnız model 7 sonuçlarını değiştirir ve üstün tarafı kayırır',async()=>{
 const data=await arenaData(),next=random(99);
 let adv=0,dis=0,diffV6=0;
 for(let i=0;i<150;i++){
  const [a,b]=makeTeams(data,next),sl={press:1,risk:1,tempo:1,width:1,tackle:1};
  const pa={...DEFAULT_PLAN,...sl,formation:a.formation,style:'counter'},pbBeaten={...DEFAULT_PLAN,...sl,formation:b.formation,style:'short'},pbBeats={...DEFAULT_PLAN,...sl,formation:b.formation,style:'direct'};
  const goalDiff=(m)=>m.teams[0].goals-m.teams[1].goals;
  adv+=goalDiff(play([a,b],[pa,pbBeaten],5000+i,7));
  dis+=goalDiff(play([a,b],[pa,pbBeats],5000+i,7));
  // Model 6'da aynı eşleşmenin kaydı değişmez: edge yok, sürüm 6 yolu kendi başına deterministik.
  diffV6+=JSON.stringify(play([a,b],[pa,pbBeaten],5000+i,6).events)===JSON.stringify(play([a,b],[pa,pbBeaten],5000+i,6).events)?0:1;
 }
 assert.ok(adv-dis>20,`üstün ${adv} zayıf ${dis}`);
 assert.equal(diffV6,0);
});
