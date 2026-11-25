// Model 6 oda akışı: dilimli ikinci yarı, "Tüm riskleri al!" komutu, gizlilik ve final uzatması.
import test from 'node:test';import assert from 'node:assert/strict';
import {createRoom,command,publicView} from '../server/transfer-arena/room.js';
import {arenaData} from '../server/transfer-arena/data.js';
import {DEFAULT_PLAN,beginMatch,simulateHalf,ALL_IN_WINDOW} from '../server/transfer-arena/simulation.js';
import {championEntry} from '../server/transfer-arena/champions.js';

const data=await arenaData();
let seq=0;
const act=(r,uid,type,now,extra={})=>command(r,uid,{type,requestId:'q'+(++seq),...extra},now,data);
// Oynatma saatinde belirli bir maç dakikasına karşılık gelen sunucu zamanı.
const timeAt=(r,minute)=>Math.ceil(r.playbackStart+(minute-r.playbackCursor)*1000/(1.5*r.playbackSpeed));
const scoreAt=(m,minute)=>m.teams.map(t=>m.events.filter(e=>e.type==='goal'&&e.team===t.id&&e.minute<=minute).length);
const playing=r=>r.matches[0].teams.map(t=>t.id);

function lobby(seed,version){
 let r=createRoom('123456','a','A',seed,0);
 for(const id of ['b','c'])r=act(r,id,'join',1,{name:id.toUpperCase()});
 if(version)r.rulesVersion=version;
 for(const id of ['a','b','c']){r=act(r,id,'formation',2,{formation:'2-2-2'});r=act(r,id,'ready',2);}
 return act(r,'a','start',3);
}
// Taktik aşamalarında herkes varsayılan planı kilitler; diğer aşamalar süre sonuna kadar beklenir.
function step(r){
 if(['players','coaches'].includes(r.phase))return act(r,'a','poll',r.lot.deadline);
 if(['squadReview','prepare','halftime'].includes(r.phase)){
  const ids=r.phase==='squadReview'?r.teams.map(t=>t.id):r.schedule&&(r.final?r.finalists:r.schedule[r.round].flat());
  const now=r.deadline-1000;for(const id of ids)r=act(r,id,'plan',now,{phaseVersion:r.phaseVersion,plan:DEFAULT_PLAN});return r;
 }
 return act(r,'a','poll',r.deadline);
}
function untilPhase(r,phase,{final=false}={}){
 for(let i=0;i<400&&!(r.phase===phase&&(!final||r.final));i++)r=step(r);
 assert.equal(r.phase,phase);return r;
}
// İlk haftanın ikinci yarısı başlamış v6 oda.
const secondHalf=seed=>untilPhase(lobby(seed),'secondHalf');
// 60–70 arasında görünen skoru eşit olmayan bir maç bulur (önde/geride senaryosu).
function unevenAt(minute){
 for(let seed=1;seed<200;seed++){const r=secondHalf(seed),m=r.matches[0],s=scoreAt(m,minute);if(!m.finished&&s[0]!==s[1]&&scoreAt(m,70).join()===s.join())return r;}
 throw Error('Uygun maç bulunamadı');
}

test('yeni odalar model 6 ile oynar; ikinci yarı 45–70 dilimiyle başlar ve düğme penceresi 60–70',()=>{
 let r=secondHalf(5);const m=r.matches[0],[home,away]=playing(r),bye=r.teams.map(t=>t.id).find(id=>!playing(r).includes(id));
 assert.equal(r.rulesVersion,6);assert.equal(m.version,6);assert.equal(m.minute,70);assert.equal(r.playbackEnd,90);
 assert.deepEqual(m.snapshots.map(s=>s.minute),[45,70]);assert.equal(ALL_IN_WINDOW,10);
 const early=publicView(r,home,timeAt(r,55));
 assert.deepEqual({...early.allIn,opensAt:0,locksAt:0},{lock:70,from:60,available:false,chosen:false,opensAt:0,locksAt:0});
 assert.equal(early.allIn.locksAt,timeAt(r,70));
 assert.equal(publicView(r,bye,timeAt(r,62)).allIn,null);
 assert.throws(()=>act(r,home,'allIn',timeAt(r,55),{phaseVersion:r.phaseVersion,lock:70}),/penceresi kapalı/);
 assert.throws(()=>act(r,bye,'allIn',timeAt(r,62),{phaseVersion:r.phaseVersion,lock:70}),/oynamıyorsun/);
 assert.throws(()=>act(r,home,'allIn',timeAt(r,62),{phaseVersion:r.phaseVersion,lock:105}),/süresi doldu/);
 assert.throws(()=>act(r,home,'allIn',timeAt(r,62),{phaseVersion:r.phaseVersion-1,lock:70}),/süresi doldu/);
 assert.ok(publicView(r,away,timeAt(r,62)).allIn.available||scoreAt(m,62)[1]>scoreAt(m,62)[0]);
});

