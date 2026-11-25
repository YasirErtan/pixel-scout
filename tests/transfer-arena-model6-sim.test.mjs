// Model 6 parçalı maç simülasyonu birim testleri (ağa çıkmaz, yalnız yapay kadro kullanır).
import test from 'node:test';
import assert from 'node:assert/strict';
import {beginMatch,simulateHalf,simulateSegment,allInEligible,finishFinal,DEFAULT_PLAN,ALL_IN_LOCKS} from '../server/transfer-arena/simulation.js';

const KEYS=['finishing','positioning','composure','shotPower','vision','shortPassing','ballControl','defensiveAwareness','interceptions','standingTackle','stamina','sprintSpeed','gkDiving','gkHandling','gkPositioning','gkReflexes','penalties'];
const ROLES=[['GK','GK'],['DEF','CB'],['DEF','RB'],['MID','CM'],['MID','CAM'],['ATT','ST'],['ATT','LW']];
function team(id,base=80){
 return {id,coach:{stars:3,specialty:'attack'},players:ROLES.map(([position,detailPosition],i)=>({
  id:id+i,name:id+i,position,detailPosition,overall:base,
  attributes:Object.fromEntries(KEYS.map(k=>[k,k.startsWith('gk')?(position==='GK'?base:10):base]))
 }))};
}
const plans=[DEFAULT_PLAN,{...DEFAULT_PLAN,style:'wide',width:2,risk:2}];
const SLICES=[[0,45],[45,70],[70,90]];
function play(seed,{allIn=[false,false],a=80,b=80}={}){
 let m=beginMatch(team('a',a),team('b',b),seed,1,{version:6,neutral:true});
 for(const [start,end] of SLICES){if(m.finished)break;m=simulateSegment(m,plans,{start,end,allIn:start===70?allIn:[false,false]});}
 return m;
}
const STAT_KEYS=['passes','completed','keyPasses','shots','onTarget','goals','assists','tackles','interceptions','fouls','saves','minutes'];

test('dilimler sırayla çalışır, geçmişi korur ve her dilim sonunda anlık istatistik ekler',()=>{
 for(let seed=1;seed<=30;seed++){
  let m=beginMatch(team('a'),team('b'),seed,1,{version:6,neutral:true});

  for(const [start,end] of SLICES){
   if(m.finished)break;
   const before=m.events.length,prev=m.events;
   m=simulateSegment(m,plans,{start,end});
   assert.deepEqual(m.events.slice(0,before),prev);
   for(const e of m.events.slice(before))if(e.type!=='allIn')assert.ok(e.minute>start&&e.minute<=end,`${e.type} ${e.minute} ${start}-${end}`);
   assert.equal(m.minute,end);assert.equal(m.snapshots.at(-1).minute,end);
   assert.equal(m.finished,end===90||!!m.forfeit);

  }
  if(!m.forfeit){assert.deepEqual(m.snapshots.map(s=>s.minute),[45,70,90]);assert.equal(m.half,2);}
  assert.throws(()=>simulateSegment(m,plans,{start:70,end:90}));
 }
 assert.throws(()=>simulateSegment(beginMatch(team('a'),team('b'),1,1,{version:5}),plans,{start:0,end:45}));
});

test('aynı tohum aynı maçı, farklı tohum farklı maçı üretir',()=>{
 for(let seed=1;seed<=10;seed++){assert.deepEqual(play(seed),play(seed));assert.deepEqual(play(seed,{allIn:[true,true]}),play(seed,{allIn:[true,true]}));}
 assert.notDeepEqual(play(1).events,play(2).events);
});

