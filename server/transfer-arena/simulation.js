// Small-sided game model. Coefficients are game design, not measured real-match probabilities.
import {assignFormation,FORMATIONS} from '../../dist/games/transfer-arenasi/formation.js';
import {CAPTAIN_BOOST} from '../../dist/games/transfer-arenasi/bonus-player.js';
import {bonusCardById} from '../../dist/games/transfer-arenasi/bonus-cards.js';
import {coachRatingBoost} from '../../dist/games/transfer-arenasi/coach-card.js';
import {coachBoostActive} from '../../dist/games/transfer-arenasi/coach-tactics.js';
import {styleEdge,STYLE_EDGE,COACH_SPECIALTY_PER_STAR,COACH_FIT_PER_STAR} from '../../dist/games/transfer-arenasi/tactic-presets.js';
import {arenaError} from './errors.js';
export const DEFAULT_PLAN=Object.freeze({formation:'2-2-2',style:'short',press:1,risk:1,tempo:1,width:1,tackle:1,captainId:null});
export function validatePlan(input){
 const p={...DEFAULT_PLAN,...input};
 if(!FORMATIONS.includes(p.formation))throw arenaError('Geçersiz diziliş');
 if(!['short','wide','direct','counter'].includes(p.style))throw arenaError('Geçersiz oyun planı');
 if(p.captainId!==null&&!((typeof p.captainId==='string'&&p.captainId.length>0&&p.captainId.length<=80)||Number.isSafeInteger(p.captainId)))throw arenaError('Geçersiz kaptan seçimi');
 for(const key of ['press','risk','tempo','width','tackle'])if(!Number.isInteger(p[key])||p[key]<0||p[key]>(key==='tackle'?3:2))throw arenaError('Geçersiz taktik değeri');
 return Object.fromEntries(Object.keys(DEFAULT_PLAN).map(k=>[k,p[k]]));
}
const cap=(x,a,b)=>Math.min(b,Math.max(a,x));
function next(state){state.rng=(Math.imul(state.rng,1664525)+1013904223)>>>0;return state.rng/4294967296;}
function pick(state,a){return a[Math.floor(next(state)*a.length)];}
const stat=(p,k)=>Number.isFinite(p.attributes?.[k])?p.attributes[k]:null;
function required(p,k){const v=stat(p,k);if(v===null)throw arenaError(`Eksik simülasyon özelliği: ${k}`);return v;}
export function beginMatch(home,away,seed,referee=1,{version=3,neutral=false}={}){
 // Model 6: oyuncu istatistik sayaçları ve topa sahip olma sayacı; eski sürümlerde alan eklenmez.
 const make=(t,side)=>({id:t.id,coach:t.coach,...(version>=4?{bonusCard:t.bonusCard||null,homeBonus:!neutral&&side===0?(bonusCardById(t.bonusCard)?.homeBoost||0):0}:{}),players:t.players.map(p=>({...p,energy:100,yellow:0,red:false,...(version>=6?{stats:blankStats()}:{})})),goals:0,shots:0,onTarget:0,saves:0,xg:0,passes:0,completed:0,losses:0,...(version>=6?{possessionTicks:0}:{})});
 return {version,...(version>=4?{neutral}:{}),rng:seed>>>0,minute:0,teams:[make(home,0),make(away,1)],events:[],half:0,referee,finished:false};
}
function alive(t){return t.players.filter(p=>!p.red);}
function keeper(t){return alive(t).find(p=>p.position==='GK')||alive(t).find(p=>p.id===t.emergencyKeeperId);}
function field(t){return alive(t).filter(p=>p.position!=='GK'&&p.id!==t.emergencyKeeperId);}
export function shape(t,formation){for(const assigned of assignFormation(field(t),formation)){const p=t.players.find(p=>p.id===assigned.id);p.matchRole=assigned.matchRole;p.roleFit=assigned.roleFit;}}

