import test from 'node:test';import assert from 'node:assert/strict';
import {arenaData} from '../server/transfer-arena/data.js';
import {beginMatch,simulateSegment,DEFAULT_PLAN} from '../server/transfer-arena/simulation.js';
import {commentaryLine,isKeyMoment,genitive,dative,turkishSuffix} from '../dist/games/transfer-arenasi/commentary.js';
import {matchReport,ratePlayer} from '../dist/games/transfer-arenasi/match-report.js';

const names=id=>`<b>${id}</b>`;
const mkTeam=(id,tag)=>({id,players:[['GK','Kaleci'+tag],['DEF','Defans'+tag],['MID','Orta'+tag],['ATT','Forvet'+tag]].map(([position,name],i)=>({id:id+i,name,position}))});
const base=()=>({teams:[mkTeam('a','A'),mkTeam('b','B')],events:[]});
const lines=(event,match=base(),n=40)=>{const out=new Set();for(let i=0;i<n;i++)out.add(commentaryLine({...event,minute:(event.minute||10)+i*1.125,playerId:'p'+i},match,names));return [...out];};
const ev=(over)=>({minute:12,type:'shot',team:'a',playerId:'a3',playerName:'ForvetA',...over});

test('Türkçe ek uyumu: -ın/-in/-un/-ün, kaynaştırma ve sessiz e',()=>{
 assert.equal(genitive('Jude Bellingham'),"Bellingham'ın");
 assert.equal(genitive('Harry Kane'),"Kane'in");
 assert.equal(genitive('Kylian Mbappé'),"Mbappé'nin");
 assert.equal(genitive('Joško Gvardiol'),"Gvardiol'un");
 assert.equal(genitive('Rodri'),"Rodri'nin");
 assert.equal(genitive('Florian Wirtz'),"Wirtz'in");
 assert.equal(genitive('Thibaut Courtois'),"Courtois'in");
 assert.equal(genitive('Romelu Lukaku'),"Lukaku'nun");
 assert.equal(genitive('Müller'),"Müller'in");
 assert.equal(genitive('Özil'),"Özil'in");
 assert.equal(genitive('Güler'),"Güler'in");
 assert.equal(genitive('Kübler'),"Kübler'in");
 assert.equal(genitive('Düz'),"Düz'ün");
 assert.equal(genitive('Köln'),"Köln'ün");
 assert.equal(genitive('Ödegaard'),"Ödegaard'ın");
 assert.equal(genitive('Erling Haaland'),"Haaland'ın");
 assert.equal(dative('Kane'),"Kane'e");assert.equal(dative('Rodri'),"Rodri'ye");assert.equal(dative('Haaland'),"Haaland'a");
 assert.equal(turkishSuffix('João','gen'),'nun');
 assert.ok(!genitive('<img src=x onerror=1>').includes('<'));
 assert.equal(genitive(''),'Oyuncunun');
});

test('direk anlatımı kullanıcının kalıbını ek uyumuyla üretir',()=>{
 const all=new Set();
 for(const [n,expect] of [['Jude Bellingham',"Bellingham'ın şutu direkten döndü!"],['Harry Kane',"Kane'in şutu direkten döndü!"],['Kylian Mbappé',"Mbappé'nin şutu direkten döndü!"],['Joško Gvardiol',"Gvardiol'un şutu direkten döndü!"]]){
  const found=new Set();
  for(let i=0;i<80;i++)found.add(commentaryLine({minute:i+.5,type:'post',team:'a',playerId:i,playerName:n},base(),names));
  assert.ok(found.has(expect),`${n}: ${[...found].join(' | ')}`);
  for(const l of found)all.add(l);
 }
});

test('kaleci kurtarışı: büyük fırsatta "Kaleci son anda çeldi", kaleci adı rakipten',()=>{
 const big=lines(ev({type:'save',big:true,xg:.4}));
 assert.ok(big.some(l=>l.includes('Kaleci son anda çeldi')));
 // Şutu a çekti, kurtaran b takımının kalecisi
 assert.ok(big.some(l=>l.includes('KaleciB son anda çeldi')||l.includes('KaleciB devleşti')),big.join('|'));
 assert.ok(big.every(l=>!l.includes('KaleciA')));
 const sans=lines(ev({type:'save',xg:.5}),{teams:[{id:'a'},{id:'b'}],events:[]});
 assert.ok(sans.some(l=>l.includes('Kaleci son anda çeldi')||l.includes('Kaleci devleşti')));
 // yüksek xG de büyük sayılır
 assert.ok(lines(ev({type:'save',xg:.3})).some(l=>l.includes('son anda çeldi')));
 // sıradan kurtarış "son anda" demez
 assert.ok(lines(ev({type:'save',xg:.1})).every(l=>!l.includes('son anda')));
});

