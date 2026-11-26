import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {createRoom,command,publicView,compactResult} from '../server/transfer-arena/room.js';
import {arenaData} from '../server/transfer-arena/data.js';
import {arenaService,newSession,viewHash,IP_LIMIT,SESSION_LIMIT} from '../server/transfer-arena/service.js';
import {memoryLimiter} from '../server/transfer-arena/limits.js';
import {firebaseStore} from '../server/transfer-arena/store.js';
import {cleanupExpired,ROOM_TTL,ROOM_GRACE} from '../server/transfer-arena/cleanup.js';
import cleanupHandler from '../api/transfer-arena-cleanup.js';

const memoryStore=()=>{const saved=new Map();return {saved,transaction:async(key,fn)=>{const value=fn(structuredClone(saved.get(key)??null));if(value===undefined)return saved.get(key)??null;saved.set(key,value);return structuredClone(value);}};};

async function playTournament(count,seed){
 const data=await arenaData();
 let room=createRoom('123456','t0','Team 0',seed,0,{bonusEnabled:true,bonusCardsEnabled:true}),now=0,n=0;
 const act=(uid,type,extra={})=>{room=command(room,uid,{type,requestId:String(++n),...extra},now,data);};
 for(let i=1;i<count;i++)act('t'+i,'join',{name:'Team '+i});
 for(let i=0;i<count;i++){act('t'+i,'formation',{formation:'2-2-2'});act('t'+i,'bonusCard',{cardId:'fitness'});act('t'+i,'ready');}
 act('t0','start');
 for(let steps=0;room.phase!=='finished'&&steps<400;steps++){now=(room.lot&&['players','coaches'].includes(room.phase)?room.lot.deadline:room.deadline)+1;act('t0','poll');}
 return {room,now};
}

test('finished league rounds keep only the score and goal events needed for table and leaderboards',async()=>{
 const {room,now}=await playTournament(6,7);
 assert.equal(room.phase,'finished');
 for(const match of room.results.flat()){
  assert.deepEqual(Object.keys(match).sort(),['events','teams']);
  for(const team of match.teams)assert.deepEqual(Object.keys(team).sort(),['goals','id']);
  assert.ok(match.events.every(e=>e.type==='goal'&&typeof e.minute==='number'&&e.playerId!==undefined));
 }
 // Puan tablosu takım kayıtlarından, gol krallığı özetlenmiş olaylardan tutarlı hesaplanır.
 const view=publicView(room,'t0',now);
 const goals=[...room.results.flat(),...room.matches].flatMap(m=>m.events).filter(e=>e.type==='goal').length;
 assert.equal(view.leaderboard.reduce((sum,row)=>sum+row.goals,0),goals);
 const gf=room.teams.reduce((sum,t)=>sum+t.gf,0),leagueGoals=room.results.flat().reduce((sum,m)=>sum+m.teams[0].goals+m.teams[1].goals,0);
 assert.equal(gf,leagueGoals);
 // Önceden ~456 KB olan 6 takımlı oda kaydı belirgin biçimde küçülür.
 assert.ok(JSON.stringify(room).length<200*1024,'oda kaydı '+Math.round(JSON.stringify(room).length/1024)+' KB');
});

test('compactResult drops shots, cards and snapshots but keeps assist data',()=>{
 const match={teams:[{id:'a',goals:2,players:[{id:1}]},{id:'b',goals:0,players:[]}],snapshots:[{minute:45}],events:[
  {minute:10,type:'shot',team:'a',playerId:1},{minute:12,type:'goal',team:'a',playerId:1,playerName:'X',assisterId:2,assisterName:'Y',xg:0.4,big:true},
  {minute:50,type:'yellow',team:'b',playerId:3},{minute:80,type:'goal',team:'a',playerId:2,playerName:'Y',penalty:true}]};
 assert.deepEqual(compactResult(match),{teams:[{id:'a',goals:2},{id:'b',goals:0}],events:[
  {minute:12,type:'goal',team:'a',playerId:1,playerName:'X',assisterId:2,assisterName:'Y'},{minute:80,type:'goal',team:'a',playerId:2,playerName:'Y'}]});
});

