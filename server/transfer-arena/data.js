import {readFile} from 'node:fs/promises';
import {ATTRIBUTE_KEYS,PLAYER_ATTRIBUTES} from '../../dist/games/fut-draft/player-attributes.js';
import {COACHES} from './coaches.js';
let loaded;
export async function arenaData(){
 if(!loaded)loaded=readFile(new URL('../../dist/games/fut-draft/players.json',import.meta.url),'utf8').then(JSON.parse).then(data=>({
  players:data.players.filter(p=>PLAYER_ATTRIBUTES[p.id]?.length===ATTRIBUTE_KEYS.length).map(p=>({...p,attributes:Object.fromEntries(ATTRIBUTE_KEYS.map((k,i)=>[k,PLAYER_ATTRIBUTES[p.id][i]]))})),coaches:COACHES
 }));return loaded;
}
