export const FORMATIONS = Object.freeze(['2-2-2', '2-3-1', '3-2-1', '1-3-2']);

export function formationLimits(formation) {
 if (!FORMATIONS.includes(formation)) throw Object.assign(Error('Geçersiz diziliş'),{public:true});
 const [DEF, MID, ATT] = formation.split('-').map(Number);
 return {GK:1,DEF,MID,ATT};
}

// Shared by the pitch preview and server match roles; natural positions fill first.
export function assignFormation(players,formation){
 const roles=formation.split('-').flatMap((n,i)=>Array(Number(n)).fill(['DEF','MID','ATT'][i]));
 const assigned=players.map(p=>({...p,matchRole:null,roleFit:1}));
 for(const role of roles){const p=assigned.find(p=>!p.matchRole&&p.position===role);if(p)p.matchRole=role;}
 const vacancies=[...roles];for(const p of assigned.filter(p=>p.matchRole))vacancies.splice(vacancies.indexOf(p.matchRole),1);
 for(const p of assigned.filter(p=>!p.matchRole)){p.matchRole=vacancies.shift()||p.position;p.roleFit=.92;}
 return assigned;
}