test('önde olan takım reddedilir, geride olan kabul edilir; seçim geri alınmaz ve requestId idempotenttir',()=>{
 let r=unevenAt(62);const m=r.matches[0],s=scoreAt(m,62),leader=m.teams[s[0]>s[1]?0:1].id,trailer=m.teams[s[0]>s[1]?1:0].id,now=timeAt(r,62);
 assert.equal(publicView(r,leader,now).allIn.available,false);assert.equal(publicView(r,trailer,now).allIn.available,true);
 assert.throws(()=>act(r,leader,'allIn',now,{phaseVersion:r.phaseVersion,lock:70}),/Önde olan/);
 const action={type:'allIn',requestId:'tek-istek',phaseVersion:r.phaseVersion,lock:70};
 const once=command(r,trailer,action,now,data);
 assert.deepEqual(command(once,trailer,action,now+5,data),once);
 const again=act(once,trailer,'allIn',now+10,{phaseVersion:r.phaseVersion,lock:70});
 assert.deepEqual(again.allInPicks[70],[trailer]);
 const view=publicView(again,trailer,now+10);assert.equal(view.allIn.chosen,true);assert.equal(view.allIn.available,false);
 // Kilitte gerçek skorla uygunsa olay 70. dakikada görünür; maç 90'a kadar hesaplanır.
 const locked=act(again,'a','poll',timeAt(again,70.5));
 assert.equal(locked.matches[0].minute,90);
 assert.deepEqual(locked.matches[0].events.filter(e=>e.type==='allIn').map(e=>[e.minute,e.team]),[[70,trailer]]);
 assert.throws(()=>act(locked,trailer,'allIn',timeAt(locked,71),{phaseVersion:locked.phaseVersion,lock:70}),/süresi doldu/);
});

test('kesin uygunluk kilitte belirlenir: önde biten takımın seçimi uygulanmaz',()=>{
 let r=unevenAt(62);const s=scoreAt(r.matches[0],70),leader=r.matches[0].teams[s[0]>s[1]?0:1].id;
 r.allInPicks={70:[leader]};
 r=act(r,'a','poll',timeAt(r,70));
 assert.equal(r.matches[0].events.some(e=>e.type==='allIn'),false);
 assert.equal(r.matches[0].teams.find(t=>t.id===leader).allIn,false);
});

test('rakibin seçimi ve gelecek olay/istatistikler publicView içinde görünmez',()=>{
 let r=secondHalf(7);const [home,away]=playing(r),m=r.matches[0],now=timeAt(r,63);
 const s=scoreAt(m,63),picker=s[0]<=s[1]?home:away,other=picker===home?away:home;
 const before=publicView(r,other,now);
 r=act(r,picker,'allIn',now,{phaseVersion:r.phaseVersion,lock:70});
 const after=publicView(r,other,now);
 assert.deepEqual({...after,version:0},{...before,version:0});
 const text=JSON.stringify(after);
 assert.ok(!text.includes('allInPicks')&&!text.includes('nextSegment'));
 for(const match of after.matches){
  // Kadro alanı yalnız dört statik alan taşır; canlı kart/enerji/istatistik sızmaz.
  for(const team of match.teams){
   assert.equal(team.players.length,7);
   for(const p of team.players)assert.deepEqual(Object.keys(p).sort(),['detailPosition','id','name','position']);
  }
  assert.ok(match.events.every(e=>e.minute<=63));assert.ok(match.events.every(e=>e.type!=='allIn'));
  assert.deepEqual(match.snapshots.map(x=>x.minute),[45]);
 }
 // Sunucuda 63–70 arası olaylar ve 70 istatistiği var; görünümde yok.
 assert.ok(r.matches[0].snapshots.some(x=>x.minute===70));
 assert.ok(!text.includes('"minute":70,"teams"'));
 const later=publicView(act(r,'a','poll',timeAt(r,75)),other,timeAt(r,75));
 assert.deepEqual(later.matches[0].snapshots.map(x=>x.minute),[45,70]);
 assert.ok(later.matches[0].events.every(e=>e.minute<=75));
 const pickedEvent=later.matches[0].events.find(e=>e.type==='allIn');
 if(pickedEvent)assert.equal(pickedEvent.team,picker);
});

