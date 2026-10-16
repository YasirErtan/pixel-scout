import {normalizeName} from './engine.js';
const normalizedNames=new WeakMap();
function forms(player){let values=normalizedNames.get(player);if(!values){values=[player.name,...(player.aliases||[])].map(normalizeName);normalizedNames.set(player,values);}return values;}
/** Search every registered squad member, including players without a game portrait. */
export function findPlayers(query,catalogue,excluded=[],limit=16){
  const q=normalizeName(query);if(!q)return {players:[],total:0};const ignored=new Set(excluded);
  const matches=catalogue.filter(p=>!ignored.has(p.id)).map(p=>{const names=forms(p);const rank=names.some(n=>n===q)?3:names.some(n=>n.startsWith(q))?2:names.some(n=>n.includes(q))?1:0;return {player:p,rank};}).filter(x=>x.rank);
  matches.sort((a,b)=>b.rank-a.rank||a.player.name.localeCompare(b.player.name,'tr'));
  return {players:matches.slice(0,limit).map(x=>x.player),total:matches.length};
}