test('kıl payı kaçan fırsat yalnız büyük/yüksek xG şutlarda',()=>{
 for(const e of [ev({big:true,xg:.1}),ev({xg:.25}),ev({xg:.4})]){
  const out=lines(e);
  assert.ok(out.some(l=>l.includes('kıl payı dışarı')),out.join('|'));
  assert.ok(out.some(l=>l.includes('Auta gitti, tribünler ellerini başına götürdü')));
  assert.ok(isKeyMoment(e));
 }
 const plain=lines(ev({xg:.1}));
 assert.ok(plain.every(l=>!l.includes('kıl payı')&&!l.includes('tribünler')));
 assert.equal(isKeyMoment(ev({xg:.1})),false);
});

test('her olay tipi için metin üretilir; tüm riskleri al ve skor bağlamı',()=>{
 const m=base();
 const goalTypes=[{type:'goal',score:[1,1],xg:.1},{type:'goal',score:[1,0]},{type:'goal',score:[2,1]},{type:'goal',score:[3,0]},{type:'goal',score:[1,2]},{type:'goal',score:[2,2]},
  {type:'goal',setPiece:'penalty',penalty:true,score:[1,0]},{type:'goal',setPiece:'freeKick',score:[1,0]},{type:'goal',setPiece:'corner',assisterName:'OrtaA',score:[1,0]},{type:'goal',assisterName:'OrtaA',score:[1,0]},{type:'goal',big:true,score:[1,0]},{type:'goal',minute:88,score:[2,1]}];
 for(const g of goalTypes)for(const l of lines(ev(g),m))assert.match(l,/GOL|gol|ağ|Penaltı|Korner|Köşe|Serbest|Net/);
 assert.ok(lines(ev({type:'goal',score:[1,1]}),m).every(l=>/<b>a<\/b> eşitliği yakaladı/.test(l)));
 assert.ok(lines(ev({type:'goal',score:[2,1]}),m).every(l=>/<b>a<\/b> öne geçti/.test(l)));
 assert.ok(lines(ev({type:'goal',score:[1,0]}),m).every(l=>l.includes('ilk gol')||l.includes('açıldı')));
 assert.ok(lines(ev({type:'goal',minute:88,score:[2,1]}),m,1).every(l=>l.includes('Son dakikalarda')));
 assert.ok(lines(ev({type:'goal',setPiece:'penalty',penalty:true,score:[1,0]}),m).some(l=>l.includes('Penaltı')));
 assert.ok(lines(ev({type:'goal',assisterName:'OrtaA',score:[1,0]}),m).some(l=>l.includes('OrtaA')));
 for(const type of ['shot','save','post','yellow','red','foul','extraTime','forfeit']){const l=lines(ev({type}),m);assert.ok(l.length>=1&&l.every(x=>x.length>5),type);}
 for(const type of ['shot','save','post','yellow','red','foul'])assert.ok(lines(ev({type}),m).length>=2,'varyasyon: '+type);
 const all=lines({type:'allIn',team:'a',minute:70},m);
 assert.ok(all.every(l=>l.includes('tüm riskleri aldı')||l.startsWith('🔥 Tüm riskleri aldı')));
 assert.ok(all.every(l=>l.includes('<b>a</b>')&&l.startsWith('🔥')));
 assert.ok(lines({type:'shootout',scored:true,playerName:'X',team:'a',minute:121},m).every(l=>/gol|yendi|ağlara/i.test(l)));
 assert.ok(lines({type:'shootout',scored:false,playerName:'X',team:'a',minute:121},m).every(l=>/kaç|kazandı/i.test(l)));
 assert.ok(lines({type:'penaltyyyy'},m).length>=1);
});

test('anlatım sağlamlığı: bilinmeyen tip ve eksik alanlarda çökmez',()=>{
 for(const e of [undefined,null,{},{type:'goal'},{type:'save'},{type:'post'},{type:'shot',xg:'x'},{type:'goal',score:'x',team:'zz'},{type:'bilinmiyor',playerName:'<b>'},{type:'allIn'},{type:'forfeit'},42,'x'])
  for(const match of [undefined,null,{},base()]){
   const s=commentaryLine(e,match,names);assert.equal(typeof s,'string');
  }
 assert.equal(typeof commentaryLine({type:'goal'},base(),undefined),'string');
 assert.equal(typeof commentaryLine({type:'goal',playerName:'A'},base(),()=>{throw Error('x');}),'string');
});

