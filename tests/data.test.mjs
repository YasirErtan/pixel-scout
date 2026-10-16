import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, relative, isAbsolute } from 'node:path';
import { ageOn, normalizeName } from '../dist/engine.js';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const data = JSON.parse(readFileSync(resolve(dist, 'players.json'), 'utf8'));
const expectedIds = ['mbappe', 'haaland', 'saka', 'palmer', 'bellingham', 'de-bruyne', 'yamal', 'barella', 'dybala', 'pedri', 'foden', 'van-dijk', 'hakimi', 'donnarumma', 'dembele', 'vitinha', 'marquinhos', 'courtois', 'vinicius', 'lautaro'];

test('curated pool contains 125 normal portrait targets with stable starter identities and four leagues', () => {
  assert.equal(data.players.length, 125);
  const ids = data.players.map(p => p.id);
  assert.equal(new Set(ids).size, 125);
  expectedIds.forEach(id=>assert.ok(ids.includes(id),`preserved starter ${id}`));
  assert.deepEqual([...new Set(data.players.map(p => p.league))].sort(), ['LaLiga', 'Ligue1', 'PL', 'SerieA'].sort());
});

test('requested exclusions cannot be selected as normal portrait targets', () => {
  const excluded=new Set(['Brian Madjo','Brayan Madjo','Malick Thiaw','Conor Bradley','Dan Burn','Ibrahim Mbaye','Gerónimo Rulli','Mile Svilar'].map(normalizeName));
  const excludedIds=new Set(['espn-401451','espn-303444','espn-250183','espn-198138','espn-388522','espn-167192','espn-238798']);
  for(const p of data.players){assert.ok(!excludedIds.has(p.id),p.name);assert.ok(![p.name,...p.aliases].some(name=>excluded.has(normalizeName(name))),p.name);}
});

test('every player has complete, usable comparison and searchable snapshot data', () => {
  assert.equal(data.snapshotDate, '2026-10-15');
  assert.equal(data.snapshotSeason, '2026/27');
  for (const p of data.players) {
    assert.ok(normalizeName(p.name), `${p.id}: name`);
    assert.ok(Array.isArray(p.aliases) && p.aliases.every(alias => typeof alias === 'string' && normalizeName(alias)), `${p.id}: aliases`);
    assert.ok(p.club && p.nationality && /^[A-Z]{2,3}$/.test(p.nationalityCode), `${p.id}: club and nationality`);
    assert.ok(['GK', 'DF', 'MF', 'FW'].includes(p.position), `${p.id}: position`);
    const age = ageOn(p.birthDate, data.snapshotDate);
    assert.ok(Number.isInteger(age) && age >= 16 && age <= 50, `${p.id}: valid date of birth`);
    assert.ok(Number.isInteger(p.shirtNumber) && p.shirtNumber >= 1 && p.shirtNumber <= 99, `${p.id}: shirt number`);
    assert.equal(p.verifiedAt, data.snapshotDate, `${p.id}: verification date`);
    assert.equal(p.snapshotSeason, data.snapshotSeason, `${p.id}: season`);
    assert.ok(Array.isArray(p.sourceUrls) && p.sourceUrls.length > 0, `${p.id}: fact sources`);
    assert.ok(p.sourceUrls.every(url => new URL(url).protocol === 'https:'), `${p.id}: valid fact links`);
  }
});

test('portraits are bundled real JPEG assets with complete attribution, never hotlinked', () => {
  for (const p of data.players) {
    const photo = p.photo;
    assert.ok(photo && typeof photo.path === 'string', `${p.id}: photo`);
    assert.match(photo.path, /^assets\/portraits\/[a-z0-9-]+\.(jpg|png|webp)$/, `${p.id}: local image URL`);
    assert.ok(!isAbsolute(photo.path) && !/^[a-z]+:/i.test(photo.path), `${p.id}: no external runtime image dependency`);
    const path = resolve(dist, photo.path);
    assert.ok(!relative(dist, path).startsWith('..'), `${p.id}: contained image path`);
    assert.ok(statSync(path).size > 1000, `${p.id}: nonempty photo`);
    const bytes = readFileSync(path);
    const jpeg=bytes[0]===0xff&&bytes[1]===0xd8;
    const png=bytes.subarray(1,4).toString()==='PNG';
    const webp=bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP';
    assert.ok(jpeg||png||webp, `${p.id}: genuine raster file signature`);
    assert.ok(typeof photo.author === 'string' && photo.author.trim(), `${p.id}: photographer`);
    assert.match(photo.license, /^(?:CC BY(?:-SA)? |CC0$|Public domain$)/, `${p.id}: license`);
    assert.equal(new URL(photo.sourcePage).hostname, 'commons.wikimedia.org', `${p.id}: source file page`);
    if (photo.license !== 'Public domain') assert.equal(new URL(photo.licenseUrl).hostname, 'creativecommons.org', `${p.id}: license link`);
    assert.ok(photo.date, `${p.id}: source date`);
  }
});