test('polls with the current view hash get a short unchanged reply; any change returns the full view',async()=>{
 const store=memoryStore();let now=1000;const service=arenaService({store,data:{},clock:()=>now});
 const host=newSession(),guest=newSession();let n=0;
 const call=(token,type,extra={})=>service.handle({token,ip:'test',action:{type,requestId:String(++n),...extra}});
 const created=await call(host,'create',{name:'Host'});const code=created.id;
 assert.match(created.viewHash,/^[A-Za-z0-9_-]{22}$/);
 const first=await call(host,'poll',{code});
 const same=await call(host,'poll',{code,since:first.viewHash});
 assert.deepEqual(same,{unchanged:true,viewHash:first.viewHash,serverNow:now});
 const {uid,serverNow,viewHash:hash,...view}=first;assert.equal(hash,viewHash(view));
 await call(guest,'join',{code,name:'Guest'});
 const changed=await call(host,'poll',{code,since:first.viewHash});
 assert.equal(changed.teams.length,2);assert.notEqual(changed.viewHash,first.viewHash);
 // Yalnız poll kısaltılır; komutlar her zaman tam görünüm döner. Hatalı özet tam yanıt alır.
 assert.equal((await call(host,'logo',{code,logo:'kale',since:changed.viewHash})).teams.length,2);
 assert.ok((await call(host,'poll',{code,since:123})).teams);
 // Başka oyuncunun özeti kendi görünümüne uymaz.
 assert.ok((await call(guest,'poll',{code,since:changed.viewHash})).teams);
});

test('one device is rate limited per session while devices sharing an IP are not blocked by each other',async()=>{
 const store=memoryStore();let now=1000;const service=arenaService({store,data:{},clock:()=>now});
 const host=newSession();let n=0;
 const code=(await service.handle({token:host,ip:'home',action:{type:'create',requestId:'c',name:'Host'}})).id;
 const others=Array.from({length:5},()=>newSession());
 for(const [i,token] of others.entries())await service.handle({token,ip:'home',action:{type:'join',code,requestId:'j'+i,name:'T'+i}});
 // Paylaşılan sayaç kaydı yok: yoklamalar veritabanına yalnız oda için gider.
 assert.deepEqual([...store.saved.keys()].filter(k=>k.startsWith('limits/')&&!k.startsWith('limits/create_')),[]);
 for(let i=0;i<SESSION_LIMIT-1;i++)await service.handle({token:host,ip:'home',action:{type:'poll',code,requestId:'p'+(++n)}});
 await assert.rejects(service.handle({token:host,ip:'home',action:{type:'poll',code,requestId:'p'+(++n)}}),/Çok sık/);
 // Aynı IP'deki diğer cihaz etkilenmez.
 assert.ok((await service.handle({token:others[0],ip:'home',action:{type:'poll',code,requestId:'o1'}})).teams);
 now+=60000;assert.ok((await service.handle({token:host,ip:'home',action:{type:'poll',code,requestId:'p'+(++n)}})).teams);
});

test('memory limiter enforces per-key fixed windows and stays bounded',()=>{
 const hit=memoryLimiter({maxKeys:3});
 for(let i=0;i<IP_LIMIT;i++)hit('ip:a',IP_LIMIT,60000,0);
 assert.throws(()=>hit('ip:a',IP_LIMIT,60000,59999),/Çok sık/);
 hit('ip:a',IP_LIMIT,60000,60000);
 for(let i=0;i<10;i++)hit('k'+i,1,60000,0);
 assert.throws(()=>hit('k9',1,60000,1),/Çok sık/);
});

function fakeFirebase(records){
 const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});const calls=[];let etag=1;
 const tags=new Map([...records.keys()].map(k=>[k,String(etag++)]));
 const fetcher=async(url,options={})=>{
  if(String(url).includes('oauth2.googleapis.com'))return Response.json({access_token:'test',expires_in:3600});
  const u=new URL(url),key=u.pathname.replace(/^\/transfer_arena_v1\//,'').replace(/\.json$/,'');calls.push({method:options.method||'GET',key,shallow:u.searchParams.get('shallow'),ifMatch:options.headers?.['if-match']});
  if(u.searchParams.get('shallow')==='true'){const prefix=key+'/';const children=[...records.keys()].filter(k=>k.startsWith(prefix)).map(k=>k.slice(prefix.length));return Response.json(children.length?Object.fromEntries(children.map(k=>[k,true])):null);}
  if(!options.method)return Response.json(records.has(key)?{payload:JSON.stringify(records.get(key))}:null,{headers:{etag:tags.get(key)||'null_etag'}});
  if(options.method==='DELETE'){if(options.headers['if-match']!==tags.get(key))return new Response(null,{status:412});records.delete(key);return Response.json(null);}
  throw Error('beklenmeyen istek');
 };
 return {calls,tags,store:firebaseStore({databaseURL:'https://example.firebaseio.com',serviceAccount:{client_email:'test',private_key:privateKey},fetcher})};
}

