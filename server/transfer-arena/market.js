import {BONUS_PLAYER} from '../../dist/games/transfer-arenasi/bonus-player.js';
import {LEGENDS} from './legends.js';
import {LEGEND_PORTRAITS} from '../../dist/games/transfer-arenasi/legend-portraits.js';
export const LIMITS = Object.freeze({GK:1,DEF:2,MID:2,ATT:2});
export function random(seed) { let n=seed>>>0; return ()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;}; }
export function shuffle(items,next) {const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(next()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export function slots(team) {return 8-team.players.length-(team.coach?1:0);}
export function maximum(team) {return team.balance-(slots(team)-1);}
export function eligible(team,card) {return card.kind==='coach'?!team.coach:team.players.filter(p=>p.position===card.position).length<LIMITS[card.position];}
export function award(team,card,amount,automatic=false) {
  if(!Number.isSafeInteger(amount)||amount<1||amount>maximum(team)||!eligible(team,card))throw Error('Geçersiz transfer');
  team.balance-=amount;
  if(card.kind==='coach')team.coach={...card,price:amount,automatic};
  else team.players.push({...card,price:amount,automatic});
}
export function openLot(card,now,id) {return {id,card,deadline:now+12000,hardDeadline:now+24000,amount:0,bidder:null,passed:[]};}
export function bid(lot,team,amount,now,lotId) {
  if(lotId!==lot.id||now>=lot.deadline)throw Error('Bu ihale kapandı');
  if(lot.passed.includes(team.id)||lot.bidder===team.id)throw Error('Bu teklif verilemez');
  if(!Number.isSafeInteger(amount)||amount<=lot.amount||amount<1||amount>maximum(team)||!eligible(team,lot.card))throw Error('Bütçe veya mevki uygun değil');
  lot.amount=amount;lot.bidder=team.id;
  lot.deadline=Math.min(lot.hardDeadline,Math.max(lot.deadline,now+3000));
}
export function settle(lot,teams,pool) {if(lot.bidder)award(teams.find(t=>t.id===lot.bidder),lot.card,lot.amount);else pool.push(lot.card);}
export function completePool(teams,pool,next) {
  // Alternate weaker and stronger cards; only automatic allocations affect priority.
  // Capacity per role is invariant, so no card can become unassignable.
  const remaining=pool.slice().sort((a,b)=>(a.overall??a.stars)-(b.overall??b.stars));
  const quality=new Map(teams.map(t=>[t.id,[]]));let weak=true;
  while(remaining.length){
    const card=weak?remaining.shift():remaining.pop();
    let candidates=shuffle(teams.filter(t=>eligible(t,card)),next);
    if(!candidates.length)throw Error('Pazar ve kadro slotları uyuşmuyor');
    const avg=t=>{const a=quality.get(t.id);return a.length?a.reduce((s,x)=>s+x,0)/a.length:77;};
    candidates.sort((a,b)=>weak?avg(b)-avg(a):avg(a)-avg(b));
    const winner=candidates[0];award(winner,card,1,true);quality.get(winner.id).push(card.overall??card.stars);weak=!weak;
  }
}
export function selectCoaches(coaches,count,next){
  if(!Number.isInteger(count)||count<3||count>6)throw Error('3–6 takım gerekli');
  const groups=new Map([1,2,3,4,5].map(stars=>[stars,shuffle(coaches.filter(c=>c.stars===stars),next)]));
  const levels=shuffle([...groups.keys()].filter(stars=>groups.get(stars).length),next);
  if(levels.length<Math.min(count,5))throw Error('Hoca yıldız seviyeleri yetersiz');
  const selected=levels.slice(0,Math.min(count,5)).map(stars=>groups.get(stars).pop());
  if(count===6){
    const extraLevels=levels.filter(stars=>groups.get(stars).length);
    if(!extraLevels.length)throw Error('Altıncı hoca için havuz yetersiz');
    selected.push(groups.get(extraLevels[Math.floor(next()*extraLevels.length)]).pop());
  }
  return shuffle(selected,next).map(c=>({...c,kind:'coach'}));
}
export function makeMarket(players,coaches,count,next,{bonusEnabled=false}={}) {
  if(!Number.isInteger(count)||count<3||count>6)throw Error('3–6 takım gerekli');
  const market=[],remaining=Object.fromEntries(Object.entries(LIMITS).map(([role,n])=>[role,n*count]));
  const legend=LEGENDS[Math.floor(next()*LEGENDS.length)];
  market.push({...legend,attributes:{...legend.attributes},portraitURL:LEGEND_PORTRAITS[legend.id]?.path,kind:'player'});remaining[legend.position]--;
  if(bonusEnabled){market.push({...BONUS_PLAYER,attributes:{...BONUS_PLAYER.attributes},kind:'player'});remaining.ATT--;}
  const bands=[[70,75],[76,81],[82,87],[88,100]].map(([lo,hi])=>Object.fromEntries(Object.keys(LIMITS).map(role=>[role,shuffle(players.filter(p=>p.position===role&&p.overall>=lo&&p.overall<=hi),next)])));
  // Exact whole-market mix, without dictating any team's share of weak or elite cards.
  // Reserve the scarce elite cards first. The shipped snapshot has ample lower bands.
  for(const index of [3,2,1,0])for(let i=0;i<count*(index===3?1:2)-Number(index===3)-Number(bonusEnabled&&index===0);i++){
    const candidates=Object.keys(LIMITS).flatMap(role=>bands[index][role].length?Array(remaining[role]).fill(role):[]);
    if(!candidates.length)throw Error('Mevki ve kalite havuzu yetersiz');
    const role=candidates[Math.floor(next()*candidates.length)],p=bands[index][role].pop();
    remaining[role]--;market.push({...p,kind:'player'});
  }
  if(coaches.length<count)throw Error('Hoca havuzu yetersiz');
  return {players:shuffle(market,next),coaches:selectCoaches(coaches,count,next)};
}