test('anlatım deterministik ve Math.random kullanmaz',()=>{
 const orig=Math.random;Math.random=()=>{throw Error('Math.random yasak');};
 try{
  const e=ev({type:'shot',big:true,xg:.35,minute:33.5});
  const a=commentaryLine(e,base(),names),b=commentaryLine({...e},base(),names);
  assert.equal(a,b);
  assert.equal(matchReport(fixture(),teamsMeta,{minute:90}),matchReport(fixture(),teamsMeta,{minute:90}));
 }finally{Math.random=orig;}
});

test('XSS: oyuncu adları kaçışlanır (anlatım ve rapor)',()=>{
 const evil='<img src=x onerror=alert(1)>';
 const m=base();
 for(const type of ['goal','shot','save','post','yellow','red','foul','shootout'])
  for(const l of lines({type,playerName:evil,assisterName:evil,big:true,xg:.5,score:[1,0],scored:true,setPiece:'corner'},m)){
   assert.ok(!l.includes('<img'),type+': '+l);
  }
 const m2={teams:[{id:'a',players:[{id:'g',name:evil,position:'GK'}]},{id:'b',players:[{id:'h',name:evil,position:'GK'}]}],events:[]};
 assert.ok(!commentaryLine({type:'save',team:'a',playerName:'x',big:true},m2,names).includes('<img'));
 const f=fixture();
 f.teams[0].players[1].name=evil;
 f.events.push({minute:10,type:'goal',team:'a',playerId:'a3',playerName:evil,assisterId:'a2',assisterName:evil});
 const html=matchReport(f,[{id:'a',name:evil,logo:'yildiz'},{id:'b',name:'B'}],{minute:90});
 assert.ok(html.length>100);assert.ok(!html.includes('<img'),html.slice(0,200));
 assert.ok(html.includes('&lt;img'));
});

// ---- Rapor ----
const teamsMeta=[{id:'a',name:'Aslanlar',logo:'yildiz'},{id:'b',name:'Kartallar',logo:'simsek'}];
function fixture(){
 const T=(id,tag)=>({id,players:[['GK','Kaleci'],['DEF','Defans'],['MID','Orta'],['ATT','Forvet']].map(([position,n],i)=>({id:id+i,name:`${n} ${tag}`,position}))});
 const teamSnap=(id,o,players)=>({id,goals:0,shots:0,onTarget:0,saves:0,xg:0,passes:0,completed:0,losses:0,possessionTicks:0,allIn:false,players,...o});
 return {version:6,teams:[T('a','A'),T('b','B')],
  events:[{minute:10,type:'goal',team:'a',playerId:'a3',playerName:'Forvet A',assisterId:'a2',assisterName:'OrtaA',xg:.3,score:[1,0]},
   {minute:30,type:'yellow',team:'b',playerId:'b1',playerName:'Defans B'},
   {minute:50,type:'goal',team:'a',playerId:'a3',playerName:'Forvet A',score:[2,0]},
   {minute:60,type:'red',team:'b',playerId:'b2',playerName:'Orta B'},
   {minute:75,type:'allIn',team:'b'},{minute:80,type:'yellow',team:'a',playerId:'a1',playerName:'Defans A'}],
  snapshots:[
   {minute:45,teams:[teamSnap('a',{goals:1,shots:5,onTarget:3,saves:1,xg:1.24,passes:100,completed:80,possessionTicks:55},{a0:{saves:1},a1:{tackles:3,interceptions:2},a2:{passes:40,completed:36,keyPasses:2,assists:1},a3:{goals:1,shots:4,onTarget:3}}),teamSnap('b',{shots:2,onTarget:1,saves:2,xg:.31,passes:70,completed:50,possessionTicks:45},{b0:{saves:2},b1:{fouls:1},b2:{},b3:{shots:2,onTarget:1}})]},
   {minute:90,teams:[teamSnap('a',{goals:2,shots:9,onTarget:5,saves:3,xg:2.46,passes:300,completed:250,possessionTicks:100},{a0:{saves:3},a1:{tackles:4,interceptions:3},a2:{passes:90,completed:80,keyPasses:3,assists:1},a3:{goals:2,shots:6,onTarget:4}}),teamSnap('b',{shots:7,onTarget:3,saves:3,xg:.9,passes:200,completed:140,possessionTicks:80,allIn:true},{b0:{saves:3},b1:{fouls:2},b2:{},b3:{shots:5,onTarget:3}})]}]};
}

