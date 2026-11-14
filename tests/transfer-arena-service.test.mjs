import test from 'node:test';import assert from 'node:assert/strict';
import {arenaService,newSession} from '../server/transfer-arena/service.js';
test('service binds membership to an opaque session and rejects missing/expired rooms',async()=>{
 const saved=new Map();const store={transaction:async(key,fn)=>{const value=fn(structuredClone(saved.get(key)||null));saved.set(key,value);return structuredClone(value);}};
 let now=1000;const service=arenaService({store,data:{},clock:()=>now}),a=newSession(),b=newSession();
 const first=await service.handle({token:a,ip:'test',action:{type:'create',requestId:'1',name:'A'}});
 assert.match(first.id,/^\d{6}$/);assert.equal(first.teams.length,1);assert.ok(!('seed' in first));
 await assert.rejects(service.handle({token:b,ip:'test',action:{type:'poll',code:first.id,requestId:'2'}}),/üyesi/);
 const joined=await service.handle({token:b,ip:'test',action:{type:'join',code:first.id,requestId:'3',name:'B'}});
 assert.equal(joined.teams.length,2);assert.notEqual(joined.uid,first.uid);
 now+=86400000;await assert.rejects(service.handle({token:a,ip:'test',action:{type:'poll',code:first.id,requestId:'4'}}),/süresi/);
 await assert.rejects(service.handle({token:first.uid,action:{type:'create',requestId:'5'}}),/Oturum/);
});

test('leaving frees a lobby seat, closing is host-only and appears on every member poll',async()=>{
 const saved=new Map();
 const store={transaction:async(key,fn)=>{const value=fn(structuredClone(saved.get(key)||null));saved.set(key,value);return structuredClone(value);}};
 const service=arenaService({store,data:{},clock:()=>1000});
 const host=newSession(),member=newSession(),stranger=newSession();
 let seq=0,code;
 const call=(token,type,extra={})=>service.handle({token,ip:'test',action:{type,requestId:String(++seq),code,...extra}});
 code=(await call(host,'create',{name:'Host',bonusCardsEnabled:true})).id;
 await call(member,'join',{name:'Member'});
 await assert.rejects(call(member,'close'),/kurucu/);
 assert.equal((await call(member,'leave')).phase,'left');
 assert.equal((await call(member,'poll')).phase,'left');
 assert.equal((await call(host,'poll')).teams.length,1);
 await call(member,'join',{name:'Member'});
 assert.equal((await call(host,'close')).phase,'closed');
 assert.equal((await call(member,'poll')).phase,'closed');
 await assert.rejects(call(stranger,'join',{name:'Stranger'}),/kapatıldı/);
});