function selectPlayer(m,players,weights){const total=players.reduce((s,p)=>s+(weights[p.matchRole||p.position]||1),0);let draw=next(m)*total;return players.find(p=>(draw-=weights[p.matchRole||p.position]||1)<0)||players.at(-1);}
// Model 7: takımda specialtyStar tanımlıdır (yıldız başına uzmanlık katsayısı); eski modeller .02 kullanır.
function coach(team,type){return team.coach?.specialty===type?cap(team.coach.stars,1,5)*(team.specialtyStar??.02):0;}
function performance(p,k){return required(p,k)*(p.captain?1+CAPTAIN_BOOST:1)*(1+(p.coachBoost||0));}
function effective(p,k){return performance(p,k)*(0.8+0.2*p.energy/100)*(p.roleFit||1);}
// Exclude the goalkeeper; live energy, captain and role fit affect usable pace.
export function teamSprint(team){const players=field(team);return players.length?players.reduce((sum,p)=>sum+effective(p,'sprintSpeed'),0)/players.length:0;}
export function sprintAdvantage(team,opponent){return cap((teamSprint(team)-teamSprint(opponent))*.002,-.06,.06);}
function forceResult(m,loser){const other=m.teams[1-loser],team=m.teams[loser];if(other.goals-team.goals<=3){other.goals=3;team.goals=0;}m.finished=true;m.forfeit=team.id;m.events.push({minute:m.minute,type:'forfeit',team:team.id});}
export function simulateHalf(previous,plans){
 const m=structuredClone(previous);if(m.finished||m.half>=2)throw arenaError('Maç tamamlandı');
 const pp=plans.map(validatePlan);m.half++;
 if(m.half===2)for(const t of m.teams)for(const p of alive(t))p.energy=Math.min(100,p.energy+8);
 const length=m.version>=3?45:10;return simulatePeriod(m,pp,(m.half-1)*length,length,m.half===2);
}
function simulatePeriod(m,pp,start,duration,finished){
 // Model 6 ayrı motorda çalışır; aşağıdaki eski yol (model 1–5) değişmeden kalır.
 if(m.version>=6)return simulatePeriod6(m,pp,start,duration,finished);
 for(let i=0;i<2;i++){
  const t=m.teams[i],requested=pp[i].captainId;
  if(requested!==null&&!t.players.some(p=>String(p.id)===String(requested)))throw arenaError('Geçersiz kaptan seçimi');
  const captain=alive(t).find(p=>String(p.id)===String(requested))||alive(t).find(p=>p.captain)||alive(t).toSorted((a,b)=>(b.overall||0)-(a.overall||0))[0];
  t.captainId=captain.id;for(const p of t.players)p.captain=p.id===captain.id;
  // Model 5: hoca yıldızı tüm özelliklere çarpan; eski maçlar etkilenmez.
  if(m.version>=5)for(const p of t.players)p.coachBoost=coachRatingBoost(t.coach);
  shape(t,pp[i].formation);
 }
 let possession=next(m)<.5?0:1,zone=1;
 let passer=null,receiver=null;
 const end=start+duration;
 const ticks=m.version>=3?Math.round(duration*120/45):duration*12;
 for(let tick=0;tick<ticks&&!m.finished;tick++){
  m.minute=start+(tick+1)*duration/ticks;
  const team=m.teams[possession],opp=m.teams[1-possession],plan=pp[possession],def=pp[1-possession];
  const attackers=field(team),defenders=field(opp);if(!attackers.length||!defenders.length)throw arenaError('Saha oyuncusu kalmadı');
  for(let side=0;side<2;side++)for(const p of alive(m.teams[side])){
   const cost=(.07+pp[side].tempo*.045+pp[side].press*.035)*(1-coach(m.teams[side],'press')*(pp[side].press===2))*(1-coach(m.teams[side],'fitness')*.75);
   p.energy=Math.max(15,p.energy-cost*(1-(bonusCardById(m.teams[side].bonusCard)?.fatigueReduction||0))*(1.5-required(p,'stamina')/100));
  }
  const recipient=receiver&&attackers.find(p=>p.id===receiver.id);
  const actor=recipient||selectPlayer(m,attackers,zone===2?{ATT:4,MID:2,DEF:1}:zone===1?{MID:4,DEF:2,ATT:2}:{DEF:4,MID:2,ATT:1});
  const marker=zone===2&&keeper(opp)&&next(m)<.08?keeper(opp):selectPlayer(m,defenders,{DEF:4,MID:2,ATT:1});
  const intensity=[.9,1,1.1,1.15][def.tackle];
  if(next(m)<(.20+def.press*.065)*intensity){
   const foulRisk=cap(.065*[.65,1,1.35,1.9][def.tackle]*(1.5-effective(marker,'standingTackle')/100)*(1-coach(opp,'discipline')),0,.35);
   if(next(m)<foulRisk){
    const severe=next(m)<[.004,.008,.015,.035][def.tackle];
    const yellow=!severe&&next(m)<(.20+m.referee*.12);
    if(yellow)marker.yellow++;
    if(severe||marker.yellow>=2)marker.red=true;
    m.events.push({minute:m.minute,type:marker.red?'red':yellow?'yellow':'foul',team:opp.id,playerId:marker.id,playerName:marker.name});
    if(alive(opp).length<4){forceResult(m,1-possession);break;}
    if(marker.red&&marker.position==='GK')opp.emergencyKeeperId=alive(opp).toSorted((a,b)=>required(a,'finishing')-required(b,'finishing'))[0].id;
    passer=receiver=null;
    if(zone===2&&next(m)<.2){shoot(m,possession,actor,pp,true);possession=1-possession;zone=0;}
    continue;
   }
   const win=cap(.30+(effective(marker,'standingTackle')*(1+(opp.homeBonus||0))-effective(actor,'ballControl')*(1+(team.homeBonus||0)))*.006,.1,.7);
   if(next(m)<win){team.losses++;possession=1-possession;zone=plan.risk===2?1:0;passer=receiver=null;continue;}
  }
  const shootChance=zone===2?.38+plan.risk*.08:zone===1?.025:0;
  if(next(m)<shootChance){shoot(m,possession,actor,pp,false,recipient?passer:null);possession=1-possession;zone=0;passer=receiver=null;continue;}
  team.passes++;
  const direct=plan.style==='direct',wide=plan.style==='wide',short=plan.style==='short';
  const passSkill=(effective(actor,'shortPassing')*.65+effective(actor,'vision')*.35)*(1+(team.homeBonus||0))*(1+(bonusCardById(team.bonusCard)?.passingBoost||0));
  const pressure=(effective(marker,'interceptions')*.6+effective(marker,'defensiveAwareness')*.4)*(1+(opp.homeBonus||0));
  const midfield=attackers.filter(p=>p.matchRole==='MID').length-defenders.filter(p=>p.matchRole==='MID').length;
  const space=(attackers.length-defenders.length)*.025+midfield*.008+(wide&&def.width===0?.04:0);
  let chance=.77+(passSkill-pressure)*.004+space-plan.tempo*.025-def.press*.025-(direct?.12:0);
  // Covering the wings leaves more space through the centre, and vice versa.
  chance+=(plan.width===0&&short?.02:0)+(plan.width===2&&wide?.02:0);
  chance+=def.width===0?(wide?.015:-.015):def.width===2?(wide?-.015:.015):0;
  chance+=short?coach(team,'passing')*.6:0;
  if(plan.style==='counter'&&zone<2)chance+=def.risk*.012+def.press*.012+coach(team,'transition')*.3;
  if(actor.overall<=81)chance+=coach(team,'development')*.3;
  if(direct&&def.press===2)chance+=.035;
  if(next(m)<cap(chance,.3,.95)){
   team.completed++;
   const pace=m.version>=2?sprintAdvantage(team,opp):0;
   if(next(m)<cap((direct?.8:.48)+plan.tempo*.035+pace,.3,.95))zone=Math.min(2,zone+1);
   if(m.version>=4){
    passer=actor;
    const targets=attackers.filter(p=>p.id!==actor.id);
    receiver=selectPlayer(m,targets,zone===2?{ATT:4,MID:2,DEF:1}:zone===1?{MID:4,DEF:2,ATT:2}:{DEF:4,MID:2,ATT:1});
   }
  }
  else{team.losses++;possession=1-possession;zone=plan.risk===2?1:0;passer=receiver=null;}
 }
 m.minute=end;if(finished)m.finished=true;return m;
}
// Extra time reuses the same event model and current discipline/energy state.
export function resolveFinal(previous,plans){
 if(!previous.finished||previous.half!==2||previous.teams[0].goals!==previous.teams[1].goals||previous.forfeit)throw arenaError('Uzatma için berabere tamamlanmış final gerekli');
 let m=structuredClone(previous);const pp=plans.map(validatePlan);m.finished=false;
 const start=m.version>=3?90:20,length=m.version>=3?15:2;
 m.events.push({minute:start,type:'extraTime'});
 m=simulatePeriod(m,pp,start,length,false);
 if(!m.finished)m=simulatePeriod(m,pp,start+length,length,true);
 if(m.teams[0].goals===m.teams[1].goals&&!m.forfeit)m=shootout(m);
 m.winner=m.shootout?.winner||m.teams.reduce((a,b)=>a.goals>b.goals?a:b).id;
 return m;
}
function shootout(m){
 const order=m.teams.map(t=>alive(t).toSorted((a,b)=>required(b,'penalties')-required(a,'penalties')));
 // Match the number of eligible takers after dismissals.
 const count=Math.min(...order.map(x=>x.length));for(const list of order)list.length=count;
 const goals=[0,0],taken=[0,0];const first=next(m)<.5?0:1;
 function kick(side){
  const actor=order[side][taken[side]%count],keeper=alive(m.teams[1-side]).find(p=>p.position==='GK');
  const keeping=keeper?(performance(keeper,'gkReflexes')+performance(keeper,'gkPositioning'))/2:25;
  const probability=cap(.72+(performance(actor,'penalties')-keeping)*.003,.4,.94);
  const scored=next(m)<probability;taken[side]++;goals[side]+=Number(scored);
  m.minute=(m.version>=3?120:24)+(taken[0]+taken[1])*.5;
  m.events.push({minute:m.minute,type:'shootout',team:m.teams[side].id,playerId:actor.id,playerName:actor.name,scored,shootoutScore:[...goals]});
 }
 for(let pair=0;;pair++){
  for(const side of [first,1-first]){
   kick(side);
   if(pair<3&&(goals[0]>goals[1]+3-taken[1]||goals[1]>goals[0]+3-taken[0])){
    m.shootout={score:goals,winner:m.teams[goals[0]>goals[1]?0:1].id};return m;
   }
  }
  if(pair>=2&&goals[0]!==goals[1]){m.shootout={score:goals,winner:m.teams[goals[0]>goals[1]?0:1].id};return m;}
 }
}
function shoot(m,side,actor,plans,penalty=false,passer=null){
 const t=m.teams[side],opp=m.teams[1-side],goalkeeper=keeper(opp);
 // No factual outfield GK attributes are invented: 25 is the explicit emergency-keeper model.
 const keeping=goalkeeper?.position==='GK'?(performance(goalkeeper,'gkReflexes')+performance(goalkeeper,'gkPositioning'))/2:25;
 const defense=plans[1-side].risk===0?coach(opp,'defense')*.25:0;
 const attack=plans[side].risk===2?coach(t,'attack')*.25:0;
 const attackRoles=field(t).filter(p=>p.matchRole==='ATT').length,defenseRoles=field(opp).filter(p=>p.matchRole==='DEF').length;
 const shotQuality=penalty?.72:cap(.13+plans[side].risk*.025+(field(t).length-field(opp).length)*.035+(attackRoles-defenseRoles)*.009-defense+attack,.03,.45);
 const shooting=penalty?performance(actor,'penalties'):m.version>=2?performance(actor,'finishing')*.75+performance(actor,'shotPower')*.25:performance(actor,'finishing');
 const probability=cap(shotQuality+(shooting*(1+(t.homeBonus||0))-keeping*(1+(opp.homeBonus||0)))*.003,.01,.94);
 t.shots++;t.xg+=probability;
 const draw=next(m);let type='shot';
 if(draw<probability){t.goals++;t.onTarget++;type='goal';}
 else if(draw<probability+(1-probability)*.45){t.onTarget++;opp.saves++;type='save';}
 const assist=type==='goal'&&!penalty&&passer&&passer.id!==actor.id?{assisterId:passer.id,assisterName:passer.name}:{};
 m.events.push({minute:m.minute,type,penalty,...assist,team:t.id,playerId:actor.id,playerName:actor.name,xg:probability,score:m.teams.map(x=>x.goals)});
}
export function fixtures(ids,balanced=false){
 const ring=[...ids];if(ring.length%2)ring.push(null);const rounds=[];
 for(let r=0;r<ring.length-1;r++){const pairs=[];for(let i=0;i<ring.length/2;i++){const a=ring[i],b=ring.at(-1-i);if(a!==null&&b!==null)pairs.push(balanced?homePair(ids,a,b):[a,b]);}rounds.push(pairs);ring.splice(1,0,ring.pop());}return rounds;
}

