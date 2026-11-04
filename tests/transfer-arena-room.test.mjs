import test from 'node:test';import assert from 'node:assert/strict';
import {createRoom,command,publicView} from '../server/transfer-arena/room.js';
import {LIMITS} from '../server/transfer-arena/market.js';
const data={players:Object.keys(LIMITS).flatMap((position,r)=>Array.from({length:50},(_,i)=>({id:r*100+i,name:'Test',position,overall:70+i%22}))),coaches:Array.from({length:6},(_,i)=>({id:'c'+i,stars:i+1}))};
test('hidden market and plans never appear in member projection; commands are idempotent',()=>{
 let r=createRoom('1234','a','A',91,0);let seq=0;const cmd=(uid,type,extra={})=>{r=command(r,uid,{type,requestId:String(++seq),...extra},1,data);};
 cmd('b','join',{name:'B'});cmd('c','join',{name:'C'});for(const uid of ['a','b','c'])cmd(uid,'ready');cmd('a','start');
 const view=publicView(r,'a',1);assert.ok(!('market' in view));assert.ok(!('seed' in view));assert.ok(!('requests' in view));assert.throws(()=>publicView(r,'stranger',1));
 const action={type:'bid',amount:2,lotId:r.lot.id,requestId:'fixed'};r=command(r,'a',action,2,data);assert.deepEqual(command(r,'a',action,2,data),r);
});
test('polling cannot invalidate tactics but an expired phase does',()=>{
 let r=createRoom('room','a','A',91,0);
 r.teams.push({...r.teams[0],id:'b',name:'B'},{...r.teams[0],id:'c',name:'C'});
 r.phase='prepare';r.phaseVersion=7;r.deadline=10000;r.schedule=[[['a','b']]];
 const version=publicView(r,'a',1).phaseVersion;
 r=command(r,'b',{type:'poll',requestId:'poll'},2,data);
 r=command(r,'a',{type:'plan',requestId:'plan',phaseVersion:version,plan:{style:'short',press:1,risk:1,tempo:1,width:1,tackle:1}},3,data);
 assert.ok(r.plans.a);
 assert.throws(()=>command(r,'b',{type:'plan',requestId:'stale',phaseVersion:6,plan:{}},4,data),/Taktik/);
});
