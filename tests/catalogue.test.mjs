import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {findPlayers} from '../dist/player-search.js';
import {createRound,submitGuess,validateRound} from '../dist/engine.js';
const data=JSON.parse(readFileSync(new URL('../dist/players.json',import.meta.url)));

test('target exclusions remain searchable in the unchanged full squad catalogue',()=>{assert.equal(data.players.length,125);for(const id of ['espn-401451','espn-303444','espn-250183','espn-198138','espn-388522','espn-167192','espn-238798']){assert.ok(data.searchPlayers.some(p=>p.id===id),id);assert.ok(!data.players.some(p=>p.id===id),id);}});
test('search catalogue traverses all78 Big4 club rosters without dropped teams or players',()=>{assert.equal(data.coverage.teamCount,78);assert.equal(data.coverage.completedTeamCount,78);assert.equal(data.coverage.teams.length,78);assert.equal(data.coverage.failures.length,0);assert.equal(data.searchPlayers.length,2329);assert.equal(new Set(data.searchPlayers.map(p=>p.id)).size,2329);assert.equal(data.coverage.teams.reduce((sum,t)=>sum+t.playerCount,0),2329);for(const [league,count]of Object.entries({PL:20,LaLiga:20,SerieA:20,Ligue1:18}))assert.equal(data.coverage.teams.filter(t=>t.league===league).length,count);});
test('every squad player can be found by full name even when absent from portrait selection',()=>{for(const p of data.searchPlayers){const found=findPlayers(p.name,data.searchPlayers,[],data.searchPlayers.length);assert.ok(found.players.some(x=>x.id===p.id),p.name);}assert.ok(data.searchPlayers.length>data.players.length);});
test('all portrait targets use the identical squad identity and clue values',()=>{for(const target of data.players){const p=data.searchPlayers.find(p=>p.id===target.id);assert.ok(p,target.name);for(const key of ['club','league','nationalityCode','position','birthDate','shirtNumber'])assert.equal(target[key],p[key],`${target.name}:${key}`);}});
test('guesses outside portrait pool survive saved-round validation and return clues',()=>{const ids=new Set(data.players.map(p=>p.id));const guess=data.searchPlayers.find(p=>!ids.has(p.id));const round=submitGuess(createRound(data.players[0].id),guess.id,data.searchPlayers,{asOf:data.snapshotDate});assert.equal(round.guessIds[0],guess.id);assert.equal(validateRound(round,data.searchPlayers).guessIds[0],guess.id);});
