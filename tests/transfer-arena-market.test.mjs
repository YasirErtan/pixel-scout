import test from 'node:test';
import assert from 'node:assert/strict';
import {makeMarket,random,completePool,openLot,bid,settle,maximum,LIMITS} from '../server/transfer-arena/market.js';
const players=Object.keys(LIMITS).flatMap((position,r)=>Array.from({length:70},(_,i)=>({id:r*100+i,position,overall:70+i%22,name:`Test ${r}-${i}`})));
const coaches=Array.from({length:6},(_,i)=>({id:`coach-${i}`,stars:i%5+1}));
const teams=n=>Array.from({length:n},(_,i)=>({id:`team-${i}`,balance:200,players:[],coach:null}));
test('every no-bid player and coach is assigned once for 3–6 teams, with legal squads and conserved budget',()=>{
 for(let n=3;n<=6;n++)for(let seed=1;seed<=50;seed++){
 const next=random(seed),market=makeMarket(players,coaches,n,next),ts=teams(n);
 assert.deepEqual([[70,75],[76,81],[82,87],[88,100]].map(([lo,hi])=>market.players.filter(p=>p.overall>=lo&&p.overall<=hi).length),[2*n,2*n,2*n,n]);
 assert.equal(market.players.length,7*n);completePool(ts,market.players,next);completePool(ts,market.coaches,next);
 assert.equal(new Set(ts.flatMap(t=>t.players.map(p=>p.id))).size,7*n);
 assert.equal(new Set(ts.map(t=>t.coach.id)).size,n);
 for(const t of ts){assert.equal(t.balance,192);for(const [role,q] of Object.entries(LIMITS))assert.equal(t.players.filter(p=>p.position===role).length,q);}
 }
});
test('late bids, fractional bids, over-budget bids and self raises are rejected; extensions have a ceiling',()=>{
 const ts=teams(3),lot=openLot(players[0],0,'one');assert.equal(maximum(ts[0]),193);
 assert.throws(()=>bid(lot,ts[0],194,1,'one'));assert.throws(()=>bid(lot,ts[0],1.5,1,'one'));
 bid(lot,ts[0],190,11000,'one');assert.equal(lot.deadline,14000);
 assert.throws(()=>bid(lot,ts[0],191,12000,'one'));
 bid(lot,ts[1],191,13999,'one');assert.equal(lot.deadline,16999);
 assert.throws(()=>bid(lot,ts[2],192,16999,'one'));assert.throws(()=>bid(lot,ts[2],192,15000,'old'));
 settle(lot,ts,[]);assert.equal(ts[1].balance,9);assert.equal(ts[1].players.length,1);
});
