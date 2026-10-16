import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BONUS_ID, BONUS_PLAYER, isBonusRound, openingRound, searchRosterForRound } from '../dist/bonus.js';
import { normalizeName, compareGuess, submitGuess, drawNext } from '../dist/engine.js';

const normal = JSON.parse(readFileSync(new URL('../dist/players.json', import.meta.url), 'utf8')).players;

test('opening round is fresh photo mode even after a prior completed opener', () => {
  const first = openingRound();
  const completed = submitGuess(first, BONUS_ID, searchRosterForRound(first, normal));
  assert.equal(completed.status, 'won');
  const nextLoad = openingRound(completed);
  assert.deepEqual(nextLoad, { targetId: BONUS_ID, mode: 'photo', guessIds: [], status: 'playing', comparisons: [] });
  assert.notEqual(nextLoad, first);
  assert.notEqual(nextLoad.guessIds, first.guessIds);
});

test('bonus can be solved by identity while all personal football facts remain unknown', () => {
  for (const key of ['club', 'league', 'nationality', 'nationalityCode', 'position', 'birthDate', 'shirtNumber']) assert.equal(BONUS_PLAYER[key], null, key);
  const opener = openingRound();
  const roster = searchRosterForRound(opener, normal);
  const wrong = submitGuess(opener, normal[0].id, roster);
  assert.equal(wrong.status, 'playing');
  assert.ok(Object.values(compareGuess(normal[0], BONUS_PLAYER)).every(clue => clue.status === 'miss' && clue.targetValue === null && clue.direction === null));
  assert.equal(submitGuess(wrong, BONUS_ID, roster).status, 'won');
  assert.equal(normalizeName(BONUS_PLAYER.name), 'bonusoyuncu');
  assert.ok(BONUS_PLAYER.aliases.some(name => normalizeName(name) === 'bonus'));
});

test('bonus is searchable only in opener and never mutates the ordinary random pool', () => {
  const before = JSON.stringify(normal);
  const bonusRoster = searchRosterForRound(openingRound(), normal);
  assert.equal(bonusRoster[0], BONUS_PLAYER);
  assert.equal(bonusRoster.length, normal.length + 1);
  assert.equal(searchRosterForRound({ targetId: normal[0].id }, normal), normal);
  assert.equal(isBonusRound(null), false);
  assert.equal(isBonusRound(openingRound()), true);
  assert.equal(normal.some(player => player.id === BONUS_ID), false);
  let bag = {};
  for (let i = 0; i < normal.length; i++) {
    const next = drawNext(normal, bag, () => 0.5);
    assert.notEqual(next.player.id, BONUS_ID);
    bag = next.bag;
  }
  assert.equal(JSON.stringify(normal), before);
});

test('bonus uses an original fictional SVG without personal data', () => {
  assert.equal(BONUS_PLAYER.photo.path, 'assets/bonus/demo-player.svg');
  assert.equal(BONUS_PLAYER.photo.sourcePage, null);
  assert.equal(BONUS_PLAYER.photo.licenseUrl, null);
  assert.equal(BONUS_PLAYER.photo.date, null);
  assert.equal(BONUS_PLAYER.photo.author, 'Pixel Scout contributors');
});
