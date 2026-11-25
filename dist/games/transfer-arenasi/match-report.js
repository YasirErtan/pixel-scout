// Transfer Arenası: devre arası / maç sonu raporu (Model 6).
// Yalnız match.snapshots içinde istenen dakikaya kadar olan son kaydı ve o dakikaya kadar olan olayları kullanır.
import {escapeHTML} from './cards.js';
import {logoSVG} from './logos.js';

const num=v=>Number.isFinite(v)?v:0;
const fmt1=v=>(Math.round(v*10)/10).toFixed(1).replace('.',',');
const pct=(a,b)=>b>0?Math.round(a/b*100):null;
const pctText=v=>v===null?'—':`%${v}`;
const POS_LABEL={GK:'KL',DEF:'DF',MID:'OS',ATT:'FV'};

// Not formülü (6,0–10,0). Ayrıntı: dosya sonundaki PLAYER_RATING_FORMULA açıklaması.
export const PLAYER_RATING_FORMULA='6,5 taban; gol +1,2; asist +0,7; kilit pas +0,25; isabetli şut +0,15 (diğer şut +0,05); '+
 'top kapma ve araya girme +0,15 (defans x1,3); kurtarış +0,35 (kaleci); pas isabeti ±0,3; faul -0,1; sarı -0,4; kırmızı -1,5; '+
 'takım sonucu galibiyet +0,4 / beraberlik +0,1 / mağlubiyet -0,2; yenilen gol kaleci -0,35, defans -0,2, orta saha -0,05 (gol yenmediyse +0,6 / +0,4 / +0,1); 6,0–10,0 arasına sıkıştırılır.';

export function ratePlayer(s,pos,{result=0,conceded=0}={}){
 let r=6.5;
 const defender=pos==='DEF';
 r+=num(s.goals)*1.2+num(s.assists)*0.7+num(s.keyPasses)*0.25;
 const onT=num(s.onTarget),shots=Math.max(num(s.shots),onT);
 r+=onT*0.15+(shots-onT)*0.05;
 r+=(num(s.tackles)+num(s.interceptions))*0.15*(defender?1.3:1);
 if(pos==='GK')r+=num(s.saves)*0.35;
 if(num(s.passes)>=5){const acc=num(s.completed)/num(s.passes);r+=Math.max(-0.3,Math.min(0.3,(acc-0.75)*1.2));}
 r-=num(s.fouls)*0.1+num(s.yellow)*0.4+num(s.red)*1.5;
 r+=result>0?0.4:result===0?0.1:-0.2;
 const per=pos==='GK'?[0.35,0.6]:defender?[0.2,0.4]:pos==='MID'?[0.05,0.1]:[0,0];
 r-=conceded*per[0];
 if(conceded===0)r+=per[1];
 return Math.round(Math.max(6,Math.min(10,r))*10)/10;
}

function pickSnapshot(match,minute){
 const list=Array.isArray(match?.snapshots)?match.snapshots:[];
 let best=null;
 for(const s of list)if(s&&Array.isArray(s.teams)&&s.teams.length>=2&&num(s.minute)<=minute+1e-9&&(!best||s.minute>=best.minute))best=s;
 return best;
}

function teamHTML(team,fallbackId){
 const name=team?.name?escapeHTML(team.name):escapeHTML(fallbackId||'Takım');
 return `${team?.logo?logoSVG(team.logo,18)+' ':''}<span class="mr-team-name">${name}</span>`;
}

// Kadro: önce maç nesnesi (tam simülasyon), sonra takım listesi; ikisi de yoksa snapshot + olaylardan çıkarılır.
function roster(match,teams,side,snapTeam,events){
 const id=snapTeam.id;
 const src=(match?.teams?.[side]?.players)||(teams||[]).find(t=>t?.id===id)?.players;
 const out=new Map();
 if(Array.isArray(src))for(const p of src)if(p&&p.id!=null)out.set(String(p.id),{id:p.id,name:p.name||'',position:p.position||''});
 for(const key of Object.keys(snapTeam.players||{}))if(!out.has(key))out.set(key,{id:key,name:'',position:''});
 for(const e of events){
  for(const [pid,pname] of [[e.playerId,e.playerName],[e.assisterId,e.assisterName]]){
   if(pid==null||e.team!==id)continue;
   const k=String(pid),cur=out.get(k);
   if(cur&&!cur.name&&pname)cur.name=pname;
   else if(!cur&&pname)out.set(k,{id:pid,name:pname,position:''});
  }
 }
 return [...out.values()];
}

