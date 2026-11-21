import test from 'node:test';
import assert from 'node:assert/strict';
import {arenaService,newSession} from '../server/transfer-arena/service.js';
import {addChampion,championEntry,CHAMPION_LIMIT,publicChampions} from '../server/transfer-arena/champions.js';
import {championsTable} from '../dist/games/transfer-arenasi/champions-table.js';

const finishedRoom=(id='123456')=>({id,createdAt:10,phase:'finished',final:true,champion:'b',
 teams:[{id:'a',name:'A',logo:'tac'},{id:'b',name:'<B>',logo:'alev',coach:{name:'Hoca'}},{id:'c',name:'C'}],
 results:[[{events:[{type:'goal',team:'b',playerId:1,playerName:'Golcü'}]}]],
 matches:[{teams:[{id:'a',goals:1},{id:'b',goals:1}],shootout:{score:[2,3],winner:'b'},events:[{type:'goal',team:'b',playerId:1,playerName:'Golcü'},{type:'goal',team:'a',playerId:2,playerName:'Diğer'}]}]});

test('champion entry is written from the winner side and exposes no private ids',()=>{
 const entry=championEntry(finishedRoom(),99);
 assert.deepEqual(entry.score,[1,1]);assert.deepEqual(entry.shootout,[3,2]);
 assert.equal(entry.champion.name,'<B>');assert.equal(entry.runnerUp.name,'A');
 assert.deepEqual(entry.topScorer,{name:'Golcü',goals:2});
 const shown=publicChampions([entry])[0];assert.ok(!('key' in shown));
 assert.ok(!JSON.stringify(shown).includes('123456'));
 const html=championsTable([shown]);assert.ok(html.includes('&lt;B&gt;')&&html.includes('pen. 3–2')&&html.includes('team-logo'));
 assert.equal(championEntry({...finishedRoom(),phase:'secondHalf'},99),null);
});

test('list ignores repeated rooms and keeps only the newest records',()=>{
 const entry=championEntry(finishedRoom(),1);let list=addChampion(null,entry);
 assert.equal(addChampion(list,entry).length,1);
 for(let i=0;i<CHAMPION_LIMIT+5;i++)list=addChampion(list,{...entry,key:'k'+i,finishedAt:i});
 assert.equal(list.length,CHAMPION_LIMIT);assert.equal(list[0].key,'k'+(CHAMPION_LIMIT+4));
});

test('service records a finished room once and a storage failure does not break the game',async()=>{
 const saved=new Map();let writes=0,fail=false;
 const store={transaction:async(key,fn)=>{if(fail&&key==='champions')throw Error('yazılamadı');const current=structuredClone(saved.get(key)??null),value=fn(current);if(value===undefined)return current;if(key==='champions')writes++;saved.set(key,value);return structuredClone(value);}};
 const service=arenaService({store,data:{},clock:()=>1000}),token=newSession();
 assert.deepEqual((await service.handle({token,ip:'t',action:{type:'champions',requestId:'r0'}})).champions,[]);
 assert.equal(saved.has('champions'),false);
 const created=await service.handle({token,ip:'t',action:{type:'create',requestId:'r1',name:'A'}});
 const room=saved.get('rooms/'+created.id);
 saved.set('rooms/'+created.id,{...finishedRoom(created.id),...{owner:room.owner,seed:1,rulesVersion:5,requests:[],history:[],pool:[],plans:{},round:0,version:1,phaseVersion:1,createdAt:room.createdAt,teams:[{...room.teams[0],id:room.owner},{id:'b',name:'B',players:[],points:0,gf:0,ga:0,wins:0},{id:'c',name:'C',players:[],points:0,gf:0,ga:0,wins:0}]},matches:[]});
 const stored=saved.get('rooms/'+created.id);stored.results=[];stored.champion='b';stored.final=true;stored.matches=[{version:5,minute:90,teams:[{id:room.owner,goals:0,players:[]},{id:'b',goals:2,players:[]}],events:[]}];
 fail=true;assert.equal((await service.handle({token,ip:'t',action:{type:'poll',code:created.id,requestId:'r2'}})).phase,'finished');
 assert.ok(!saved.get('rooms/'+created.id).championRecorded);fail=false;
 for(const requestId of ['r3','r4'])await service.handle({token,ip:'t',action:{type:'poll',code:created.id,requestId}});
 assert.equal(writes,1);assert.equal(saved.get('rooms/'+created.id).championRecorded,true);
 const [row]=(await service.handle({token,ip:'t',action:{type:'champions',requestId:'r5'}})).champions;
 assert.equal(row.champion.name,'B');assert.deepEqual(row.score,[2,0]);
});