// Orient the round robin so the venue count differs by at most one per team.
function homePair(ids,a,b){
 const size=ids.length%2?ids.length:ids.length-1;
 const i=ids.indexOf(a),j=ids.indexOf(b);
 if(i===size||j===size){
  const lastHome=Math.min(i,j)%2===0;
  return (i===size)===lastHome?[a,b]:[b,a];
 }
 return (j-i+size)%size<=Math.floor(size/2)?[a,b]:[b,a];
}

// ---- Model 6 iskeleti (sözleşme: docs/ARENA_MODEL6_CONTRACT.md) ----
// Maç parçalar halinde hesaplanır: 0–45, 45–70, 70–90 ve finalde 90–105, 105–120.
// Bu iskelet çalışan en küçük sürümdür; Akış A model ayrıntılarını bu imzaları koruyarak geliştirir.
export const ALL_IN_LOCKS=Object.freeze([70,105]);
export const ALL_IN_WINDOW=10;
// "Tüm riskleri al!" kilit dakikasındaki gerçek skorla: geride ya da berabere olan taraf kullanabilir.
export function allInEligible(match,side){
 if(match.finished||match.forfeit)return false;
 return match.teams[side].goals<=match.teams[1-side].goals;
}
function snapshot(m,minute){
 m.snapshots??=[];
 m.snapshots.push({minute,teams:m.teams.map(t=>({id:t.id,goals:t.goals,shots:t.shots,onTarget:t.onTarget,saves:t.saves,xg:t.xg,passes:t.passes,completed:t.completed,losses:t.losses,possessionTicks:t.possessionTicks||0,allIn:!!t.allIn,...(t.coachFit!==undefined?{coachFit:t.coachFit}:{}),players:Object.fromEntries(t.players.map(p=>[p.id,{...(p.stats||{})}]))}))});
}
export function simulateSegment(previous,plans,{start,end,allIn=[false,false]}={}){
 const m=structuredClone(previous);
 if(m.version<6)throw arenaError('Parçalı simülasyon yalnız model 6');
 if(m.finished&&!(start>=90&&m.teams[0].goals===m.teams[1].goals&&!m.forfeit))throw arenaError('Maç tamamlandı');
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)throw arenaError('Geçersiz maç dilimi');
 const pp=plans.map(validatePlan);
 if(start===0)m.half=1;
 if(start===45){m.half=2;for(const t of m.teams)for(const p of alive(t))p.energy=Math.min(100,p.energy+8);}
 if(start===90){m.finished=false;m.events.push({minute:90,type:'extraTime'});}
 for(let side=0;side<2;side++){
  const chosen=Boolean(allIn[side])&&ALL_IN_LOCKS.includes(start)&&allInEligible(m,side);
  m.teams[side].allIn=chosen;
  if(chosen)m.events.push({minute:start,type:'allIn',team:m.teams[side].id});
 }
 const done=end===90||end===120;
 const out=simulatePeriod(m,pp,start,end-start,done);
 snapshot(out,out.minute);
 return out;
}
// Uzatma sonunda eşitlik sürüyorsa penaltılar; kazanan her durumda yazılır.
export function finishFinal(previous){
 let m=structuredClone(previous);
 if(m.teams[0].goals===m.teams[1].goals&&!m.forfeit)m=shootout(m);
 m.winner=m.shootout?.winner||m.teams.reduce((a,b)=>a.goals>b.goals?a:b).id;
 return m;
}

