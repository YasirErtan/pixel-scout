import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {hasBidSlot} from '../dist/games/transfer-arenasi/ui-rules.js';
import {playerCard,displayPosition} from '../dist/games/transfer-arenasi/cards.js';
import {squadBoard} from '../dist/games/transfer-arenasi/formation-board.js';
import {pitch} from '../dist/games/transfer-arenasi/pitch.js';
import {SEASON_TEAMS} from '../dist/games/fut-draft/season-data.js';

const team=(formation,positions)=>({formation,players:positions.map((position,id)=>({id,position}))});

test('auction UI slot checks follow the lobby formation',()=>{
 assert.equal(hasBidSlot(team('3-2-1',['DEF','DEF']), 'DEF'),true);
 assert.equal(hasBidSlot(team('3-2-1',['DEF','DEF','DEF']), 'DEF'),false);
 assert.equal(hasBidSlot(team('2-3-1',['MID','MID']), 'MID'),true);
 assert.equal(hasBidSlot(team('2-3-1',['MID','MID','MID']), 'MID'),false);
});

test('legacy teams without a saved formation keep the original slot defaults',()=>{
 assert.equal(hasBidSlot(team(null,['DEF','DEF']), 'DEF'),false);
 assert.equal(hasBidSlot(team(null,['ATT']), 'ATT'),true);
});

test('RM and LM positions are converted to RW and LW across datasets and UI renderers',()=>{
 const data=JSON.parse(fs.readFileSync(new URL('../dist/games/fut-draft/players.json',import.meta.url),'utf8'));
 assert.equal(data.players.filter(p=>p.detailPosition==='RM'||p.detailPosition==='LM').length,0);
 assert.equal(SEASON_TEAMS.flatMap(t=>t.roster).filter(p=>p.detailPosition==='RM'||p.detailPosition==='LM').length,0);

 const byId=Object.fromEntries(data.players.map(p=>[p.id,p]));
 assert.equal(byId[209331].detailPosition,'RW'); // Mohamed Salah
 assert.equal(byId[247827].detailPosition,'RW'); // Michael Olise
 assert.equal(byId[241084].detailPosition,'LW'); // Luis Diaz
 assert.equal(byId[210035].detailPosition,'LW'); // Grimaldo

 assert.equal(displayPosition({position:'ATT',detailPosition:'RM'}),'RW');
 assert.equal(displayPosition({position:'ATT',detailPosition:'LM'}),'LW');

 const legacyRm={id:209331,name:'Legacy RM',overall:87,position:'ATT',detailPosition:'RM',club:'Test',attributes:{finishing:80}};
 const legacyLm={id:241084,name:'Legacy LM',overall:88,position:'ATT',detailPosition:'LM',club:'Test',attributes:{finishing:80}};
 assert.ok(playerCard(legacyRm).includes('<span>RW</span>'));
 assert.ok(playerCard(legacyLm).includes('<span>LW</span>'));
 const boardHtml=squadBoard({id:'t1',name:'Test',formation:'2-2-2',players:[legacyRm,legacyLm],coach:null});
 assert.ok(boardHtml.includes('<i>RW</i>')&&boardHtml.includes('<i>LW</i>'));
 assert.ok(!boardHtml.includes('<i>RM</i>')&&!boardHtml.includes('<i>LM</i>'));
 const pitchHtml=pitch({id:'t1',name:'Test',players:[legacyRm,legacyLm,{id:1,name:'GK',position:'GK',detailPosition:'GK',attributes:{finishing:10}}]},'2-2-2');
 assert.ok(pitchHtml.includes('<small>RW')&&pitchHtml.includes('<small>LW'));
 assert.ok(!pitchHtml.includes('<small>RM')&&!pitchHtml.includes('<small>LM'));
});