test('70 dilimi oynatmayı durdurmaz; 8× hız ve tam sınırda hız değişimi aynı sonucu verir',()=>{
 const base=secondHalf(11);
 // Referans: hiç yoklama olmadan süre sonunda tek seferde.
 const reference=act(base,'a','poll',base.deadline);
 assert.notEqual(reference.phase,'secondHalf');
 // 70'te hesaplanır; faz, faz sürümü, imleç ve bitiş zamanı değişmez.
 let r=act(base,'a','poll',timeAt(base,70));
 assert.equal(r.phase,'secondHalf');assert.equal(r.phaseVersion,base.phaseVersion);
 assert.equal(r.playbackStart,base.playbackStart);assert.equal(r.playbackCursor,45);assert.equal(r.deadline,base.deadline);
 assert.equal(r.matches[0].minute,90);assert.equal(r.nextSegment,null);
 assert.ok(publicView(r,'a',timeAt(base,70)).matches[0].minute>=70);
 assert.ok(publicView(r,'a',timeAt(base,71)).matches[0].minute<72);
 // 8× hızda 50'den sonra, ardından tam 70. dakikada 2×'e geçiş.
 let fast=act(base,'a','speed',timeAt(base,50),{speed:8});
 assert.equal(fast.matches[0].minute,70);
 const boundary=timeAt(fast,70);
 fast=act(fast,'a','speed',boundary,{speed:2});
 assert.equal(fast.matches[0].minute,90);assert.equal(fast.phase,'secondHalf');
 assert.ok(fast.playbackCursor>=70&&fast.playbackCursor-70<0.02);
 assert.ok(Math.abs(fast.deadline-(boundary+(90-fast.playbackCursor)*1000/3))<1e-6);
 assert.deepEqual(fast.matches,r.matches);
 fast=act(fast,'a','poll',fast.deadline);
 assert.deepEqual(fast.results,reference.results);assert.equal(fast.phase,reference.phase);
 // Pencerede 8× hızda seçim de kabul edilir.
 let quick=act(base,'a','speed',timeAt(base,46),{speed:8});const m=quick.matches[0],t=timeAt(quick,61),s=scoreAt(m,61),side=s[0]<=s[1]?0:1;
 quick=act(quick,m.teams[side].id,'allIn',t,{phaseVersion:quick.phaseVersion,lock:70});
 assert.deepEqual(quick.allInPicks[70],[m.teams[side].id]);
});

test('hükmen biten maçta düğme yok',()=>{
 let r=secondHalf(13);const m=r.matches[0],id=m.teams[0].id;
 m.events.push({minute:50,type:'forfeit',team:m.teams[1].id});m.finished=true;m.forfeit=m.teams[1].id;
 assert.equal(publicView(r,id,timeAt(r,62)).allIn.available,false);
 assert.throws(()=>act(r,id,'allIn',timeAt(r,62),{phaseVersion:r.phaseVersion,lock:70}),/hükmen/);
 r=act(r,'a','poll',timeAt(r,71));assert.equal(r.matches[0].minute,70);
});

// 90'da berabere biten bir final arar.
function tiedFinal(){
 for(let seed=1;seed<300;seed++){
  let r=untilPhase(lobby(seed),'secondHalf',{final:true});r=act(r,'a','poll',timeAt(r,70));
  if(r.matches[0].teams[0].goals===r.matches[0].teams[1].goals&&!r.matches[0].forfeit)return act(r,'a','poll',r.deadline);
 }
 throw Error('Berabere final bulunamadı');
}

test('final uzatması 90–105 ve 105–120 dilimleriyle oynanır, 105 kilidi çalışır ve şampiyon kaydı yazılır',()=>{
 let r=tiedFinal();const m=r.matches[0];
 assert.equal(r.phase,'finalResolution');assert.equal(m.minute,105);assert.equal(r.playbackEnd,120);
 assert.deepEqual(r.nextSegment,{start:105,end:120});
 assert.ok(m.events.some(e=>e.type==='extraTime'&&e.minute===90));
 const ids=r.finalists,view=publicView(r,ids[0],timeAt(r,97));
 assert.equal(view.allIn.lock,105);assert.equal(view.allIn.from,95);
 assert.throws(()=>act(r,ids[0],'allIn',timeAt(r,93),{phaseVersion:r.phaseVersion,lock:105}),/penceresi kapalı/);
 const s=scoreAt(m,97),side=s[0]<=s[1]?0:1,picker=m.teams[side].id;
 r=act(r,picker,'allIn',timeAt(r,97),{phaseVersion:r.phaseVersion,lock:105});
 const lockTime=timeAt(r,105);
 r=act(r,'a','poll',lockTime);
 const done=r.matches[0];
 assert.equal(r.phase,'finalResolution');assert.ok(done.winner);
 assert.deepEqual(done.snapshots.map(x=>x.minute),[45,70,90,105,120]);
 if(scoreAt(done,105)[side]<=scoreAt(done,105)[1-side])assert.ok(done.events.some(e=>e.type==='allIn'&&e.minute===105&&e.team===picker));
 // 120'den önce penaltı sonucu ve penaltıya gidileceği bilgisi (bitiş saati) görünmez.
 assert.equal(r.playbackEnd,120);
 const mid=publicView(r,ids[1],timeAt(r,110));
 assert.equal(mid.matches[0].shootout,null);assert.ok(mid.matches[0].events.every(e=>e.type!=='shootout'&&e.minute<=110));
 for(let i=0;i<5&&r.phase!=='finished';i++)r=act(r,'a','poll',r.deadline);
 assert.equal(r.phase,'finished');assert.equal(r.champion,done.winner);
 const entry=championEntry(r,1);const winSide=done.teams.findIndex(t=>t.id===r.champion);
 assert.deepEqual(entry.score,[done.teams[winSide].goals,done.teams[1-winSide].goals]);
 assert.deepEqual(entry.shootout,done.shootout?[done.shootout.score[winSide],done.shootout.score[1-winSide]]:null);
 const final=publicView(r,ids[0],r.deadline+1).matches[0];
 assert.deepEqual(final.shootout,done.shootout||null);
});

