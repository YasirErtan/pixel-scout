// Small-sided game model. Coefficients are game design, not measured real-match probabilities.
export const DEFAULT_PLAN=Object.freeze({formation:'2-2-2',style:'short',press:1,risk:1,tempo:1,width:1,tackle:1});
export function validatePlan(input){
 const p={...DEFAULT_PLAN,...input};
 if(!['2-2-2','2-3-1','3-2-1','1-3-2'].includes(p.formation))throw Error('Geçersiz diziliş');
 if(!['short','wide','direct','counter'].includes(p.style))throw Error('Geçersiz oyun planı');
 for(const key of ['press','risk','tempo','width','tackle'])if(!Number.isInteger(p[key])||p[key]<0||p[key]>(key==='tackle'?3:2))throw Error('Geçersiz taktik değeri');
 return Object.fromEntries(Object.keys(DEFAULT_PLAN).map(k=>[k,p[k]]));
}
const cap=(x,a,b)=>Math.min(b,Math.max(a,x));
function next(state){state.rng=(Math.imul(state.rng,1664525)+1013904223)>>>0;return state.rng/4294967296;}
function pick(state,a){return a[Math.floor(next(state)*a.length)];}
const stat=(p,k)=>Number.isFinite(p.attributes?.[k])?p.attributes[k]:null;
function required(p,k){const v=stat(p,k);if(v===null)throw Error(`Eksik simülasyon özelliği: ${k}`);return v;}
export function beginMatch(home,away,seed,referee=1){
 const make=t=>({id:t.id,coach:t.coach,players:t.players.map(p=>({...p,energy:100,yellow:0,red:false})),goals:0,shots:0,onTarget:0,saves:0,xg:0,passes:0,completed:0,losses:0});
 return {version:1,rng:seed>>>0,minute:0,teams:[make(home),make(away)],events:[],half:0,referee,finished:false};
}
function alive(t){return t.players.filter(p=>!p.red);}
function keeper(t){return alive(t).find(p=>p.position==='GK')||alive(t).find(p=>p.id===t.emergencyKeeperId);}
function field(t){return alive(t).filter(p=>p.position!=='GK'&&p.id!==t.emergencyKeeperId);}
function shape(t,formation){
 const requiredRoles=formation.split('-').flatMap((n,i)=>Array(Number(n)).fill(['DEF','MID','ATT'][i]));
 const players=field(t);for(const p of players){delete p.matchRole;delete p.roleFit;}
 // First fill natural positions, then assign the remaining players to vacant jobs.
 for(const role of requiredRoles){const p=players.find(p=>!p.matchRole&&p.position===role);if(p){p.matchRole=role;p.roleFit=1;}}
 const vacancies=[...requiredRoles];for(const p of players.filter(p=>p.matchRole))vacancies.splice(vacancies.indexOf(p.matchRole),1);
 for(const p of players.filter(p=>!p.matchRole)){p.matchRole=vacancies.shift()||p.position;p.roleFit=.92;}
}
function selectPlayer(m,players,weights){const total=players.reduce((s,p)=>s+(weights[p.matchRole||p.position]||1),0);let draw=next(m)*total;return players.find(p=>(draw-=weights[p.matchRole||p.position]||1)<0)||players.at(-1);}
function coach(team,type){return team.coach?.specialty===type?cap(team.coach.stars,1,5)*.02:0;}
function effective(p,k){return required(p,k)*(0.8+0.2*p.energy/100)*(p.roleFit||1);}
function forceResult(m,loser){const other=m.teams[1-loser],team=m.teams[loser];if(other.goals-team.goals<=3){other.goals=3;team.goals=0;}m.finished=true;m.forfeit=team.id;m.events.push({minute:m.minute,type:'forfeit',team:team.id});}
export function simulateHalf(previous,plans){
 const m=structuredClone(previous);if(m.finished||m.half>=2)throw Error('Maç tamamlandı');
 const pp=plans.map(validatePlan);m.half++;
 if(m.half===2)for(const t of m.teams)for(const p of alive(t))p.energy=Math.min(100,p.energy+8);
 return simulatePeriod(m,pp,(m.half-1)*10,10,m.half===2);
}
function simulatePeriod(m,pp,start,duration,finished){
 for(let i=0;i<2;i++)shape(m.teams[i],pp[i].formation);
 let possession=next(m)<.5?0:1,zone=1;
 const end=start+duration;
 for(let tick=0;tick<duration*12&&!m.finished;tick++){
  m.minute=start+(tick+1)/12;
  const team=m.teams[possession],opp=m.teams[1-possession],plan=pp[possession],def=pp[1-possession];
  const attackers=field(team),defenders=field(opp);if(!attackers.length||!defenders.length)throw Error('Saha oyuncusu kalmadı');
  for(let side=0;side<2;side++)for(const p of alive(m.teams[side])){
   const cost=(.07+pp[side].tempo*.045+pp[side].press*.035)*(1-coach(m.teams[side],'press')*(pp[side].press===2));
   p.energy=Math.max(15,p.energy-cost*(1.5-required(p,'stamina')/100));
  }
  const actor=selectPlayer(m,attackers,zone===2?{ATT:4,MID:2,DEF:1}:zone===1?{MID:4,DEF:2,ATT:2}:{DEF:4,MID:2,ATT:1});
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
    if(zone===2&&next(m)<.2){shoot(m,possession,actor,pp,true);possession=1-possession;zone=0;}
    continue;
   }
   const win=cap(.30+(effective(marker,'standingTackle')-effective(actor,'ballControl'))*.006,.1,.7);
   if(next(m)<win){team.losses++;possession=1-possession;zone=plan.risk===2?1:0;continue;}
  }
  const shootChance=zone===2?.38+plan.risk*.08:zone===1?.025:0;
  if(next(m)<shootChance){shoot(m,possession,actor,pp);possession=1-possession;zone=0;continue;}
  team.passes++;
  const direct=plan.style==='direct',wide=plan.style==='wide',short=plan.style==='short';
  const passSkill=effective(actor,'shortPassing')*.65+effective(actor,'vision')*.35;
  const pressure=effective(marker,'interceptions')*.6+effective(marker,'defensiveAwareness')*.4;
  const midfield=attackers.filter(p=>p.matchRole==='MID').length-defenders.filter(p=>p.matchRole==='MID').length;
  const space=(attackers.length-defenders.length)*.025+midfield*.008+(wide&&def.width===0?.04:0);
  let chance=.77+(passSkill-pressure)*.004+space-plan.tempo*.025-def.press*.025-(direct?.12:0);
  chance+=short?coach(team,'passing')*.6:0;
  if(plan.style==='counter'&&zone<2)chance+=def.risk*.012+def.press*.012+coach(team,'transition')*.3;
  if(actor.overall<=81)chance+=coach(team,'development')*.3;
  if(direct&&def.press===2)chance+=.035;
  if(next(m)<cap(chance,.3,.95)){team.completed++;if(next(m)<(direct?.8:.48)+plan.tempo*.035)zone=Math.min(2,zone+1);}
  else{team.losses++;possession=1-possession;zone=plan.risk===2?1:0;}
 }
 m.minute=end;if(finished)m.finished=true;return m;
}
// Extra time reuses the same event model and current discipline/energy state.
export function resolveFinal(previous,plans){
 if(!previous.finished||previous.half!==2||previous.teams[0].goals!==previous.teams[1].goals||previous.forfeit)throw Error('Uzatma için berabere tamamlanmış final gerekli');
 let m=structuredClone(previous);const pp=plans.map(validatePlan);m.finished=false;
 m.events.push({minute:20,type:'extraTime'});
 m=simulatePeriod(m,pp,20,2,false);
 if(!m.finished)m=simulatePeriod(m,pp,22,2,true);
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
  const keeping=keeper?(required(keeper,'gkReflexes')+required(keeper,'gkPositioning'))/2:25;
  const probability=cap(.72+(required(actor,'penalties')-keeping)*.003,.4,.94);
  const scored=next(m)<probability;taken[side]++;goals[side]+=Number(scored);
  m.minute=24+(taken[0]+taken[1])*.5;
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
function shoot(m,side,actor,plans,penalty=false){
 const t=m.teams[side],opp=m.teams[1-side],goalkeeper=keeper(opp);
 // No factual outfield GK attributes are invented: 25 is the explicit emergency-keeper model.
 const keeping=goalkeeper?.position==='GK'?(required(goalkeeper,'gkReflexes')+required(goalkeeper,'gkPositioning'))/2:25;
 const defense=plans[1-side].risk===0?coach(opp,'defense')*.25:0;
 const attackRoles=field(t).filter(p=>p.matchRole==='ATT').length,defenseRoles=field(opp).filter(p=>p.matchRole==='DEF').length;
 const shotQuality=penalty?.72:cap(.13+plans[side].risk*.025+(field(t).length-field(opp).length)*.035+(attackRoles-defenseRoles)*.009-defense,.03,.45);
 const probability=cap(shotQuality+(required(actor,penalty?'penalties':'finishing')-keeping)*.003,.01,.94);
 t.shots++;t.xg+=probability;
 const draw=next(m);let type='shot';
 if(draw<probability){t.goals++;t.onTarget++;type='goal';}
 else if(draw<probability+(1-probability)*.45){t.onTarget++;opp.saves++;type='save';}
 m.events.push({minute:m.minute,type,penalty,team:t.id,playerId:actor.id,playerName:actor.name,xg:probability,score:m.teams.map(x=>x.goals)});
}
export function fixtures(ids){
 const ring=[...ids];if(ring.length%2)ring.push(null);const rounds=[];
 for(let r=0;r<ring.length-1;r++){const pairs=[];for(let i=0;i<ring.length/2;i++){const a=ring[i],b=ring.at(-1-i);if(a!==null&&b!==null)pairs.push([a,b]);}rounds.push(pairs);ring.splice(1,0,ring.pop());}return rounds;
}