test('store lists keys shallowly and deletes only with the ETag it read',async()=>{
 const records=new Map([['rooms/111111',{createdAt:0}],['rooms/222222',{createdAt:5}]]);
 const {store,calls,tags}=fakeFirebase(records);
 assert.deepEqual((await store.keys('rooms')).sort(),['111111','222222']);
 assert.equal(calls.at(-1).shallow,'true');
 assert.deepEqual(await store.keys('limits'),[]);
 assert.equal(await store.remove('rooms/222222',room=>room.createdAt===0),false);
 assert.ok(!calls.some(c=>c.method==='DELETE'));
 assert.equal(await store.remove('rooms/111111',()=>true),true);
 assert.equal(calls.at(-1).ifMatch,tags.get('rooms/111111'));assert.ok(!records.has('rooms/111111'));
 assert.equal(await store.remove('rooms/999999',()=>true),false);
 // Okuma ile silme arasında kayıt değişirse (412) silinmez.
 tags.set('rooms/222222','changed');const original=tags.get.bind(tags);let first=true;
 tags.get=key=>{if(key==='rooms/222222'&&first){first=false;return 'old';}return original(key);};
 assert.equal(await store.remove('rooms/222222',()=>true),false);assert.ok(records.has('rooms/222222'));
 await assert.rejects(store.remove('../x',()=>true),/Geçersiz/);
});

test('cleanup removes expired rooms and limit buckets, keeps live rooms and champions',async()=>{
 const now=10*ROOM_TTL;
 const records=new Map([
  ['rooms/100000',{createdAt:now-ROOM_TTL-ROOM_GRACE}],['rooms/200000',{createdAt:now-ROOM_TTL}],['rooms/300000',{createdAt:now-1000}],['rooms/400000',{broken:true}],
  ['limits/abc',{count:3,until:now-1}],['limits/create_abc',{count:1,until:now+1000}],['champions',[{name:'A'}]]]);
 const {store}=fakeFirebase(records);
 const result=await cleanupExpired(store,{now});
 assert.deepEqual(result,{rooms:2,limits:1,checked:6,failed:0,complete:true});
 assert.deepEqual([...records.keys()].sort(),['champions','limits/create_abc','rooms/200000','rooms/300000']);
 // Süre bütçesi biterse kalanlar sonraki çalıştırmaya bırakılır.
 let t=0;const partial=await cleanupExpired(store,{now:now*2,clock:()=>(t+=1000),budgetMs:2500,concurrency:1});
 assert.equal(partial.complete,false);assert.ok(partial.checked<3);
});

test('cleanup endpoint requires configuration and the exact cron secret',async()=>{
 const run=async(headers,method='GET')=>{const res={code:0,body:null,headers:{},setHeader(k,v){this.headers[k]=v;},status(c){this.code=c;return this;},json(b){this.body=b;}};await cleanupHandler({method,headers},res);return res;};
 const saved={...process.env};
 try{
  delete process.env.CRON_SECRET;assert.equal((await run({authorization:'Bearer x'})).code,503);
  Object.assign(process.env,{CRON_SECRET:'s'.repeat(32),ARENA_SERVICE_ACCOUNT:'{}',ARENA_DATABASE_URL:'https://example.firebaseio.com',ARENA_FIREBASE_API_KEY:'k'});
  assert.equal((await run({authorization:'Bearer '+'s'.repeat(31)+'t'})).code,401);
  assert.equal((await run({})).code,401);
  assert.equal((await run({authorization:'Bearer '+'s'.repeat(32)},'POST')).code,405);
 }finally{for(const k of ['CRON_SECRET','ARENA_SERVICE_ACCOUNT','ARENA_DATABASE_URL','ARENA_FIREBASE_API_KEY'])if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}
});
