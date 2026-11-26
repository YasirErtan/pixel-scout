import test from 'node:test';
import assert from 'node:assert/strict';
import {beginMatch, simulateSegment} from '../server/transfer-arena/simulation.js';
import {command, advance, publicView} from '../server/transfer-arena/room.js';

// Hükmen testleri için deterministik düşük müdahale puanlı kadro üreteci
function testAttrs(gk){
 return {
  sprintSpeed: 60, stamina: 60, standingTackle: 10, ballControl: 60,
  shortPassing: 60, vision: 60, composure: 60, interceptions: 50,
  defensiveAwareness: 50, positioning: 60, finishing: 60, shotPower: 60,
  penalties: 60, gkReflexes: gk ? 70 : 20, gkPositioning: gk ? 70 : 20, gkDiving: gk ? 70 : 20
 };
}

function makeTeam(id){
 return {
  id, name: id, balance: 0, coach: null, formation: '2-2-2',
  logo: 'lion', ready: true, points: 0, gf: 0, ga: 0, wins: 0,
  players: [
   {id: id + 'g', name: 'GK', position: 'GK', detailPosition: 'GK', overall: 72, attributes: testAttrs(true)},
   {id: id + 'd1', name: 'D1', position: 'DEF', detailPosition: 'CB', overall: 72, attributes: testAttrs(false)},
   {id: id + 'd2', name: 'D2', position: 'DEF', detailPosition: 'CB', overall: 72, attributes: testAttrs(false)},
   {id: id + 'm1', name: 'M1', position: 'MID', detailPosition: 'CM', overall: 72, attributes: testAttrs(false)},
   {id: id + 'm2', name: 'M2', position: 'MID', detailPosition: 'CM', overall: 72, attributes: testAttrs(false)},
   {id: id + 'a1', name: 'A1', position: 'ATT', detailPosition: 'ST', overall: 72, attributes: testAttrs(false)},
   {id: id + 'a2', name: 'A2', position: 'ATT', detailPosition: 'ST', overall: 72, attributes: testAttrs(false)}
  ]
 };
}

const HARSH_PLAN = {formation: '2-2-2', style: 'short', press: 2, risk: 1, tempo: 2, width: 1, tackle: 3, captainId: null};

function makeRoom({teamIds, seed, schedule, final = false, finalists = [], now = 1_700_000_000_000}){
 return {
  id: '123456',
  owner: teamIds[0],
  seed,
  rulesVersion: 7,
  playbackSpeed: 1,
  assignments: [],
  createdAt: now,
  options: {bonusEnabled: false, bonusCardsEnabled: false},
  phase: 'prepare',
  version: 1,
  phaseVersion: 1,
  deadline: now + 180000,
  teams: teamIds.map(makeTeam),
  requests: [],
  history: [],
  pool: [],
  lotIndex: 0,
  plans: {},
  matches: [],
  results: [],
  schedule,
  round: 0,
  final,
  finalists
 };
}

test('Model 7 simulateSegment hükmen maçlarda m.minute değerini dilim sonuyla ezmez ve snapshot gerçek dakikayı kaydeder', () => {
 // 0–45 dilimi hükmen tohumu (100445 -> 35.25)
 const m1 = simulateSegment(
  beginMatch(makeTeam('A'), makeTeam('B'), 100445, 100445 % 3, {version: 7, neutral: true}),
  [HARSH_PLAN, HARSH_PLAN],
  {start: 0, end: 45}
 );
 assert.equal(m1.finished, true);
 assert.equal(m1.forfeit, 'A');
 assert.ok(m1.minute < 45, `m.minute 45ten küçük olmalı, gelen: ${m1.minute}`);
 assert.equal(m1.snapshots.at(-1).minute, m1.minute);

 // 45–70 dilimi hükmen tohumu (101867 -> 62.91...)
 let m2 = simulateSegment(
  beginMatch(makeTeam('A'), makeTeam('B'), 101867, 101867 % 3, {version: 7, neutral: true}),
  [HARSH_PLAN, HARSH_PLAN],
  {start: 0, end: 45}
 );
 assert.equal(m2.finished, false);
 m2 = simulateSegment(m2, [HARSH_PLAN, HARSH_PLAN], {start: 45, end: 70});
 assert.equal(m2.finished, true);
 assert.ok(m2.minute > 45 && m2.minute < 70);
 assert.equal(m2.snapshots.at(-1).minute, m2.minute);

 // 70–90 dilimi hükmen tohumu (100778 -> 89.62...)
 let m3 = simulateSegment(
  beginMatch(makeTeam('A'), makeTeam('B'), 100778, 100778 % 3, {version: 7, neutral: true}),
  [HARSH_PLAN, HARSH_PLAN],
  {start: 0, end: 45}
 );
 m3 = simulateSegment(m3, [HARSH_PLAN, HARSH_PLAN], {start: 45, end: 70});
 assert.equal(m3.finished, false);
 m3 = simulateSegment(m3, [HARSH_PLAN, HARSH_PLAN], {start: 70, end: 90});
 assert.equal(m3.finished, true);
 assert.ok(m3.minute > 70 && m3.minute < 90);
 assert.equal(m3.snapshots.at(-1).minute, m3.minute);
});

