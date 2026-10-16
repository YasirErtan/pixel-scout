import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeName, ageOn, compareGuess, createRound, validateRound, submitGuess, drawNext } from '../dist/engine.js';

const players = Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, name: `Player ${i}`, club: i < 2 ? 'Same FC' : `FC ${i}`, league: i < 5 ? 'PL' : 'Liga', nationalityCode: i < 3 ? 'FR' : 'ES', position: i < 4 ? 'FW' : 'MF', birthDate: `199${i}-10-15`, shirtNumber: i + 1 }));

test('name search handles accents, punctuation and Turkish letters', () => {
  assert.equal(normalizeName('İlkay Gündoğan'), 'ilkaygundogan');
  assert.equal(normalizeName('Kylian Mbappé'), 'kylianmbappe');
  assert.equal(normalizeName('João-Félix'), 'joaofelix');
});

test('age is determined by the data date and birthday boundary', () => {
  assert.equal(ageOn('2000-10-15', '2026-10-14'), 25);
  assert.equal(ageOn('2000-10-15', '2026-10-15'), 26);
  assert.equal(ageOn('2000-02-29', '2026-02-28'), 25);
  assert.equal(ageOn('2000-02-30'), null);
  assert.equal(ageOn('2027-01-01'), null);
});

test('comparison includes same-league clue and arrows pointing toward answer', () => {
  const clues = compareGuess(players[3], players[0]);
  assert.equal(clues.club.status, 'league');
  assert.equal(clues.nationality.status, 'miss');
  assert.equal(clues.position.status, 'exact');
  assert.equal(clues.age.direction, 'up');
  assert.equal(clues.shirt.direction, 'down');
  assert.equal(compareGuess(players[5], players[0]).club.status, 'miss');
  assert.equal(compareGuess(players[1], players[0]).club.status, 'exact');
  assert.ok(Object.values(compareGuess(players[0], players[0])).every(c => c.status === 'exact' && c.direction === null));
});

test('missing numbers never create misleading matches or arrows', () => {
  const clues = compareGuess({ ...players[0], birthDate: '', shirtNumber: null }, players[0]);
  assert.equal(clues.age.value, null);
  assert.equal(clues.age.direction, null);
  assert.equal(clues.shirt.status, 'miss');
});

test('round rejects duplicates and unknown players, wins by identity', () => {
  const initial = createRound('p0');
  const first = submitGuess(initial, 'p1', players);
  assert.equal(first.status, 'playing');
  assert.deepEqual(initial.guessIds, []);
  assert.throws(() => submitGuess(first, 'p1', players), /already guessed/);
  assert.throws(() => submitGuess(first, 'missing', players), /Unknown/);
  const won = submitGuess(first, 'p0', players);
  assert.equal(won.status, 'won');
  assert.throws(() => submitGuess(won, 'p2', players), /finished/);
});

test('eight unique wrong guesses lose; correct eighth guess wins', () => {
  let lost = createRound('p0', 'hard');
  for (let i = 1; i <= 8; i++) lost = submitGuess(lost, `p${i}`, players);
  assert.equal(lost.status, 'lost');
  assert.throws(() => submitGuess(lost, 'p9', players), /finished/);
  let won = createRound('p0');
  for (let i = 1; i <= 7; i++) won = submitGuess(won, `p${i}`, players);
  assert.equal(submitGuess(won, 'p0', players).status, 'won');
});

test('saved state is validated and forged result fields are recomputed', () => {
  const restored = validateRound({ targetId: 'p0', mode: 'photo', guessIds: ['p1'], status: 'won', comparisons: ['forged'] }, players);
  assert.equal(restored.status, 'playing');
  assert.equal(restored.comparisons[0].club.status, 'exact');
  for (const bad of [null, {}, { targetId: 'missing', mode: 'photo', guessIds: [] }, { targetId: 'p0', mode: 'x', guessIds: [] }, { targetId: 'p0', mode: 'photo', guessIds: ['p1', 'p1'] }, { targetId: 'p0', mode: 'photo', guessIds: ['p0', 'p1'] }, { targetId: 'p0', mode: 'photo', guessIds: ['missing'] }, { targetId: 'p0', mode: 'photo', guessIds: players.slice(1).map(p => p.id) }]) assert.equal(validateRound(bad, players), null);
});

test('draw bag covers entire pool without repeats and prevents boundary repeat', () => {
  let bag = {}, lastId;
  for (let cycle = 0; cycle < 3; cycle++) {
    const seen = new Set();
    for (let i = 0; i < players.length; i++) {
      const drawn = drawNext(players, bag, () => 0);
      assert.notEqual(drawn.player.id, lastId);
      assert.ok(!seen.has(drawn.player.id));
      seen.add(drawn.player.id); lastId = drawn.player.id; bag = drawn.bag;
    }
    assert.equal(seen.size, players.length);
  }
});

test('changed filter rebuilds bag; empty and singleton pools work', () => {
  const old = drawNext(players, {}, () => 0).bag;
  const drawn = drawNext([players[1], players[2]], old, () => 0);
  assert.ok(['p1', 'p2'].includes(drawn.player.id));
  assert.equal(drawn.bag.remaining.length, 1);
  assert.equal(drawNext([]).player, null);
  const single = drawNext([players[0]]);
  assert.equal(drawNext([players[0]], single.bag).player.id, 'p0');
});

test('corrupt persisted bags are replaced safely', () => {
  const signature = JSON.stringify(players.map(p => p.id).sort());
  for (const remaining of [['unknown'], ['p1', 'p1'], 'invalid']) {
    const drawn = drawNext(players, { signature, remaining }, () => 0.5);
    assert.equal(drawn.bag.remaining.length, 9);
    assert.ok(players.some(p => p.id === drawn.player.id));
  }
});