test('"Tüm riskleri al!" yalnız kilitte geride/berabere olana uygulanır; önde olan seçse de etkisizdir',()=>{
 let leader=0,trailer=0,level=0;
 for(let seed=1;seed<=200&&(leader<3||trailer<3||level<3);seed++){
  let m=beginMatch(team('a'),team('b'),seed,1,{version:6,neutral:true});
  m=simulateSegment(m,plans,{start:0,end:45});if(m.finished)continue;
  // Kilit dakikası olmayan dilimde seçim yok sayılır.
  const ignored=simulateSegment(m,plans,{start:45,end:70,allIn:[true,true]});
  assert.deepEqual(ignored,simulateSegment(m,plans,{start:45,end:70}));
  assert.ok(!ignored.events.some(e=>e.type==='allIn'));
  m=ignored;if(m.finished)continue;
  const [ga,gb]=m.teams.map(t=>t.goals),plain=simulateSegment(m,plans,{start:70,end:90});
  for(let side=0;side<2;side++){
   const flags=[side===0,side===1],chosen=simulateSegment(m,plans,{start:70,end:90,allIn:flags});
   const lead=m.teams[side].goals-m.teams[1-side].goals;
   assert.equal(allInEligible(m,side),lead<=0);
   if(lead>0){leader++;assert.deepEqual(chosen,plain);assert.equal(chosen.teams[side].allIn,false);}
   else{
    lead<0?trailer++:level++;
    const event=chosen.events.find(e=>e.type==='allIn');
    assert.deepEqual(event,{minute:70,type:'allIn',team:m.teams[side].id});
    assert.equal(chosen.teams[side].allIn,true);assert.equal(chosen.snapshots.at(-1).teams[side].allIn,true);
    assert.equal(chosen.teams[1-side].allIn,false);
   }
  }
  if(ga===gb){const both=simulateSegment(m,plans,{start:70,end:90,allIn:[true,true]});assert.equal(both.events.filter(e=>e.type==='allIn').length,2);}
 }
 assert.ok(leader>=3&&trailer>=3&&level>=3,`önde ${leader}, geride ${trailer}, berabere ${level}`);
 assert.deepEqual([...ALL_IN_LOCKS],[70,105]);
});

test('seçen takım enerjisini daha hızlı harcar ve daha çok şut atar',()=>{
 let energy=0,shots=0,n=0;
 for(let seed=1;seed<=120;seed++){
  let m=beginMatch(team('a'),team('b'),seed,1,{version:6,neutral:true});
  m=simulateSegment(simulateSegment(m,plans,{start:0,end:45}),plans,{start:45,end:70});
  if(m.finished||!allInEligible(m,0))continue;
  const yes=simulateSegment(m,plans,{start:70,end:90,allIn:[true,false]}),no=simulateSegment(m,plans,{start:70,end:90});
  const avg=x=>x.teams[0].players.reduce((s,p)=>s+p.energy,0)/7;
  energy+=avg(no)-avg(yes);shots+=(yes.teams[0].shots-m.teams[0].shots)-(no.teams[0].shots-m.teams[0].shots);n++;
 }
 assert.ok(n>20);assert.ok(energy/n>0,'enerji');assert.ok(shots/n>0,'şut');
});

test('yeni olay alanları: direk, büyük fırsat ve duran toplar yalnız model 6’da üretilir',()=>{
 const found={post:0,big:0,penalty:0,freeKick:0,corner:0,assist:0,solo:0};
 for(let seed=1;seed<=150;seed++){
  const m=play(seed,{allIn:[true,true]});
  for(const e of m.events){
   if(!['goal','shot','save','post'].includes(e.type)){assert.equal(e.big,undefined);assert.equal(e.setPiece,undefined);continue;}
   assert.ok(Number.isFinite(e.xg)&&e.xg>0&&e.xg<1);
   assert.equal(e.big===true,e.xg>=.3,`big/xg ${e.xg}`);
   if(e.big)found.big++;
   if(e.type==='post')found.post++;
   if(e.setPiece){assert.ok(['penalty','freeKick','corner'].includes(e.setPiece));found[e.setPiece]++;}
   assert.equal(e.penalty,e.setPiece==='penalty');
   if(e.type==='goal'){
    if(e.assisterId!=null){found.assist++;assert.notEqual(e.assisterId,e.playerId);assert.ok(!['penalty','freeKick'].includes(e.setPiece));}
    else found.solo++;
   }
  }
 }
 for(const [k,v] of Object.entries(found))assert.ok(v>0,`${k} üretilmedi`);
 // Model 5 yeni olay ve alan üretmez.
 for(let seed=1;seed<=40;seed++){
  const m5=beginMatch(team('a'),team('b'),seed,1,{version:5});
  assert.equal(m5.teams[0].possessionTicks,undefined);assert.equal(m5.teams[0].players[0].stats,undefined);
  const done=simulateHalf(simulateHalf(m5,plans),plans);
  assert.ok(!done.events.some(e=>e.type==='post'||e.type==='allIn'||'big' in e||'setPiece' in e));
  assert.equal(done.snapshots,undefined);
 }
});

