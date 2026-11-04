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
