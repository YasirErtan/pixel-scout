import test from 'node:test';import assert from 'node:assert/strict';
import {standings} from '../server/transfer-arena/standings.js';
const row=id=>({id,points:4,gf:4,ga:4,wins:1});
test('mini league resolves otherwise equal teams before seeded draw',()=>{
 const teams=['a','b','c'].map(row);
 const result=standings(teams,[[{teams:[{id:'b',goals:2},{id:'a',goals:0}]}]],81);
 assert.deepEqual(result.teams.map(t=>t.id),['b','c','a']);assert.deepEqual(result.draws,[]);
});
test('unresolved ties expose a reproducible draw independent of input order',()=>{
 const teams=['a','b','c'].map(row),first=standings(teams,[],13);
 assert.deepEqual(first,standings(teams,[],13));assert.equal(first.draws[0].length,3);
 assert.deepEqual(first,standings([...teams].reverse(),[],13));
 assert.deepEqual(teams.map(t=>t.id),['a','b','c']);
});
