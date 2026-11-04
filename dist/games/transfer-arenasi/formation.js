// Shared by the pitch preview and server match roles; natural positions fill first.
export function assignFormation(players,formation){
 const roles=formation.split('-').flatMap((n,i)=>Array(Number(n)).fill(['DEF','MID','ATT'][i]));
 const assigned=players.map(p=>({...p,matchRole:null,roleFit:1}));
 for(const role of roles){const p=assigned.find(p=>!p.matchRole&&p.position===role);if(p)p.matchRole=role;}
 const vacancies=[...roles];for(const p of assigned.filter(p=>p.matchRole))vacancies.splice(vacancies.indexOf(p.matchRole),1);
 for(const p of assigned.filter(p=>!p.matchRole)){p.matchRole=vacancies.shift()||p.position;p.roleFit=.92;}
 return assigned;
}