test('90da kazananı belli olan final doğrudan biter ve match.winner yazılır',()=>{
 for(let seed=1;seed<300;seed++){
  let r=untilPhase(lobby(seed),'secondHalf',{final:true});r=act(r,'a','poll',timeAt(r,70));
  if(r.matches[0].teams[0].goals===r.matches[0].teams[1].goals)continue;
  r=act(r,'a','poll',r.deadline);
  assert.equal(r.phase,'finished');assert.equal(r.champion,r.matches[0].winner);assert.ok(championEntry(r,1));return;
 }
 assert.fail('Kazananlı final bulunamadı');
});

test('eski rulesVersion 5 odaları eski yoldan aynen oynar',()=>{
 let r=untilPhase(lobby(17,5),'secondHalf');
 assert.equal(r.rulesVersion,5);const m=r.matches[0];
 assert.equal(m.version,5);assert.equal(m.minute,90);assert.equal(m.snapshots,undefined);assert.equal(r.nextSegment,undefined);
 const [a,b]=m.teams.map(t=>r.teams.find(x=>x.id===t.id));
 const plans=[{...DEFAULT_PLAN,formation:'2-2-2'},{...DEFAULT_PLAN,formation:'2-2-2'}];
 const expected=simulateHalf(simulateHalf(beginMatch(a,b,r.seed+r.round*719,(r.seed+r.round*719)%3,{version:5,neutral:false}),plans),plans);
 assert.deepEqual(m,expected);
 const view=publicView(r,a.id,timeAt(r,62));assert.equal(view.allIn,null);assert.equal(view.matches[0].snapshots,undefined);
 assert.throws(()=>act(r,a.id,'allIn',timeAt(r,62),{phaseVersion:r.phaseVersion,lock:70}),/yok/);
 for(let i=0;i<200&&r.phase!=='finished';i++)r=step(r);
 assert.equal(r.phase,'finished');assert.ok(r.matches.every(x=>x.version===5&&!x.snapshots));assert.ok(r.finalists.includes(r.champion));
});

test('penaltılar 120. dakikaya gelince oynatmaya eklenir; önceden bitiş saatinden anlaşılmaz',()=>{
 for(let seed=1;seed<300;seed++){
  let r=untilPhase(lobby(seed),'secondHalf',{final:true});r=act(r,'a','poll',timeAt(r,70));
  if(r.matches[0].teams[0].goals!==r.matches[0].teams[1].goals||r.matches[0].forfeit)continue;
  r=act(r,'a','poll',r.deadline);r=act(r,'a','poll',timeAt(r,105));
  const m=r.matches[0];if(!m.shootout)continue;
  assert.equal(r.playbackEnd,120);assert.ok(m.minute>120);
  const end120=r.deadline,before=publicView(r,r.finalists[0],end120-1).matches[0];
  assert.equal(before.shootout,null);assert.ok(before.events.every(e=>e.type!=='shootout'));
  r=act(r,'a','poll',end120);
  assert.equal(r.phase,'finalResolution');assert.equal(r.playbackEnd,m.minute);assert.equal(r.playbackStart,end120);
  r=act(r,'a','poll',r.deadline);
  assert.equal(r.phase,'finished');assert.equal(r.champion,m.shootout.winner);
  assert.deepEqual(championEntry(r,1).shootout.toSorted(),m.shootout.score.toSorted());return;
 }
 assert.fail('Penaltılı final bulunamadı');
});
