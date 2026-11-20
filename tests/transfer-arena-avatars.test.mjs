import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {AVATAR_PROFILES, CLUB_KITS, SKIN_PALETTE, HAIR_PALETTE, EYE_PALETTE} from '../dist/games/transfer-arenasi/avatar-data.js';
import {STAR_AVATARS} from '../dist/games/transfer-arenasi/avatar-stars.js';
import {playerAvatarSVG} from '../dist/games/transfer-arenasi/avatar.js';
import {playerCard} from '../dist/games/transfer-arenasi/cards.js';
import {squadBoard} from '../dist/games/transfer-arenasi/formation-board.js';
import {BONUS_PLAYER} from '../dist/games/transfer-arenasi/bonus-player.js';
import {LEGENDS} from '../server/transfer-arena/legends.js';
import {LEGEND_PORTRAITS} from '../dist/games/transfer-arenasi/legend-portraits.js';

const playersData = JSON.parse(fs.readFileSync(new URL('../dist/games/fut-draft/players.json', import.meta.url), 'utf8'));

test('all 4,847 Transfer Arenasi players have valid FM avatar profiles and balanced SVG output', () => {
  assert.equal(playersData.players.length, 4847);
  assert.equal(SKIN_PALETTE.length, 18);
  assert.equal(HAIR_PALETTE.length, 16);
  assert.equal(EYE_PALETTE.length, 4);
  assert.ok(Object.keys(CLUB_KITS).length >= 120);

  let missing = 0;
  for (const p of playersData.players) {
    const code = AVATAR_PROFILES[String(p.id)];
    if (typeof code !== 'string' || code.length !== 10) missing++;
  }
  assert.equal(missing, 0);

  // Check SVG rendering across every rating band and position
  const sample = [
    ...playersData.players.slice(0, 20),
    playersData.players[250],
    playersData.players[1000],
    playersData.players[2500],
    playersData.players[4846]
  ];
  for (const p of sample) {
    const svg = playerAvatarSVG(p);
    assert.ok(svg.startsWith('<svg class="fm-avatar"'));
    assert.ok(svg.endsWith('</svg>'));
    assert.ok(svg.includes('fm-head') && svg.includes('fm-blink-lid'));
    assert.ok(!svg.includes('undefined') && !svg.includes('NaN') && !svg.includes('FC 27'));

    const compact = playerAvatarSVG(p, {compact: true});
    assert.ok(compact.includes('fm-avatar fm-compact'));
    assert.ok(!compact.includes('fm-blink-lid'));
  }
});

test('all 96 elite (85+) players have star fine-tuning with distinct visual traits', () => {
  const elite = playersData.players.filter(p => p.overall >= 85);
  assert.equal(elite.length, 96);
  for (const p of elite) {
    assert.ok(STAR_AVATARS[String(p.id)], `Missing STAR_AVATARS entry for ${p.name} (${p.id})`);
  }

  const byId = Object.fromEntries(playersData.players.map(p => [String(p.id), p]));
  // Osimhen mask, Haaland/Modric headband, Yamal bleached tips, Cucurella big curls, Salah beard
  const osimhen = playerAvatarSVG(byId['232293']);
  const haaland = playerAvatarSVG(byId['239085']);
  const modric = playerAvatarSVG(byId['177003']);
  const yamal = playerAvatarSVG(byId['277643']);
  const cucurella = playerAvatarSVG(byId['239231']);
  const salah = playerAvatarSVG(byId['209331']);

  assert.notEqual(osimhen, haaland);
  assert.notEqual(cucurella, salah);
  assert.notEqual(yamal, modric);
  // Mask path stroke color #3b4048 appears on Osimhen but not Mbappe
  assert.ok(osimhen.includes('#3b4048'));
  assert.ok(!playerAvatarSVG(byId['231747']).includes('#3b4048'));
  // Headband fill #181b20 stroke #ffffff26 appears on Haaland & Modric
  assert.ok(haaland.includes('#ffffff26'));
  assert.ok(modric.includes('#ffffff26'));
});

test('playerCard preserves legend/bonus photos, replaces fallback silhouette with FM avatar, and escapes XSS', () => {
  const mbappe = playersData.players.find(p => p.id === 231747);
  const card = playerCard(mbappe);
  assert.ok(card.includes('class="fm-avatar"'));
  assert.ok(!card.includes('<circle cx="80" cy="51" r="29"/>'));
  assert.ok(!card.includes('FC 27'));

  // Legend keeps Wikimedia photo
  const leg = LEGENDS[0];
  const legCard = playerCard({...leg, portraitURL: LEGEND_PORTRAITS[leg.id].path});
  assert.ok(legCard.includes('portrait-photo'));
  assert.ok(!legCard.includes('fm-avatar'));

  // Bonus player keeps personal photo with centered portrait framing
  const bonusCard = playerCard(BONUS_PLAYER);
  assert.ok(bonusCard.includes(BONUS_PLAYER.portraitURL));
  assert.ok(bonusCard.includes('bonus-card'));
  assert.ok(bonusCard.includes('translateX(-6.5%)'));
  assert.ok(!bonusCard.includes('fm-avatar'));

  // Missing ID & unsafe name
  const weird = playerCard({name: 'Test <script>alert(1)</script>', overall: 74, position: 'GK', club: 'Unknown <Club>'});
  assert.ok(weird.includes('class="fm-avatar"'));
  assert.ok(!weird.includes('<script>'));
});

test('squadBoard renders chip-avatar for normal players, img for legends, chip-photo for bonus, and unique SVG defs IDs', () => {
  const leg = {...LEGENDS[0], portraitURL: LEGEND_PORTRAITS[LEGENDS[0].id].path, position: 'MID'};
  const normal = playersData.players[0]; // Mbappe (ATT)
  const normal2 = playersData.players[2]; // Courtois (GK)
  const team = {
    id: 't1',
    name: 'Test FC',
    formation: '2-2-2',
    players: [normal, normal2, leg, BONUS_PLAYER],
    coach: null
  };
  const html = squadBoard(team);
  assert.equal((html.match(/board-chip empty/g) || []).length, 3);
  assert.equal((html.match(/class="chip-avatar"/g) || []).length, 2);
  assert.equal((html.match(/class="chip-photo"/g) || []).length, 1);
  assert.ok(html.includes(BONUS_PLAYER.portraitURL) && html.includes('translateX(-10%)'));
  assert.ok(html.includes(LEGEND_PORTRAITS[LEGENDS[0].id].path));

  // Ensure every <defs> gradient/clipPath id is unique across multiple renders in one document
  const ids = [...html.matchAll(/id="(fm\d+_[a-z]+)"/g)].map(m => m[1]);
  assert.ok(ids.length >= 6);
  assert.equal(new Set(ids).size, ids.length);
});
