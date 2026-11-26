import test from 'node:test';
import assert from 'node:assert/strict';
import {matchScreen} from '../dist/games/transfer-arenasi/match-screen.js';
import {formationLimits} from '../dist/games/transfer-arenasi/formation.js';

const names = id => id === 't1' ? 'Anadolu Gücü' : 'Boğaz Yıldızı';

function baseRoom(matchOverrides = {}, roomOverrides = {}) {
 return {
  uid: 't1',
  phase: 'secondHalf',
  rulesVersion: 7,
  teams: [
   {id: 't1', name: 'Anadolu Gücü', players: []},
   {id: 't2', name: 'Boğaz Yıldızı', players: []},
  ],
  matches: [{
   teams: [
    {id: 't1', captainName: 'Emre <script>alert(1)</script>'},
    {id: 't2', captainName: 'Kerem "Kaptan"'},
   ],
   score: [1, 1],
   minute: 62,
   regulationMinutes: 90,
   events: [
    {type: 'shot', team: 't1', minute: 15, xg: 0.8},
    {type: 'goal', team: 't2', minute: 40, playerName: 'Kerem', xg: 1.4},
   ],
   snapshots: [{
    minute: 45,
    teams: [
     {id: 't1', possessionTicks: 52, passes: 25, completed: 20},
     {id: 't2', possessionTicks: 48, passes: 20, completed: 15},
    ],
   }],
   ...matchOverrides,
  }],
  ...roomOverrides,
 };
}

test('Maç ekranı kaptan adlarını ⓒ ile gösterir ve XSS kaçışı uygular', () => {
 const html = matchScreen(baseRoom(), names);
 assert.match(html, /class="ms-captain" title="Kaptan">ⓒ Emre &lt;script&gt;alert\(1\)&lt;\/script&gt;<\/span>/);
 assert.match(html, /class="ms-captain" title="Kaptan">ⓒ Kerem &quot;Kaptan&quot;<\/span>/);
 assert.doesNotMatch(html, /<script>/);
});

test('Maç ekranı xG değerlerini Türkçe virgüllü biçimde gösterir', () => {
 const html = matchScreen(baseRoom(), names);
 assert.match(html, /<b>0,8<\/b>/);
 assert.match(html, /<b>1,4<\/b>/);
 assert.doesNotMatch(html, /<b>0\.8<\/b>/);
 assert.doesNotMatch(html, /<b>1\.4<\/b>/);
});

test('Hükmen olaylı maçta Hükmen etiketi ve maç raporu oluşturulur', () => {
 const html = matchScreen(baseRoom({
  score: [3, 0],
  minute: 55,
  events: [
   {type: 'shot', team: 't1', minute: 10, xg: 0.4},
   {type: 'forfeit', team: 't2', minute: 55},
  ],
 }, {phase: 'secondHalf'}), names);
 assert.match(html, /<span class="ms-state">Hükmen<\/span>/);
 assert.match(html, /<details class="ms-report"/);
 assert.match(html, /class="match-report"/);
});

test('formationLimits geçersiz dizilişte public: true hatası fırlatır', () => {
 assert.throws(
  () => formationLimits('9-9-9'),
  err => err instanceof Error && err.message === 'Geçersiz diziliş' && err.public === true,
 );
});