test('eski maçta (snapshots yok) rapor boş',()=>{
 assert.equal(matchReport({teams:[{id:'a'},{id:'b'}],events:[]},teamsMeta),'');
 assert.equal(matchReport({snapshots:[],teams:[],events:[]},teamsMeta),'');
 assert.equal(matchReport(null,teamsMeta),'');
 assert.equal(matchReport(undefined),'');
 assert.equal(matchReport({snapshots:[{minute:45}]},teamsMeta),'');
});

test('rapor içeriği: skor, takımlar, istatistikler, kartlar, not ve maçın adamı',()=>{
 const html=matchReport(fixture(),teamsMeta,{minute:90});
 for(const s of ['Maç sonu raporu','Aslanlar','Kartallar','2 : 0','Topa sahip olma','%56','%44','İsabetli şut','xG','2,5','0,9','Pas isabeti','%83','%70','Sarı kart','Kırmızı kart','Maçın adamı','Forvet A','tüm riskleri aldı','scope="row"','scope="col"','<caption'])
  assert.ok(html.includes(s),s);
 assert.ok(!html.includes('NaN')&&!html.includes('undefined'));
});

test('snapshot dakika filtresi: gelecek istatistik ve olay gösterilmez',()=>{
 const half=matchReport(fixture(),teamsMeta,{minute:45});
 assert.ok(half.includes('Devre arası raporu'));assert.ok(half.includes('1 : 0'));
 assert.ok(!half.includes('2 : 0'));
 assert.ok(!half.includes('tüm riskleri aldı'),'75. dakika olayı 45te yok');
 assert.ok(half.includes('%55'));assert.ok(half.includes('1,2'));
 assert.ok(!half.includes('2,5'));
 assert.ok(half.includes('Devrenin adamı'));
 // 80. dakikadaki sarı ve 60. dakikadaki kırmızı devre arasında sayılmaz
 const redRow=half.match(/Kırmızı kart<\/th><td>.*?<b>(\d)<\/b>.*?<b>(\d)<\/b>/s);
 assert.deepEqual([redRow[1],redRow[2]],['0','0']);
 const redFull=matchReport(fixture(),teamsMeta,{minute:90}).match(/Kırmızı kart<\/th><td>.*?<b>(\d)<\/b>.*?<b>(\d)<\/b>/s);
 assert.deepEqual([redFull[1],redFull[2]],['0','1']);
 // 44. dakikada hiç kayıt yok
 assert.equal(matchReport(fixture(),teamsMeta,{minute:44}),'');
 // minute verilmezse son kayıt
 assert.ok(matchReport(fixture(),teamsMeta).includes('Maç sonu raporu'));
});

test('oyuncu notları 6,0–10,0 aralığında, tek ondalık; maçın adamı mantıklı',()=>{
 const html=matchReport(fixture(),teamsMeta,{minute:90});
 const notes=[...html.matchAll(/<td class="mr-note"><b>(\d+,\d)<\/b>/g)].map(m=>parseFloat(m[1].replace(',','.')));
 assert.equal(notes.length,8);
 for(const n of notes){assert.ok(n>=6&&n<=10,String(n));assert.equal(Math.round(n*10),n*10);}
 const mom=html.match(/<p class="mr-mom-box">.*?<\/p>/s)[0];
 assert.ok(mom.includes('Forvet A'));
 // aşırı değerler sıkıştırılır
 assert.equal(ratePlayer({goals:20,assists:9},'ATT',{result:1}),10);
 assert.equal(ratePlayer({red:3,fouls:9,yellow:3},'DEF',{result:-1,conceded:9}),6);
 // gol ve asist notu artırır; kart düşürür; kaleci kurtarışla yükselir; yenilen gol defans ve kaleciyi daha çok etkiler
 assert.ok(ratePlayer({goals:1},'ATT')>ratePlayer({},'ATT'));
 assert.ok(ratePlayer({yellow:1},'MID')<ratePlayer({},'MID'));
 assert.ok(ratePlayer({saves:4},'GK',{conceded:1})>ratePlayer({saves:0},'GK',{conceded:1}));
 assert.ok(ratePlayer({},'GK',{conceded:3,result:-1})<=ratePlayer({},'ATT',{conceded:3,result:-1}));
 assert.ok(ratePlayer({tackles:3},'DEF')>ratePlayer({tackles:3},'MID'));
});

