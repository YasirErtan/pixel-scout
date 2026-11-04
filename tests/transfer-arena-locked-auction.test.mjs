import test from 'node:test';import assert from 'node:assert/strict';
import {createRoom,command,publicView} from '../server/transfer-arena/room.js';
import {arenaData} from '../server/transfer-arena/data.js';
import {DEFAULT_PLAN} from '../server/transfer-arena/simulation.js';
import {auctionResult} from '../dist/games/transfer-arenasi/auction-result.js';
import {coachTactics,coachBoostActive} from '../dist/games/transfer-arenasi/coach-tactics.js';
import {displayMinute} from '../dist/games/transfer-arenasi/pitch.js';
let seq=0;const act=(r,uid,type,now,data,extra={})=>command(r,uid,{type,requestId:String(++seq),...extra},now,data);
async function setup(){const data=await arenaData();let r=createRoom('123456','a','A',9871,0);for(const uid of ['b','c'])r=act(r,uid,'join',1,data,{name:uid==='b'?'<B>':uid});for(const uid of ['a','b','c'])r=act(r,uid,'ready',2,data);r=act(r,'a','start',3,data);return {r,data};}
const marketPhases=['players','coaches','auctionResult'];
function finishMarket(r,data){while(marketPhases.includes(r.phase))r=act(r,'a','poll',r.lot?.deadline||r.deadline,data);return r;}
test('one secret offer or pass is irreversible; everyone locking opens a complete result immediately',async()=>{
 let {r,data}=await setup();const lotId=r.lot.id;assert.equal(r.lot.deadline,60003);
 r=act(r,'a','bid',4,data,{lotId,amount:20});
 assert.throws(()=>act(r,'a','bid',5,data,{lotId,amount:21}),/kilitli/);assert.throws(()=>act(r,'a','pass',5,data,{lotId}),/kilitli/);
 for(const uid of ['b','c']){const view=publicView(r,uid,5);assert.equal(view.lot.myBid,null);assert.equal(view.lot.myLocked,false);assert.ok(!('bids'in view.lot)&&!('tieOrder'in view.lot));}
 r=act(r,'b','pass',6,data,{lotId});assert.throws(()=>act(r,'b','bid',7,data,{lotId,amount:30}),/kilitli/);
 const final={type:'bid',requestId:'last-offer',lotId,amount:25};r=command(r,'c',final,8,data);
 assert.equal(r.phase,'auctionResult');assert.equal(r.deadline,8008);assert.equal(r.auctionResult.bidder,'c');assert.equal(r.teams[2].balance,175);
 assert.deepEqual(command(r,'c',final,9,data),r);assert.equal(r.auctionResult.rows.length,3);
 assert.deepEqual(r.auctionResult.rows.map(x=>[x.amount,x.status]),[[20,'bid'],[null,'pass'],[25,'bid']]);
 const html=auctionResult(publicView(r,'a',9).auctionResult,r.teams);assert.ok(html.includes('20 kredi')&&html.includes('25 kredi')&&html.includes('Kazanan')&&html.includes('&lt;B&gt;'));
 r=act(r,'a','poll',r.deadline,data);assert.equal(r.phase,'players');assert.notEqual(r.lot.id,lotId);assert.equal(r.lot.deadline,68008);
});
test('a full minute is allowed for missing decisions; timeout and all-pass outcomes are explicitly revealed',async()=>{
 let {r,data}=await setup();r=act(r,'a','pass',4,data,{lotId:r.lot.id});r=act(r,'b','pass',5,data,{lotId:r.lot.id});r=act(r,'a','poll',60002,data);assert.equal(r.phase,'players');
 r=act(r,'a','poll',60003,data);assert.equal(r.phase,'auctionResult');assert.equal(r.auctionResult.bidder,null);assert.equal(r.auctionResult.rows[2].status,'timeout');assert.ok(auctionResult(r.auctionResult,r.teams).includes('Teklif vermedi'));
 let all=(await setup()).r;for(const uid of ['a','b','c'])all=act(all,uid,'pass',10,data,{lotId:all.lot.id});assert.equal(all.phase,'auctionResult');assert.ok(all.auctionResult.rows.every(x=>x.status==='pass'));
});
test('ineligible squads do not block early completion and still appear in the result',async()=>{
 let {r,data}=await setup();const role=r.lot.card.position,limit=role==='GK'?1:2;r.teams[2].players=Array.from({length:limit},(_,i)=>({...r.lot.card,id:'filled'+i}));
 for(const uid of ['a','b'])r=act(r,uid,'pass',10,data,{lotId:r.lot.id});assert.equal(r.phase,'auctionResult');assert.equal(r.auctionResult.rows[2].status,'ineligible');
});
test('initial and halftime tactics allow three minutes, lock early and retain identical simulation when speeding playback',async()=>{
 const set=await setup(),data=set.data;let r=finishMarket(set.r,data),now=r.deadline-179999;
 assert.equal(r.phase,'squadReview');assert.equal(r.deadline-now,179999);
 for(const uid of ['a','b','c'])r=act(r,uid,'plan',now,data,{phaseVersion:r.phaseVersion,plan:DEFAULT_PLAN});
 assert.equal(r.phase,'firstHalf');assert.equal(r.deadline-now,30000);assert.equal(r.matches[0].minute,45);
 const original=structuredClone(r.matches),start=r.playbackStart;
 assert.equal(publicView(r,'a',start+10000).matches[0].minute,15);
 r=act(r,'a','speed',start+10000,data,{speed:2});assert.equal(publicView(r,'a',start+15000).matches[0].minute,30);assert.deepEqual(r.matches,original);
 now=r.deadline;r=act(r,'a','poll',now,data);assert.equal(r.phase,'halftime');assert.equal(r.deadline-now,180000);
 for(const uid of r.schedule[r.round].flat())r=act(r,uid,'plan',now+1,data,{phaseVersion:r.phaseVersion,plan:DEFAULT_PLAN});assert.equal(r.phase,'secondHalf');assert.equal(r.matches[0].minute,90);
});
test('coach effect and its actual tactical condition are visible, and old match clocks display 90 without modifying results',()=>{
 const coach={name:'Klopp',stars:5,specialty:'press'};
 assert.equal(coachBoostActive(coach,{press:'2'}),true);assert.equal(coachBoostActive(coach,{press:1}),false);
 assert.match(coachTactics(coach,{press:2}),/Boost etkin/);assert.match(coachTactics(coach,{press:1}),/%10/);
 for(const [specialty,plan]of [['passing',{style:'short'}],['defense',{risk:0}],['transition',{style:'counter'}],['discipline',{}]])assert.ok(coachBoostActive({...coach,specialty},plan));
 assert.ok(coachBoostActive({...coach,specialty:'development'},{},[{position:'ATT',overall:75}]));
 assert.deepEqual([0,10,20,22,24].map(n=>displayMinute(n,20)),[0,45,90,105,120]);assert.equal(displayMinute(45,90),45);
});
test('existing v2 rooms upgrade once without extending the timer on every poll or changing a playing match',async()=>{
 let {r,data}=await setup();r.rulesVersion=2;r.lot.single=false;r.lot.bids.a=17;
 r=act(r,'b','poll',20,data);assert.equal(r.rulesVersion,3);assert.equal(r.lot.deadline,60020);assert.equal(publicView(r,'a',20).lot.myLocked,true);
 r=act(r,'b','poll',100,data);assert.equal(r.lot.deadline,60020);assert.throws(()=>act(r,'a','bid',101,data,{lotId:r.lot.id,amount:19}),/kilitli/);
 r=finishMarket(r,data);r.rulesVersion=2;r.deadline=100;r=act(r,'a','poll',200,data);assert.equal(r.phase,'squadReview');assert.equal(r.deadline,180200);
 for(const uid of ['a','b','c'])r=act(r,uid,'plan',201,data,{phaseVersion:r.phaseVersion,plan:DEFAULT_PLAN});
 r.rulesVersion=2;const matches=structuredClone(r.matches);r=act(r,'a','poll',202,data);assert.equal(r.rulesVersion,2);assert.deepEqual(r.matches,matches);
 r=act(r,'a','poll',r.deadline,data);assert.equal(r.rulesVersion,3);assert.equal(r.phase,'halftime');
});