function playerStats(p,snapTeam,teamEvents,teamId,isGK,savesFallback){
 const s={...(snapTeam.players?.[p.id]||snapTeam.players?.[String(p.id)]||{})};
 const mine=teamEvents.filter(e=>e.team===teamId&&String(e.playerId)===String(p.id));
 const count=(...types)=>mine.filter(e=>types.includes(e.type)).length;
 // Sayaçlar boş/eksikse olay günlüğünden türetilir; ikisinden büyüğü alınır.
 const m=(k,v)=>{s[k]=Math.max(num(s[k]),v);};
 m('goals',count('goal'));m('shots',count('goal','shot','save','post'));m('onTarget',count('goal','save'));
 m('fouls',count('foul'));m('yellow',count('yellow'));m('red',count('red'));
 m('assists',teamEvents.filter(e=>e.team===teamId&&e.type==='goal'&&String(e.assisterId)===String(p.id)).length);
 if(isGK)m('saves',savesFallback);
 return s;
}

export function matchReport(match,teams=[],{minute=Infinity}={}){
 try{
  const snap=pickSnapshot(match,Number.isFinite(minute)?minute:Infinity);
  if(!snap)return '';
  const events=(Array.isArray(match.events)?match.events:[]).filter(e=>e&&num(e.minute)<=snap.minute+1e-9);
  const [A,B]=snap.teams;
  const sides=[A,B].map((t,i)=>({snap:t,info:(teams||[]).find(x=>x?.id===t.id)||match.teams?.[i]||{id:t.id}}));
  const goals=sides.map(s=>num(s.snap.goals));
  const final=snap.minute>=90;
  const title=final?'Maç sonu raporu':snap.minute<=45?'Devre arası raporu':`Maç raporu · ${Math.floor(snap.minute)}. dakika`;
  const ticks=sides.map(s=>num(s.snap.possessionTicks)),tickSum=ticks[0]+ticks[1];
  const poss=tickSum>0?[Math.round(ticks[0]/tickSum*100),0]:[null,null];
  if(poss[0]!==null)poss[1]=100-poss[0];
  const cards=sides.map(s=>({
   y:events.filter(e=>e.team===s.snap.id&&e.type==='yellow').length,
   r:events.filter(e=>e.team===s.snap.id&&e.type==='red').length
  }));
  const rows=[
   ['Topa sahip olma',poss.map(pctText),poss.map(v=>v??0)],
   ['Şut',sides.map(s=>String(num(s.snap.shots))),sides.map(s=>num(s.snap.shots))],
   ['İsabetli şut',sides.map(s=>String(num(s.snap.onTarget))),sides.map(s=>num(s.snap.onTarget))],
   ['xG (beklenen gol)',sides.map(s=>fmt1(num(s.snap.xg))),sides.map(s=>num(s.snap.xg))],
   ['Pas isabeti',sides.map(s=>pctText(pct(num(s.snap.completed),num(s.snap.passes)))),sides.map(s=>pct(num(s.snap.completed),num(s.snap.passes))??0)],
   ['Sarı kart',cards.map(c=>String(c.y)),cards.map(c=>c.y)],
   ['Kırmızı kart',cards.map(c=>String(c.r)),cards.map(c=>c.r)]
  ];
  const bar=(v,pair)=>{const t=pair[0]+pair[1];return `<span class="mr-bar" aria-hidden="true"><i style="width:${t>0?Math.round(v/t*100):0}%"></i></span>`;};
  const statRows=rows.map(([label,text,raw])=>`<tr><th scope="row">${label}</th><td>${bar(raw[0],raw)}<b>${text[0]}</b></td><td>${bar(raw[1],raw)}<b>${text[1]}</b></td></tr>`).join('');

  // Oyuncu notları
  const rated=sides.map((s,i)=>{
   const result=Math.sign(goals[i]-goals[1-i]),conceded=goals[1-i];
   return roster(match,teams,i,s.snap,events).map(p=>{
    const st=playerStats(p,s.snap,events,s.snap.id,p.position==='GK',num(s.snap.saves));
    return {...p,side:i,stats:st,rating:ratePlayer(st,p.position,{result,conceded})};
   });
  });
  const all=rated.flat();
  const mom=all.slice().sort((a,b)=>b.rating-a.rating||(num(b.stats.goals)+num(b.stats.assists))-(num(a.stats.goals)+num(a.stats.assists))||(Math.sign(goals[b.side]-goals[1-b.side])-Math.sign(goals[a.side]-goals[1-a.side]))||String(a.id).localeCompare(String(b.id)))[0];
  const nameOf=p=>p.name?escapeHTML(p.name):'Bilinmeyen oyuncu';
  const sideName=i=>teamHTML(sides[i].info,sides[i].snap.id);
  const allIn=sides.map(s=>Boolean(s.snap.allIn)||events.some(e=>e.type==='allIn'&&e.team===s.snap.id));
  const badges=sides.map((s,i)=>allIn[i]?`<li class="mr-badge">🔥 ${sideName(i)}: tüm riskleri aldı</li>`:'').join('');
  const summary=p=>{
   const parts=[];const g=num(p.stats.goals),a=num(p.stats.assists),sv=num(p.stats.saves);
   if(g)parts.push(`${g} gol`);if(a)parts.push(`${a} asist`);if(p.position==='GK'&&sv)parts.push(`${sv} kurtarış`);
   if(num(p.stats.yellow))parts.push('sarı kart');if(num(p.stats.red))parts.push('kırmızı kart');
   return parts.join(', ')||'—';
  };
  const tables=rated.map((list,i)=>{
   const body=list.slice().sort((a,b)=>b.rating-a.rating||String(a.id).localeCompare(String(b.id))).map(p=>{
    const star=mom&&mom.id===p.id&&mom.side===i;
    return `<tr${star?' class="mr-mom"':''}><th scope="row">${star?'<span aria-hidden="true">★</span><span class="mr-sr">Maçın adamı: </span>':''}${nameOf(p)}</th><td>${POS_LABEL[p.position]||'—'}</td><td class="mr-sum">${summary(p)}</td><td class="mr-note"><b>${fmt1(p.rating)}</b></td></tr>`;
   }).join('');
   return `<div class="mr-table-wrap"><table class="mr-players"><caption>${sideName(i)} oyuncu notları</caption><thead><tr><th scope="col">Oyuncu</th><th scope="col">Mevki</th><th scope="col">Özet</th><th scope="col">Not</th></tr></thead><tbody>${body||'<tr><td colspan="4">Oyuncu verisi yok</td></tr>'}</tbody></table></div>`;
  }).join('');
  const momHTML=mom?`<p class="mr-mom-box"><span aria-hidden="true">⭐</span> <strong>${final?'Maçın adamı':'Devrenin adamı'}:</strong> ${nameOf(mom)} <span class="mr-muted">(${sideName(mom.side)})</span> · <b>${fmt1(mom.rating)}</b></p>`:'';
  const pens=final&&match.shootout?.score&&snap===match.snapshots.reduce((m,x)=>x.minute>=m.minute?x:m)?` <small class="mr-pens">Penaltılar ${num(match.shootout.score[0])}:${num(match.shootout.score[1])}</small>`:'';
  return `<section class="match-report" aria-label="${title}">
<h4 class="mr-title">${title}</h4>
<p class="mr-score" aria-label="Skor">${sideName(0)} <strong>${goals[0]} : ${goals[1]}</strong> ${sideName(1)}${pens}</p>
${badges?`<ul class="mr-badges" aria-label="Tüm riskleri al seçimi">${badges}</ul>`:''}
<table class="mr-stats"><caption class="mr-sr">Takım istatistikleri</caption><thead><tr><th scope="col"><span class="mr-sr">İstatistik</span></th><th scope="col">${sideName(0)}</th><th scope="col">${sideName(1)}</th></tr></thead><tbody>${statRows}</tbody></table>
${momHTML}
${tables}
</section>`;
 }catch{
  return '';
 }
}