test('boş istatistik sayaçlarıyla da çökmeden çalışır (olaylardan türetir)',()=>{
 const f=fixture();
 for(const s of f.snapshots)for(const t of s.teams){t.players={};t.passes=0;t.completed=0;t.possessionTicks=0;t.xg=0;}
 const html=matchReport(f,teamsMeta,{minute:90});
 assert.ok(html.includes('Maç sonu raporu'));assert.ok(html.includes('—'));
 assert.ok(!html.includes('NaN'));
 assert.ok(html.includes('Forvet A'),'kadro match.teams den gelir');
 // kadro hiç yoksa snapshot anahtarlarından/olaylardan
 const g=fixture();g.teams=[{id:'a'},{id:'b'}];
 assert.ok(matchReport(g,[],{minute:90}).includes('mr-players'));
});

test('gerçek model 6 maçı: iskelet sayaçlarıyla çalışır, çıktı geçerli',async()=>{
 const d=await arenaData();
 const mk=(id,off)=>{const by=pos=>d.players.filter(p=>p.position===pos).slice(off,off+9);return {id,coach:d.coaches[0],players:[...by('GK').slice(0,1),...by('DEF').slice(0,2),...by('MID').slice(0,2),...by('ATT').slice(0,2)]};};
 let m=beginMatch(mk('a',0),mk('b',20),11,1,{version:6});
 for(const [s,e] of [[0,45],[45,70],[70,90]])m=simulateSegment(m,[DEFAULT_PLAN,DEFAULT_PLAN],{start:s,end:e,allIn:[s===70,false]});
 const meta=[{id:'a',name:'A takımı',logo:'alev'},{id:'b',name:'B takımı',logo:'kale'}];
 const half=matchReport(m,meta,{minute:45}),full=matchReport(m,meta,{minute:90});
 assert.ok(half.includes('Devre arası'));assert.ok(full.includes('Maç sonu'));
 assert.ok(!full.includes('NaN')&&!full.includes('undefined'));
 const notes=[...full.matchAll(/<td class="mr-note"><b>(\d+,\d)<\/b>/g)].map(x=>parseFloat(x[1].replace(',','.')));
 assert.equal(notes.length,14);assert.ok(notes.every(n=>n>=6&&n<=10));
 assert.ok(full.includes('tüm riskleri aldı')===m.teams.some(t=>t.allIn));
 const nm=id=>meta.find(t=>t.id===id).name;
 for(const e of m.events){const l=commentaryLine(e,m,nm);assert.ok(typeof l==='string'&&l.length>3,JSON.stringify(e));}
 const kinds=new Set(m.events.map(e=>e.type));
 assert.ok(kinds.has('goal')||kinds.has('shot'));
 // aynı olay her seferinde aynı metin
 assert.deepEqual(m.events.map(e=>commentaryLine(e,m,nm)),m.events.map(e=>commentaryLine(structuredClone(e),structuredClone(m),nm)));
});

test('isKeyMoment: gol, kırmızı, direk, allIn, büyük kurtarış ve kıl payı fırsat',()=>{
 for(const e of [{type:'goal'},{type:'red'},{type:'post'},{type:'allIn'},{type:'shot',big:true},{type:'save',big:true},{type:'save',xg:.3},{type:'shot',xg:.26}])assert.ok(isKeyMoment(e),JSON.stringify(e));
 for(const e of [{type:'yellow'},{type:'foul'},{type:'shot',xg:.1},{type:'save',xg:.1},{type:'extraTime'},null,{}])assert.ok(!isKeyMoment(e),JSON.stringify(e));
});

test('soyad önekleri korunur: De Bruyne, De Gea, Van Dijk',async()=>{
 const {shortName,genitive}=await import('../dist/games/transfer-arenasi/commentary.js');
 assert.equal(shortName('Kevin De Bruyne'),'De Bruyne');assert.equal(shortName('David de Gea'),'De Gea');
 assert.equal(shortName('Virgil van Dijk'),'Van Dijk');assert.equal(shortName('Erling Haaland'),'Haaland');
 assert.equal(shortName('Rodri'),'Rodri');assert.equal(shortName('De Gea'),'De Gea');
 assert.match(genitive('Kevin De Bruyne'),/^De Bruyne'nin$/);
});
