import {random,shuffle} from './market.js';

// A seeded draw is published only for teams still level after the mini league.
export function standings(teams,rounds,seed){
 const draw=shuffle(teams.map(t=>t.id).sort(),random(seed));
 const base=(a,b)=>b.points-a.points||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf||b.wins-a.wins;
 const sorted=teams.toSorted(base),ranked=[],draws=[];
 for(let i=0;i<sorted.length;){
  let end=i+1;while(end<sorted.length&&base(sorted[i],sorted[end])===0)end++;
  const group=sorted.slice(i,end),ids=new Set(group.map(t=>t.id));
  const mini=new Map(group.map(t=>[t.id,{points:0,gf:0,ga:0,wins:0}]));
  for(const m of rounds.flat())if(m.teams.every(t=>ids.has(t.id))){
   for(let side=0;side<2;side++){
    const a=m.teams[side],b=m.teams[1-side],row=mini.get(a.id);
    row.gf+=a.goals;row.ga+=b.goals;row.points+=a.goals>b.goals?3:a.goals===b.goals?1:0;row.wins+=Number(a.goals>b.goals);
   }
  }
  group.sort((a,b)=>base(mini.get(a.id),mini.get(b.id))||draw.indexOf(a.id)-draw.indexOf(b.id));
  for(let j=0;j<group.length;){
   let k=j+1;while(k<group.length&&base(mini.get(group[j].id),mini.get(group[k].id))===0)k++;
   if(k-j>1)draws.push(group.slice(j,k).map(t=>t.id));j=k;
  }
  ranked.push(...group);i=end;
 }
 return {teams:ranked,draws};
}