// ---- Model 6 maç motoru ----
// Yalnız m.version >= 6 maçlarında çalışır. Katsayılar oyun tasarımıdır; gerçek maç ölçümü değildir.
// Güç farkı esas olarak fırsat üretimine (top kapma, pas, ilerleme, şut sıklığı, büyük fırsat) yansır;
// bitiricilik katsayıları ölçülü tutulur ve tüm etkiler sınırlıdır.
export const MODEL6=Object.freeze({
 gapCap:12,          // anlık güç farkının etkisi bu kadar puanla sınırlı
 gapTackle:.0015,    // güç farkı puanı başına top kapma şansı değişimi
 gapPass:.001,       // pas isabeti
 gapProgress:.0015,   // başarılı pastan sonra ileri gitme
 gapShot:.006,       // ceza sahasında şut sıklığı (çarpan)
 gapBig:.003,        // büyük fırsat olasılığı
 shot:.27,shotRisk:.05,longShot:.018,
 carry:.14,          // pas yerine top sürme (asistsiz pozisyonlar)
 big:.13,bigXg:.35,normalXg:.053,
 tiredShot:1.0,tiredBig:.5,late:.48, // savunmanın yorgunluğu geç dakikalarda pozisyon ve kaliteyi artırır
 save:.42,post:.085,cornerAfterSave:.30,cornerAfterMiss:.18,cornerShot:.30,
 penalty:.31,freeKick:.22,freeKickFar:.06,
 severe:.25,yellow:.14,yellowRef:.09,
 drain:1.5,allInDrain:1.2,
 allIn:1.45,allInCounter:.18,allInOpenBig:.03,counterBig:.08, // "Tüm riskleri al!": şut sıklığı, kontra riski
 settle:.70          // toplam gol arttıkça iki takım da oyunu yavaşlatır (ezici skorları sınırlar)
});
// Model 7 ek sabitleri (yalnız m.version >= 7). Taktik katmanı tarz/hoca katsayılarını tactic-presets.js'den alır;
// buradakiler yüksek tempo/risk taktiklerinin model 6'daki aşırı cezasını hafifleterek hazır profilleri dengeler.
export const MODEL7=Object.freeze({
 riskCounter:.3,   // risk 2 oynayan takım topu kaybedince rakibin orta sahadan (bölge 1) başlama olasılığı (model 6'da 1)
 tempoRelief:1,    // tempo başına pas isabeti cezasının hafifleyen kısmı (0: model 6 ile aynı)
 directPass:.065   // direkt oyunun pas isabeti cezası (model 6'da .12)
});
const K=MODEL6;
const STAT_KEYS=['passes','completed','keyPasses','shots','onTarget','goals','assists','tackles','interceptions','fouls','saves','minutes'];
function blankStats(){return Object.fromEntries(STAT_KEYS.map(k=>[k,0]));}
function bump(p,k){if(p)(p.stats??=blankStats())[k]++;}
const WIDE=new Set(['RW','LW','RB','LB']),CENTRAL=new Set(['ST','CAM']);
// Takımın anlık gücü: overall × hoca yıldızı × kaptan × enerji × görev uyumu (kırmızı kartlılar hariç).
function power6(t){const ps=alive(t);return ps.reduce((s,p)=>s+(p.overall||0)*(1+(p.coachBoost||0))*(p.captain?1+CAPTAIN_BOOST:1)*(.9+.1*p.energy/100)*(p.roleFit||1),0)/ps.length;}
// Skor durumu ve "Tüm riskleri al!" taktiğin etkin değerlerini değiştirir.
function mood6(m,side,plan){
 const t=m.teams[side],lead=t.goals-m.teams[1-side].goals;
 let risk=plan.risk,tempo=plan.tempo,press=plan.press,rate=1;
 if(t.allIn){risk=2.6;tempo=2.5;press=2.5;rate=K.allIn;}
 else if(lead>=3){risk-=1.2;tempo-=1;rate=.6;}
 else if(lead===2){risk-=1;tempo-=.8;rate=.72;}
 else if(lead===1&&m.minute>=75){risk-=.5;tempo-=.4;rate=.88;}
 else if(lead<0&&m.minute>=70){risk+=.5;tempo+=.4;rate=1.3;}
 else if(lead===0&&m.minute>=80){risk-=.4;rate=.8;} // son dakikalarda berabere takımlar puanı korur
 // Dakikaya göre beklenenden çok gol olan maçta oyun oturur: şut sıklığı ve kalitesi azalır.
 const excess=t.goals+m.teams[1-side].goals-.6-m.minute/50;if(excess>0)rate/=1+K.settle*excess;
 return {risk:Math.max(0,risk),tempo:Math.max(0,tempo),press:Math.max(0,press),rate,allIn:!!t.allIn};
}
// Bölgeye, ayrıntılı mevkiye ve pozisyon almaya göre topu alacak oyuncu.
function pick6(m,players,zone,mood,plan){
 const role=zone===2?{ATT:4,MID:2,DEF:mood.allIn?2.2:1}:zone===1?{MID:4,DEF:2,ATT:2}:{DEF:4,MID:2,ATT:1};
 const weight=p=>{
  let w=role[p.matchRole||p.position]||1;
  if(zone===2){
   w*=required(p,'positioning')/75;
   const d=p.detailPosition;
   if(d==='ST')w*=1.25;else if(d==='CAM')w*=1.1;
   else if((d==='RW'||d==='LW')&&(plan.style==='wide'||plan.width===2))w*=1.3;
   else if((d==='RB'||d==='LB')&&mood.allIn)w*=1.3;
  }
  return w;
 };
 const weights=players.map(weight),total=weights.reduce((s,w)=>s+w,0);let draw=next(m)*total;
 return players.find((p,i)=>(draw-=weights[i])<0)||players.at(-1);
}
function keeping6(gk){return gk?.position==='GK'?(performance(gk,'gkReflexes')+performance(gk,'gkPositioning')+performance(gk,'gkDiving'))/3:25;}
function shoot6(m,side,actor,pp,moods,{kind='open',passer=null,gap=0,tired=0,counter=false}={}){
 const t=m.teams[side],opp=m.teams[1-side],gk=keeper(opp),at=moods[side],dm=moods[1-side],plan=pp[side],def=pp[1-side];
 const keeping=keeping6(gk)*(1+(opp.homeBonus||0)),home=1+(t.homeBonus||0);
 const fin=performance(actor,'finishing')*home,comp=performance(actor,'composure')*home,pow=performance(actor,'shotPower')*home;
 let p,setPiece=null;
 if(kind==='penalty'){setPiece='penalty';p=cap(.76+(performance(actor,'penalties')*home*.7+comp*.3-keeping)*.003,.6,.9);}
 else if(kind==='freeKick')p=(setPiece='freeKick',cap(.055+(fin*.4+pow*.4+comp*.2-keeping)*.0015,.02,.12));
 else if(kind==='long')p=cap(.03+(pow*.6+fin*.4-keeping)*.001,.01,.07);
 else{
  const defenders=field(opp),awareness=defenders.reduce((s,d)=>s+effective(d,'defensiveAwareness'),0)/defenders.length;
  const position=effective(actor,'positioning'),d=actor.detailPosition;
  const attackRoles=field(t).filter(x=>x.matchRole==='ATT').length+(at.allIn?2:0),defenseRoles=defenders.filter(x=>x.matchRole==='DEF').length;
  let big=kind==='corner'?.10:K.big;
  big+=(position-awareness)*.003+gap*K.gapBig+tired*K.tiredBig+(attackRoles-defenseRoles)*.012+(field(t).length-field(opp).length)*.08;
  if(counter)big+=K.counterBig;
  if(dm.allIn)big+=K.allInOpenBig;
  if(at.allIn)big+=.03;
  if(passer?.detailPosition==='CAM'||(passer&&required(passer,'vision')>=85))big+=.03;
  if(passer&&WIDE.has(passer.detailPosition)&&(plan.style==='wide'||plan.width===2))big+=.03+(def.width===0?.04:def.width===2?-.03:0);
  if(dm.risk<=.5)big-=.03;
  let xg=next(m)<cap(big,.04,.55)?K.bigXg:K.normalXg;
  if(kind==='corner'){setPiece='corner';xg=xg===K.bigXg?.32:.07;}
  if(m.version>=7)xg+=styleEdge(plan.style,def.style)*STYLE_EDGE.xg;
  xg+=at.risk*.008+(CENTRAL.has(d)?.012:d==='CB'||d==='CDM'||d==='RB'||d==='LB'?-.012:0);
  xg+=(plan.risk>=2?coach(t,'attack')*.25:0)-(def.risk===0?coach(opp,'defense')*.25:0);
  const shooting=fin*.6+comp*.25+pow*.15;
  // Skor durumu (oyunu öldürme / risk) şut kalitesine de yansır.
  p=cap(xg*Math.sqrt(at.rate)*(1+(shooting-keeping)*.012),.02,.7);
 }
 t.shots++;t.xg+=p;bump(actor,'shots');
 const assisted=passer&&passer.id!==actor.id&&kind!=='penalty'&&kind!=='freeKick';
 if(assisted)bump(passer,'keyPasses');
 const draw=next(m);let type='shot';
 if(draw<p){t.goals++;t.onTarget++;type='goal';bump(actor,'onTarget');bump(actor,'goals');if(assisted)bump(passer,'assists');}
 else if(draw<p+(1-p)*K.save){t.onTarget++;opp.saves++;type='save';bump(actor,'onTarget');bump(gk,'saves');}
 else if(next(m)<K.post)type='post';
 const assist=type==='goal'&&assisted?{assisterId:passer.id,assisterName:passer.name}:{};
 m.events.push({minute:m.minute,type,penalty:kind==='penalty',...(setPiece?{setPiece}:{}),...(p>=.3?{big:true}:{}),...assist,team:t.id,playerId:actor.id,playerName:actor.name,xg:p,score:m.teams.map(x=>x.goals)});
 // Kurtarış ya da auttan sonra korner olabilir.
 const corner=kind!=='penalty'&&type!=='goal'&&next(m)<(type==='save'?K.cornerAfterSave:K.cornerAfterMiss);
 return {type,corner};
}
// Korner: kullanan oyuncu en iyi pasör; kafa vuruşu için savunmacı ve santrforlar öne çıkar.
function corner6(m,side,pp,moods,gap,tired){
 const t=m.teams[side],players=field(t);
 const taker=players.toSorted((a,b)=>(effective(b,'vision')+effective(b,'shortPassing'))-(effective(a,'vision')+effective(a,'shortPassing')))[0];
 t.passes++;bump(taker,'passes');
 if(next(m)>=K.cornerShot)return false;
 t.completed++;bump(taker,'completed');
 const targets=players.filter(p=>p.id!==taker.id);if(!targets.length)return false;
 const weights=targets.map(p=>(p.detailPosition==='CB'||p.detailPosition==='ST'?2.5:1)*required(p,'positioning')/70);
 let draw=next(m)*weights.reduce((s,w)=>s+w,0);const header=targets.find((p,i)=>(draw-=weights[i])<0)||targets.at(-1);
 shoot6(m,side,header,pp,moods,{kind:'corner',passer:taker,gap,tired});
 return true;
}
function specialist(t,score){return field(t).toSorted((a,b)=>score(b)-score(a))[0];}
function simulatePeriod6(m,pp,start,duration,finished){
 for(let i=0;i<2;i++){
  const t=m.teams[i],requested=pp[i].captainId;
  if(requested!==null&&!t.players.some(p=>String(p.id)===String(requested)))throw arenaError('Geçersiz kaptan seçimi');
  const captain=alive(t).find(p=>String(p.id)===String(requested))||alive(t).find(p=>p.captain)||alive(t).toSorted((a,b)=>(b.overall||0)-(a.overall||0))[0];
  t.captainId=captain.id;
  // Model 7: hoca uzmanlığı güçlenir; plan hocanın koşuluna uyuyorsa tüm özelliklere ek çarpan gelir (her dilimde yeniden hesaplanır).
  const v7=m.version>=7;if(v7)t.specialtyStar=COACH_SPECIALTY_PER_STAR;
  const fit=v7&&t.coach?coachBoostActive(t.coach,pp[i],field(t)):false;if(v7)t.coachFit=fit;
  const boost=coachRatingBoost(t.coach)+(fit?cap(t.coach.stars,1,5)*COACH_FIT_PER_STAR:0);
  for(const p of t.players){p.captain=p.id===captain.id;p.coachBoost=v7?boost:coachRatingBoost(t.coach);p.stats??=blankStats();}
  t.possessionTicks??=0;
  shape(t,pp[i].formation);
 }
 let possession=next(m)<.5?0:1,zone=1,passer=null,receiver=null,counter=false;
 const end=start+duration,ticks=Math.round(duration*120/45);
 // Top kaybı: "Tüm riskleri al!" seçen takım topu kaybederse rakip çoğu kez tehlikeli bölgeden başlar.
 const turnover=(mood)=>{possession=1-possession;passer=receiver=null;counter=mood.allIn&&next(m)<K.allInCounter;zone=counter?2:mood.risk>=2&&(m.version<7||next(m)<MODEL7.riskCounter)?1:0;};
 for(let tick=0;tick<ticks&&!m.finished;tick++){
  m.minute=start+(tick+1)*duration/ticks;
  const team=m.teams[possession],opp=m.teams[1-possession],plan=pp[possession],def=pp[1-possession];
  const moods=[mood6(m,0,pp[0]),mood6(m,1,pp[1])],at=moods[possession],dm=moods[1-possession];
  const attackers=field(team),defenders=field(opp);if(!attackers.length||!defenders.length)throw arenaError('Saha oyuncusu kalmadı');
  team.possessionTicks++;
  for(let side=0;side<2;side++){
   const md=moods[side],t=m.teams[side];
   const cost=(.07+md.tempo*.045+md.press*.035)*(1-coach(t,'press')*(pp[side].press===2))*(1-coach(t,'fitness')*.75)*K.drain*(md.allIn?K.allInDrain:1);
   for(const p of alive(t))p.energy=Math.max(15,p.energy-cost*(1-(bonusCardById(t.bonusCard)?.fatigueReduction||0))*(1.5-required(p,'stamina')/100));
  }
  const gap=cap(power6(team)-power6(opp),-K.gapCap,K.gapCap);
  // Model 7: oyun tarzı üstünlüğü (+1 hücum eden üstün, -1 zayıf); hem hücumda hem savunmada simetrik işler.
  const edge=m.version>=7?styleEdge(plan.style,def.style):0;
  // Geç dakikalarda yorgunluk ve konsantrasyon kaybı savunmayı açar (75–90 en gollü dilim).
  const tired=cap(1-defenders.reduce((s,p)=>s+p.energy,0)/defenders.length/100+K.late*cap((m.minute-55)/35,0,1),0,.8);
  const recipient=receiver&&attackers.find(p=>p.id===receiver.id);
  const actor=recipient||pick6(m,attackers,zone,at,plan);
  const marker=zone===2&&keeper(opp)&&next(m)<.08?keeper(opp):selectPlayer(m,defenders,{DEF:4,MID:2,ATT:1});
  const afterShot=res=>{
   if(res.corner&&!m.finished)corner6(m,possession,pp,moods,gap,tired);
   possession=1-possession;zone=0;passer=receiver=null;counter=false;
  };
  const intensity=[.9,1,1.1,1.15][def.tackle];
  if(next(m)<(.20+dm.press*.065)*intensity){
   const foulRisk=cap(.065*[.65,1,1.35,1.9][def.tackle]*(1.5-effective(marker,'standingTackle')/100)*(1-coach(opp,'discipline')),0,.35);
   if(next(m)<foulRisk){
    bump(marker,'fouls');
    const severe=next(m)<[.004,.008,.015,.035][def.tackle]*K.severe;
    const yellow=!severe&&next(m)<(K.yellow+m.referee*K.yellowRef);
    if(yellow)marker.yellow++;
    if(severe||marker.yellow>=2){marker.red=true;marker.redMinute=m.minute;}
    m.events.push({minute:m.minute,type:marker.red?'red':yellow?'yellow':'foul',team:opp.id,playerId:marker.id,playerName:marker.name});
    if(alive(opp).length<4){forceResult(m,1-possession);break;}
    if(marker.red&&marker.position==='GK')opp.emergencyKeeperId=alive(opp).toSorted((a,b)=>required(a,'finishing')-required(b,'finishing'))[0].id;
    passer=receiver=null;
    if(zone===2){
     const r=next(m);
     if(r<K.penalty){afterShot(shoot6(m,possession,specialist(team,p=>performance(p,'penalties')),pp,moods,{kind:'penalty'}));continue;}
     if(r<K.penalty+K.freeKick){afterShot(shoot6(m,possession,specialist(team,p=>performance(p,'finishing')+performance(p,'shotPower')),pp,moods,{kind:'freeKick'}));continue;}
    }
    else if(zone===1&&next(m)<K.freeKickFar){afterShot(shoot6(m,possession,specialist(team,p=>performance(p,'finishing')+performance(p,'shotPower')),pp,moods,{kind:'freeKick'}));continue;}
    continue;
   }
   const win=cap(.30+(effective(marker,'standingTackle')*(1+(opp.homeBonus||0))-effective(actor,'ballControl')*(1+(team.homeBonus||0)))*.006-gap*K.gapTackle-edge*STYLE_EDGE.tackle,.1,.7);
   if(next(m)<win){bump(marker,'tackles');team.losses++;turnover(at);continue;}
  }
  // Kanat oyuncusu ceza sahasında çoğunlukla ortalar; merkez oyuncusu daha sık vurur.
  const crosser=zone===2&&WIDE.has(actor.detailPosition)&&(plan.style==='wide'||plan.width===2);
  const shootChance=(zone===2?(K.shot+at.risk*K.shotRisk)*cap(1+gap*K.gapShot,.6,1.45)*(1+tired*K.tiredShot)*(crosser?.6:1):zone===1?K.longShot:0)*at.rate;
  if(next(m)<shootChance){
   afterShot(shoot6(m,possession,actor,pp,moods,{kind:zone===2?'open':'long',passer:recipient?passer:null,gap,tired,counter}));
   continue;
  }
  // Top sürme: oyuncu pası beklemeden ilerler; buradan gelen şutlar asistsizdir.
  if(next(m)<K.carry*effective(actor,'ballControl')/80){
   const beat=cap(.5+(effective(actor,'ballControl')*.6+effective(actor,'sprintSpeed')*.4-effective(marker,'standingTackle'))*.006+gap*K.gapPass,.2,.8);
   if(next(m)<beat){zone=Math.min(2,zone+1);passer=null;receiver=actor;continue;}
   bump(marker,'tackles');team.losses++;turnover(at);continue;
  }
  team.passes++;bump(actor,'passes');
  const direct=plan.style==='direct',wide=plan.style==='wide',short=plan.style==='short';
  const passSkill=(effective(actor,'shortPassing')*.55+effective(actor,'vision')*.3+effective(actor,'composure')*.15)*(1+(team.homeBonus||0))*(1+(bonusCardById(team.bonusCard)?.passingBoost||0));
  const pressure=(effective(marker,'interceptions')*.6+effective(marker,'defensiveAwareness')*.4)*(1+(opp.homeBonus||0));
  const midfield=attackers.filter(p=>p.matchRole==='MID').length-defenders.filter(p=>p.matchRole==='MID').length;
  const space=(attackers.length-defenders.length)*.025+midfield*.008+(wide&&def.width===0?.04:0);
  let chance=.77+(passSkill-pressure)*.004+space-at.tempo*.025-dm.press*.025-(direct?(m.version>=7?MODEL7.directPass:.12):0)+gap*K.gapPass+edge*STYLE_EDGE.pass+(m.version>=7?at.tempo*.025*MODEL7.tempoRelief:0);
  chance+=(plan.width===0&&short?.02:0)+(plan.width===2&&wide?.02:0);
  chance+=def.width===0?(wide?.015:-.015):def.width===2?(wide?-.015:.015):0;
  chance+=short?coach(team,'passing')*.6:0;
  if(plan.style==='counter'&&zone<2)chance+=dm.risk*.012+dm.press*.012+coach(team,'transition')*.3;
  if(actor.overall<=81)chance+=coach(team,'development')*.3;
  if(direct&&dm.press>=2)chance+=.035;
  if(next(m)<cap(chance,.3,.95)){
   team.completed++;bump(actor,'completed');
   const pace=sprintAdvantage(team,opp);
   const forward=cap((direct?.8:.48)+at.tempo*.035+pace+gap*K.gapProgress+edge*STYLE_EDGE.progress,.3,.95)*(zone===1?Math.min(1.2,at.rate):1);
   if(next(m)<forward)zone=Math.min(2,zone+1);
   passer=actor;
   receiver=pick6(m,attackers.filter(p=>p.id!==actor.id),zone,at,plan);
  }
  else{bump(marker,'interceptions');team.losses++;turnover(at);}
 }
 // Oynanan dakikalar: kırmızı kart görenler atıldıkları dakikaya kadar sayılır.
 const stop=m.forfeit?m.minute:end;
 for(const t of m.teams)for(const p of t.players){
  const until=p.red?Math.min(p.redMinute??start,stop):stop;
  if(until>start)p.stats.minutes+=Math.round(until)-Math.round(start);
 }
 if(!m.forfeit)m.minute=end;if(finished)m.finished=true;return m;
}