test('istatistikler tutarlı: şut ≥ isabetli ≥ gol, isabetli = gol + rakip kurtarış, pas ≥ başarılı pas',()=>{
 for(let seed=1;seed<=80;seed++){
  const m=play(seed,{allIn:[seed%2===0,seed%3===0],a:seed%4?80:86});
  if(m.forfeit)continue;
  const ticks=m.teams[0].possessionTicks+m.teams[1].possessionTicks;
  assert.equal(ticks,120+67+53);
  for(let i=0;i<2;i++){
   const t=m.teams[i],opp=m.teams[1-i],sum=k=>t.players.reduce((s,p)=>s+p.stats[k],0);
   for(const p of t.players){
    assert.deepEqual(Object.keys(p.stats).toSorted(),STAT_KEYS.toSorted());
    const s=p.stats;
    assert.ok(s.shots>=s.onTarget&&s.onTarget>=s.goals,'oyuncu şut');
    assert.ok(s.passes>=s.completed,'oyuncu pas');
    assert.ok(s.keyPasses>=s.assists,'kilit pas');
    assert.equal(s.minutes,p.red?Math.round(p.redMinute):90);
   }
   assert.ok(t.shots>=t.onTarget&&t.onTarget>=t.goals);
   assert.equal(t.onTarget,t.goals+opp.saves);
   assert.ok(t.passes>=t.completed);
   for(const k of ['shots','onTarget','goals','passes','completed'])assert.equal(sum(k),t[k],k);
   assert.equal(sum('saves'),t.saves);
   assert.equal(t.goals,m.events.filter(e=>e.type==='goal'&&e.team===t.id).length);
   assert.equal(t.shots,m.events.filter(e=>['goal','shot','save','post'].includes(e.type)&&e.team===t.id).length);
   assert.equal(sum('assists'),m.events.filter(e=>e.type==='goal'&&e.team===t.id&&e.assisterId!=null).length);
   assert.equal(sum('fouls'),m.events.filter(e=>['foul','yellow','red'].includes(e.type)&&e.team===t.id).length);
   // Rakibin top kapma ve araya girmeleri bu takımın top kayıplarıdır.
   assert.equal(opp.players.reduce((s,p)=>s+p.stats.tackles+p.stats.interceptions,0),t.losses);
   // Son anlık kayıt maç sonu sayaçlarını taşır ve bir kopyadır.
   const snap=m.snapshots.at(-1).teams[i];
   assert.equal(snap.possessionTicks,t.possessionTicks);assert.equal(snap.goals,t.goals);
   for(const p of t.players)assert.deepEqual(snap.players[p.id],p.stats);
   assert.notEqual(snap.players[t.players[0].id],t.players[0].stats);
  }
  // Anlık kayıtlar zamanla azalmaz.
  for(let k=1;k<m.snapshots.length;k++)for(let i=0;i<2;i++)assert.ok(m.snapshots[k].teams[i].passes>=m.snapshots[k-1].teams[i].passes);
 }
});

test('final uzatması 90–105 ve 105–120 dilimleriyle oynanır; 105 kilidi çalışır ve kazanan yazılır',()=>{
 let tested=0;
 for(let seed=1;seed<=200&&tested<5;seed++){
  const m=play(seed);if(m.forfeit||m.teams[0].goals!==m.teams[1].goals)continue;
  tested++;
  let x=simulateSegment(m,plans,{start:90,end:105});
  assert.equal(x.finished,false);assert.ok(x.events.some(e=>e.type==='extraTime'&&e.minute===90));
  if(!x.finished){
   const behind=x.teams[0].goals<=x.teams[1].goals?0:1;
   x=simulateSegment(x,plans,{start:105,end:120,allIn:[behind===0,behind===1]});
   assert.ok(x.events.some(e=>e.type==='allIn'&&e.minute===105));
  }
  assert.equal(x.finished,true);assert.deepEqual(x.snapshots.map(s=>s.minute),[45,70,90,105,120]);
  for(const t of x.teams)for(const p of t.players)if(!p.red)assert.equal(p.stats.minutes,120);
  const done=finishFinal(x);assert.ok(['a','b'].includes(done.winner));
  assert.deepEqual(done,finishFinal(x));
 }
 assert.ok(tested>0);
});
