import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoom,command,publicView} from '../server/transfer-arena/room.js';
import {arenaData} from '../server/transfer-arena/data.js';
import {LOGOS,LOGO_IDS,logoSVG} from '../dist/games/transfer-arenasi/logos.js';
import {squadBoard} from '../dist/games/transfer-arenasi/formation-board.js';
import {ceremonySteps} from '../dist/games/transfer-arenasi/ceremony.js';
import {mechanicsHTML} from '../dist/games/transfer-arenasi/mechanics.js';
import {auctionResult} from '../dist/games/transfer-arenasi/auction-result.js';

let seq=0;const act=(r,uid,type,now,data,extra={})=>command(r,uid,{type,requestId:'f'+(++seq),...extra},now,data);

test('six distinct logos; each joining team gets a free one and choices stay unique',async()=>{
 assert.equal(LOGOS.length,6);assert.equal(new Set(LOGO_IDS).size,6);
 for(const id of LOGO_IDS)assert.match(logoSVG(id,24),/^<svg class="team-logo"/);
 assert.equal(logoSVG('yok'),'');
 const data=await arenaData();let r=createRoom('123456','a','A',5,0);
 for(const uid of ['b','c','d','e','f'])r=act(r,uid,'join',1,data,{name:uid});
 assert.deepEqual(r.teams.map(t=>t.logo),LOGO_IDS);
 assert.throws(()=>act(r,'a','logo',2,data,{logo:'simsek'}),/başka bir takımda/);
 assert.throws(()=>act(r,'a','logo',2,data,{logo:'yok'}),/Geçersiz logo/);
 r=act(r,'b','leave',3,data);r=act(r,'a','logo',4,data,{logo:'simsek'});
 assert.equal(r.teams[0].logo,'simsek');
 r=act(r,'g','join',5,data,{name:'g'});assert.equal(r.teams.at(-1).logo,'yildiz');
 r=act(r,'a','formation',6,data,{formation:'2-2-2'});r=act(r,'a','ready',6,data);
 assert.throws(()=>act(r,'a','logo',7,data,{logo:'simsek'}),/kapalı/);
 assert.equal(publicView(r,'c',8).teams.find(t=>t.id==='a').logo,'simsek');
});

test('auction counter shows the open lot number of the current market',async()=>{
 const data=await arenaData();let r=createRoom('123456','a','A',77,0);
 for(const uid of ['b','c'])r=act(r,uid,'join',1,data,{name:uid});
 for(const uid of ['a','b','c']){r=act(r,uid,'formation',2,data,{formation:'2-2-2'});r=act(r,uid,'ready',2,data);}
 assert.equal(publicView(r,'a',2).lotNumber,null);
 r=act(r,'a','start',3,data);
 let view=publicView(r,'b',3);assert.deepEqual([view.lotNumber,view.lotTotal,view.lotKind],[1,21,'players']);
 for(const uid of ['a','b','c'])r=act(r,uid,'pass',4,data,{lotId:r.lot.id});
 view=publicView(r,'b',5);assert.equal(r.phase,'auctionResult');assert.deepEqual([view.lotNumber,view.lotTotal],[1,21]);
 r=act(r,'a','poll',r.deadline,data);view=publicView(r,'b',r.lot.deadline-1);assert.equal(view.lotNumber,2);
});

test('formation board shows filled and empty slots by role, coach and captain',()=>{
 const team={name:'T',formation:'3-2-1',players:[{id:1,name:'Kaleci',position:'GK',overall:80},{id:2,name:'Defans <b>',position:'DEF',overall:85},{id:3,name:'Forvet',position:'ATT',overall:90,legend:true}],coach:{name:'Hoca',specialty:'attack',stars:4}};
 const html=squadBoard(team,{captains:new Set([3])});
 assert.equal((html.match(/board-chip empty/g)||[]).length,4);
 assert.ok(html.includes('Defans &lt;b&gt;')&&html.includes('tier-legend')&&html.includes('Kaptan')&&html.includes('Hücum futbolu'));
 assert.ok(html.includes('3-2-1 · 3/7'));
});

test('ceremony runs scorer, assister, third, second and champion in order',()=>{
 const room={champion:'a',finalists:['b','a'],table:['b','a','c','d'],leaderboard:[{name:'Golcü',team:'a',goals:5,assists:1},{name:'Pasör',team:'c',goals:1,assists:4},{name:'İkinci golcü',team:'b',goals:5,assists:0}]};
 const steps=ceremonySteps(room,id=>'['+id+']');
 assert.deepEqual(steps.map(s=>s.eyebrow),['GOL KRALI','ASİST KRALI','ÜÇÜNCÜ','İKİNCİ','ŞAMPİYON']);
 assert.equal(steps[0].title,'Golcü · İkinci golcü');assert.match(steps[1].sub,/4 asist/);
 assert.deepEqual(steps.slice(2).map(s=>s.title),['[c]','[b]','[a]']);
 assert.equal(ceremonySteps({champion:'a',finalists:['a','b'],table:['a','b'],leaderboard:[]},id=>id)[0].title,'—');
});

test('mechanics guide and first-lock tie note are visible to players',()=>{
 const html=mechanicsHTML();
 for(const word of ['Sprint','Kondisyon','Pres','Tempo','Müdahale','Kaptan'])assert.ok(html.includes(word),word);
 const teams=[{id:'a',name:'A',logo:'tac'},{id:'b',name:'B',logo:'kale'}];
 const result={card:{name:'Kart',overall:85,position:'MID'},bidder:'b',amount:12,tied:true,tieBreak:'firstLocked',offers:[{team:'b',amount:12},{team:'a',amount:12}],rows:[{team:'a',amount:12,status:'bid'},{team:'b',amount:12,status:'bid'}]};
 const out=auctionResult(result,teams);
 assert.match(out,/teklifini ilk kilitleyen/);assert.match(out,/Sonra kilitledi/);assert.ok(out.includes('team-logo'));
});

test('coach stars boost every player in model 5 rooms; older matches keep their numbers',async()=>{
 const {COACH_RATING_BOOST,coachCard}=await import('../dist/games/transfer-arenasi/coach-card.js');
 const {beginMatch,simulateHalf,DEFAULT_PLAN}=await import('../server/transfer-arena/simulation.js');
 const values=[1,2,3,4,5].map(s=>COACH_RATING_BOOST[s]);
 for(let i=1;i<values.length;i++)assert.ok(values[i]>values[i-1]*1.7,'yıldız azaldıkça etki hızla düşer');
 assert.equal(createRoom('123456','a','A',1,0).rulesVersion,7);
 assert.match(coachCard({id:'x',name:'X',stars:5,specialty:'press'}),/\+%8/);
 const data=await arenaData();
 const team=(id,stars)=>({id,players:['GK','DEF','DEF','MID','MID','ATT','ATT'].map((pos,i)=>data.players.filter(p=>p.position===pos)[i]),coach:{stars,specialty:'none'}});
 const half=version=>simulateHalf(beginMatch(team('a',5),team('b',1),42,1,{version,neutral:true}),[DEFAULT_PLAN,DEFAULT_PLAN]);
 const m5=half(5),m4=half(4);
 assert.ok(m5.teams[0].players.every(p=>p.coachBoost===.08)&&m5.teams[1].players.every(p=>p.coachBoost===.002));
 assert.ok(m4.teams.every(t=>t.players.every(p=>p.coachBoost===undefined)));
});
