// Tüm odaların ortak şampiyon listesi. Oturum kimliği, oda kodu ve taktik gibi özel veriler dışarı verilmez.
export const CHAMPION_LIMIT=50;

function goalLeader(room){
 const rows=new Map();
 for(const match of [...(room.results||[]).flat(),...(room.matches||[])])for(const event of match.events||[]){
  if(event.type!=='goal')continue;
  const key=JSON.stringify([event.team,event.playerId]);
  const row=rows.get(key)||{name:event.playerName,goals:0};row.goals++;rows.set(key,row);
 }
 return [...rows.values()].sort((a,b)=>b.goals-a.goals||String(a.name).localeCompare(String(b.name),'tr'))[0]||null;
}

export function championEntry(room,now){
 const match=room.matches?.[0];
 if(room.phase!=='finished'||!room.final||!room.champion||!match)return null;
 const winnerSide=match.teams.findIndex(team=>team.id===room.champion);
 if(winnerSide<0)return null;
 const loserSide=1-winnerSide,team=id=>room.teams.find(item=>item.id===id);
 const winner=team(room.champion),runnerUp=team(match.teams[loserSide].id),leader=goalLeader(room);
 return {
  key:room.id+':'+room.createdAt,finishedAt:now,teamCount:room.teams.length,
  champion:{name:winner.name,logo:winner.logo||null,coach:winner.coach?.name||null},
  runnerUp:{name:runnerUp?.name||'—',logo:runnerUp?.logo||null},
  score:[match.teams[winnerSide].goals,match.teams[loserSide].goals],
  shootout:match.shootout?[match.shootout.score[winnerSide],match.shootout.score[loserSide]]:null,
  topScorer:leader
 };
}

// Aynı oda iki kez yazılmaz; en yeni kayıtlar başta tutulur.
export function addChampion(list,entry){
 const current=Array.isArray(list)?list:[];
 if(current.some(item=>item.key===entry.key))return current;
 return [entry,...current].slice(0,CHAMPION_LIMIT);
}

export const publicChampions=list=>(Array.isArray(list)?list:[]).map(({key,...entry})=>entry);
