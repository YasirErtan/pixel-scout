import test from 'node:test';
import assert from 'node:assert/strict';
import {hasBidSlot} from '../dist/games/transfer-arenasi/ui-rules.js';

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
