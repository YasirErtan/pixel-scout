import {formationLimits} from './formation.js';

export function hasBidSlot(team,position){
 const limits=formationLimits(team.formation||'2-2-2');
 return team.players.filter(player=>player.position===position).length<limits[position];
}