test('3 takımlı odada ilk yarıda hükmen biten lig maçı halftime/secondHalf açmadan sonraki tura geçer', () => {
 const now = 1_700_000_000_000;
 let room = makeRoom({
  teamIds: ['A', 'B', 'C'],
  seed: 100445, // matchSeed(0) = 100445 -> 0–45 hükmen
  schedule: [[['A', 'B']], [['B', 'C']], [['C', 'A']]],
  now
 });

 room = command(room, 'A', {type: 'plan', phaseVersion: 1, plan: HARSH_PLAN, requestId: 'pA'}, now);
 room = command(room, 'B', {type: 'plan', phaseVersion: 1, plan: HARSH_PLAN, requestId: 'pB'}, now);

 assert.equal(room.phase, 'firstHalf');
 assert.equal(room.matches[0].finished, true);
 assert.ok(room.matches[0].forfeit);
 assert.equal(room.playbackEnd, room.matches[0].minute);
 assert.ok(room.playbackEnd < 45);

 // Bitiş anına gelince devre arası veya 2. yarıya girmeden doğrudan 2. haftaya (prepare) geçer
 room = advance(room, room.deadline);
 assert.equal(room.phase, 'prepare');
 assert.equal(room.round, 1);
 assert.equal(room.teams.find(t => t.id === 'B').points, 3);
 assert.equal(room.teams.find(t => t.id === 'A').points, 0);
});

test('3 takımlı odada final maçı ilk yarıda hükmen biterse devre arasına girmeden doğrudan finished olur', () => {
 const now = 1_700_000_000_000;
 // finalde matchSeed = seed + round*719 + 100003; round=0 için 100445 - 100003 = 442
 let room = makeRoom({
  teamIds: ['A', 'B', 'C'],
  seed: 442,
  schedule: [[['A', 'B']], [['B', 'C']], [['C', 'A']]],
  final: true,
  finalists: ['A', 'B'],
  now
 });

 room = command(room, 'A', {type: 'plan', phaseVersion: 1, plan: HARSH_PLAN, requestId: 'pA'}, now);
 room = command(room, 'B', {type: 'plan', phaseVersion: 1, plan: HARSH_PLAN, requestId: 'pB'}, now);

 assert.equal(room.phase, 'firstHalf');
 assert.equal(room.playbackEnd, room.matches[0].minute);
 assert.ok(room.playbackEnd < 45);

 room = advance(room, room.deadline);
 assert.equal(room.phase, 'finished');
 assert.equal(room.champion, 'B');
});

