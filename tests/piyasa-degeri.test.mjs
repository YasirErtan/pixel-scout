import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CLUBS, formatMarketValue, formatFullCurrency } from '../dist/games/piyasa-degeri/clubs.js';

const root = fileURLToPath(new URL('../', import.meta.url));

test('piyasa-degeri registry is valid and points to local entrypoint', () => {
  const registry = JSON.parse(fs.readFileSync(path.join(root, 'dist/games/registry.json'), 'utf8'));
  const entry = registry.find(g => g.id === 'piyasa-degeri');
  assert.ok(entry, 'Game should be present in registry.json');
  assert.equal(entry.title, 'Piyasa Değeri (Higher or Lower)');
  assert.equal(entry.href, './piyasa-degeri/index.html');

  const htmlPath = path.join(root, 'dist/games/piyasa-degeri/index.html');
  assert.ok(fs.existsSync(htmlPath), 'index.html must exist');
});

test('clubs database contains comprehensive list across all requested leagues', () => {
  assert.ok(CLUBS.length >= 100, `Expected at least 100 clubs, got ${CLUBS.length}`);

  const ids = new Set();
  const leagues = new Set();

  for (const club of CLUBS) {
    assert.ok(club.id, 'Club must have an id');
    assert.ok(!ids.has(club.id), `Duplicate club id found: ${club.id}`);
    ids.add(club.id);

    assert.ok(club.name, `Club ${club.id} must have a name`);
    assert.ok(club.league, `Club ${club.id} must have a league`);
    assert.ok(club.country, `Club ${club.id} must have a country`);
    assert.ok(club.flag, `Club ${club.id} must have a flag`);
    assert.ok(typeof club.marketValue === 'number' && club.marketValue > 0, `Club ${club.id} must have positive market value`);
    assert.match(club.color, /^#[0-9a-fA-F]{6}$/, `Club ${club.id} must have valid hex color`);
    assert.ok(club.logo && club.logo.startsWith('http'), `Club ${club.id} must have logo url`);

    leagues.add(club.league);
  }

  // Key requested leagues
  assert.ok(leagues.has('Premier League'), 'Should have Premier League');
  assert.ok(leagues.has('La Liga'), 'Should have La Liga');
  assert.ok(leagues.has('Serie A'), 'Should have Serie A');
  assert.ok(leagues.has('Süper Lig'), 'Should have Süper Lig');
  assert.ok(leagues.has('Bundesliga'), 'Should have Bundesliga');
  assert.ok(leagues.has('Ligue 1'), 'Should have Ligue 1');
  assert.ok(leagues.has('Saudi Pro League'), 'Should have Saudi Pro League');

  // Verify Scandinavian clubs are present
  const scandinavianClubs = CLUBS.filter(c => ['Norveç', 'Danimarka', 'İsveç'].includes(c.country));
  assert.ok(scandinavianClubs.length >= 5, 'Should have Scandinavian clubs included');
});

test('market value formatting helpers work correctly', () => {
  assert.equal(formatMarketValue(1_260_000_000), '€1.26 Milyar');
  assert.equal(formatMarketValue(1_000_000_000), '€1 Milyar');
  assert.equal(formatMarketValue(285_000_000), '€285 Milyon');
  assert.equal(formatMarketValue(40_000_000), '€40 Milyon');

  const formatted = formatFullCurrency(150_000_000);
  assert.ok(formatted.includes('150'), 'Currency format should include value');
  assert.ok(formatted.includes('€'), 'Currency format should include Euro sign');
});

test('index.html contains all necessary higher-lower DOM elements', () => {
  const html = fs.readFileSync(path.join(root, 'dist/games/piyasa-degeri/index.html'), 'utf8');

  assert.ok(html.includes('id="current-score"'));
  assert.ok(html.includes('id="best-score"'));
  assert.ok(html.includes('id="left-side"'));
  assert.ok(html.includes('id="right-side"'));
  assert.ok(html.includes('id="higher-btn"'));
  assert.ok(html.includes('id="lower-btn"'));
  assert.ok(html.includes('id="feedback-badge"'));
  assert.ok(html.includes('id="game-over-dialog"'));
  assert.ok(html.includes('id="restart-btn"'));
});