test('4 takımlı haftada 1 maç hükmen biterken diğeri devam ederse halftime yalnız devam eden maçı bekler', () => {
 const now = 1_700_000_000_000;
 // i=0: 100445 (0–45 hükmen), i=1: 100445 + 31 = 100476 (0–45 devam eder)
 let room = makeRoom({
  teamIds: ['A', 'B', 'C', 'D'],
  seed: 100445,
  schedule: [[['A', 'B'], ['C', 'D']], [['A', 'C'], ['B', 'D']], [['A', 'D'], ['B', 'C']]],
  now
 });

 for (const id of ['A', 'B', 'C', 'D']) {
  room = command(room, id, {type: 'plan', phaseVersion: 1, plan: HARSH_PLAN, requestId: 'p1_' + id}, now);
 }

 assert.equal(room.phase, 'firstHalf');
 assert.equal(room.matches[0].finished, true);
 assert.equal(room.matches[1].finished, false);
 assert.equal(room.playbackEnd, 45);

 // İlk yarı bitince diğer maç nedeniyle devre arası açılır
 room = advance(room, room.deadline);
 assert.equal(room.phase, 'halftime');

 // Hükmen biten maçın oyuncuları için upcomingMatch bye: true döner ve plan kilitleyemezler
 const viewA = publicView(room, 'A', room.deadline - 1000);
 const viewC = publicView(room, 'C', room.deadline - 1000);
 assert.equal(viewA.nextMatch.bye, true);
 assert.equal(viewA.nextMatch.opponentId, null);
 assert.equal(viewC.nextMatch.bye, false);
 assert.equal(viewC.nextMatch.opponentId, 'D');

 assert.throws(
  () => command(room, 'A', {type: 'plan', phaseVersion: room.phaseVersion, plan: HARSH_PLAN, requestId: 'ht_A'}, now + 35000),
  err => err.public === true && err.message === 'Bu hafta maçın yok'
 );

 // Yalnızca devam eden C–D maçının takımları kilitleyince secondHalf başlar
 const htNow = room.deadline - 1000;
 room = command(room, 'C', {type: 'plan', phaseVersion: room.phaseVersion, plan: HARSH_PLAN, requestId: 'ht_C'}, htNow);
 assert.equal(room.phase, 'halftime');
 room = command(room, 'D', {type: 'plan', phaseVersion: room.phaseVersion, plan: HARSH_PLAN, requestId: 'ht_D'}, htNow);
 assert.equal(room.phase, 'secondHalf');
 assert.equal(room.matches[0].finished, true);
});

test('3 takımlı odada ikinci yarı (45–70 ve 70–90) hükmen bittiğinde playbackEnd erken kesilir', () => {
 const now = 1_700_000_000_000;

 // 45–70 hükmen (seed: 101867)
 let rMid = makeRoom({
  teamIds: ['A', 'B', 'C'],
  seed: 101867,
  schedule: [[['A', 'B']], [['B', 'C']], [['C', 'A']]],
  now
 });
 rMid = command(rMid, 'A', {type: 'plan', phaseVersion: 1, plan: HARSH_PLAN, requestId: 'pA'}, now);
 rMid = command(rMid, 'B', {type: 'plan', phaseVersion: 1, plan: HARSH_PLAN, requestId: 'pB'}, now);
 rMid = advance(rMid, rMid.deadline);
 assert.equal(rMid.phase, 'halftime');

 rMid = command(rMid, 'A', {type: 'plan', phaseVersion: rMid.phaseVersion, plan: HARSH_PLAN, requestId: 'hA'}, rMid.deadline - 1000);
 rMid = command(rMid, 'B', {type: 'plan', phaseVersion: rMid.phaseVersion, plan: HARSH_PLAN, requestId: 'hB'}, rMid.deadline - 1000);
 assert.equal(rMid.phase, 'secondHalf');
 assert.equal(rMid.nextSegment, null);
 assert.equal(rMid.matches[0].finished, true);
 assert.equal(rMid.playbackEnd, rMid.matches[0].minute);
 assert.ok(rMid.playbackEnd > 45 && rMid.playbackEnd < 70);

 // 70–90 hükmen (seed: 100778)
 let rLate = makeRoom({
  teamIds: ['A', 'B', 'C'],
  seed: 100778,
  schedule: [[['A', 'B']], [['B', 'C']], [['C', 'A']]],
  now
 });
 rLate = command(rLate, 'A', {type: 'plan', phaseVersion: 1, plan: HARSH_PLAN, requestId: 'pA'}, now);
 rLate = command(rLate, 'B', {type: 'plan', phaseVersion: 1, plan: HARSH_PLAN, requestId: 'pB'}, now);
 rLate = advance(rLate, rLate.deadline);
 rLate = command(rLate, 'A', {type: 'plan', phaseVersion: rLate.phaseVersion, plan: HARSH_PLAN, requestId: 'hA'}, rLate.deadline - 1000);
 rLate = command(rLate, 'B', {type: 'plan', phaseVersion: rLate.phaseVersion, plan: HARSH_PLAN, requestId: 'hB'}, rLate.deadline - 1000);
 assert.equal(rLate.phase, 'secondHalf');
 assert.deepEqual(rLate.nextSegment, {start: 70, end: 90});

 // 70. dakikaya ilerle -> 70–90 dilimi hesaplanır ve hükmen anına kısaltılır
 const at70 = rLate.playbackStart + (70 - 45) * 1000 / 1.5;
 rLate = advance(rLate, at70);
 assert.equal(rLate.phase, 'secondHalf');
 assert.equal(rLate.matches[0].finished, true);
 assert.equal(rLate.playbackEnd, rLate.matches[0].minute);
 assert.ok(rLate.playbackEnd > 70 && rLate.playbackEnd < 90);

 rLate = advance(rLate, rLate.deadline);
 assert.equal(rLate.phase, 'prepare');
 assert.equal(rLate.round, 1);
});

test('final uzatmasında 90–105 ve 105–120 hükmen bittiğinde playbackEnd < 120 olur ve kazanan yazılır', () => {
 const now = 1_700_000_000_000;

 // 1) 90–105 diliminde hükmen (matchSeed 103133 -> room.seed = 103133 - 100003 = 3130)
 let rET1 = makeRoom({
  teamIds: ['A', 'B', 'C'],
  seed: 3130,
  schedule: [[['A', 'B']], [['B', 'C']], [['C', 'A']]],
  final: true,
  finalists: ['A', 'B'],
  now
 });
 rET1 = command(rET1, 'A', {type: 'plan', phaseVersion: 1, plan: HARSH_PLAN, requestId: 'pA'}, now);
 rET1 = command(rET1, 'B', {type: 'plan', phaseVersion: 1, plan: HARSH_PLAN, requestId: 'pB'}, now);
 rET1 = advance(rET1, rET1.deadline);
 rET1 = command(rET1, 'A', {type: 'plan', phaseVersion: rET1.phaseVersion, plan: HARSH_PLAN, requestId: 'hA'}, rET1.deadline - 1000);
 rET1 = command(rET1, 'B', {type: 'plan', phaseVersion: rET1.phaseVersion, plan: HARSH_PLAN, requestId: 'hB'}, rET1.deadline - 1000);
 rET1 = advance(rET1, rET1.playbackStart + (70 - 45) * 1000 / 1.5);
 rET1 = advance(rET1, rET1.deadline);

 assert.equal(rET1.phase, 'finalResolution');
 assert.equal(rET1.nextSegment, null);
 assert.equal(rET1.matches[0].forfeit, 'A');
 assert.equal(rET1.playbackEnd, rET1.matches[0].minute);
 assert.ok(rET1.playbackEnd > 90 && rET1.playbackEnd < 105);

 rET1 = advance(rET1, rET1.deadline);
 assert.equal(rET1.phase, 'finished');
 assert.equal(rET1.champion, 'B');

 // 2) 105–120 diliminde hükmen (matchSeed 100175 -> room.seed = 100175 - 100003 = 172)
 let rET2 = makeRoom({
  teamIds: ['A', 'B', 'C'],
  seed: 172,
  schedule: [[['A', 'B']], [['B', 'C']], [['C', 'A']]],
  final: true,
  finalists: ['A', 'B'],
  now
 });
 rET2 = command(rET2, 'A', {type: 'plan', phaseVersion: 1, plan: HARSH_PLAN, requestId: 'pA'}, now);
 rET2 = command(rET2, 'B', {type: 'plan', phaseVersion: 1, plan: HARSH_PLAN, requestId: 'pB'}, now);
 rET2 = advance(rET2, rET2.deadline);
 rET2 = command(rET2, 'A', {type: 'plan', phaseVersion: rET2.phaseVersion, plan: HARSH_PLAN, requestId: 'hA'}, rET2.deadline - 1000);
 rET2 = command(rET2, 'B', {type: 'plan', phaseVersion: rET2.phaseVersion, plan: HARSH_PLAN, requestId: 'hB'}, rET2.deadline - 1000);
 rET2 = advance(rET2, rET2.playbackStart + (70 - 45) * 1000 / 1.5);
 rET2 = advance(rET2, rET2.deadline);

 assert.equal(rET2.phase, 'finalResolution');
 assert.deepEqual(rET2.nextSegment, {start: 105, end: 120});

 const at105 = rET2.playbackStart + (105 - 90) * 1000 / 1.5;
 rET2 = advance(rET2, at105);
 assert.equal(rET2.phase, 'finalResolution');
 assert.equal(rET2.matches[0].forfeit, 'B');
 assert.equal(rET2.playbackEnd, rET2.matches[0].minute);
 assert.ok(rET2.playbackEnd > 105 && rET2.playbackEnd < 120);

 rET2 = advance(rET2, rET2.deadline);
 assert.equal(rET2.phase, 'finished');
 assert.equal(rET2.champion, 'A');
});
