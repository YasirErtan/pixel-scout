// Eski maç modellerinin (3, 4 ve 5) altın kaydı: Model 6 çalışması eski sürümlerin sonucunu değiştirirse kırılır.
//
// Altın kayıt nasıl yeniden üretilir (yalnız BİLİNÇLİ bir model değişikliğinde!):
//   ARENA_GOLDEN_UPDATE=1 node --test tests/transfer-arena-model5-golden.test.mjs
// Bu komut tests/fixtures/arena-golden.json dosyasını yeniden yazar; değişen özetleri gözden geçirip
// değişikliğin nedenini commit mesajına yaz. Model 6 geliştirmesi nedeniyle kayıt yenilenmez:
// eski maçlar (version < 6) birebir aynı sonucu vermelidir.
//
// Kapsam: her sürüm (3, 4, 5) için sabit tohumlu 50 maç (iki yarı) + sürüm 4 ve 5 için uzatma/penaltı içeren finaller.
// Her maç için olay listesi, son skor, takım sayaçları, kazanan ve penaltı sonucu SHA-256 ile özetlenir.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {beginMatch, simulateHalf, resolveFinal, DEFAULT_PLAN} from '../server/transfer-arena/simulation.js';
import {arenaData} from '../server/transfer-arena/data.js';
import {makeMarket, random, shuffle} from '../server/transfer-arena/market.js';
import {COACHES} from '../server/transfer-arena/coaches.js';

const FIXTURE = new URL('./fixtures/arena-golden.json', import.meta.url);
const MATCHES = 50, FINALS = 6, VERSIONS = [3, 4, 5];
const FORMS = ['2-2-2', '2-3-1', '3-2-1', '1-3-2'], STYLES = ['short', 'wide', 'direct', 'counter'];

// Bu dosya kendi takım üretecini taşır (betik ile bağımsız kalsın diye); değiştirilirse altın kayıt da yenilenmelidir.
function makeTeams(data, next) {
  const pick = a => a[Math.floor(next() * a.length)];
  const formations = [pick(FORMS), pick(FORMS)];
  const market = makeMarket(data.players, COACHES, 3, next, {formations: [...formations, '2-2-2']});
  const pool = shuffle(market.players, next);
  return formations.map((formation, i) => {
    const [D, M, A] = formation.split('-').map(Number), need = {GK: 1, DEF: D, MID: M, ATT: A}, players = [];
    for (const role of Object.keys(need)) for (let k = 0; k < need[role]; k++) {
      const j = pool.findIndex(p => p.position === role);
      if (j >= 0) players.push(pool.splice(j, 1)[0]);
    }
    return {id: 't' + i, players, coach: market.coaches[i], formation};
  });
}
const makePlan = (team, next) => ({...DEFAULT_PLAN, formation: team.formation, style: STYLES[Math.floor(next() * 4)], press: Math.floor(next() * 3), risk: Math.floor(next() * 3), tempo: Math.floor(next() * 3), width: Math.floor(next() * 3), tackle: Math.floor(next() * 4)});

// Maçın karşılaştırılabilir özeti: olaylar, skorlar, sayaçlar, kazanan ve penaltılar.
function digest(m) {
  const summary = {
    version: m.version, minute: m.minute, finished: m.finished, forfeit: m.forfeit ?? null, winner: m.winner ?? null, shootout: m.shootout ?? null,
    teams: m.teams.map(t => [t.id, t.goals, t.shots, t.onTarget, t.saves, t.xg, t.passes, t.completed, t.losses]),
    events: m.events
  };
  return createHash('sha256').update(JSON.stringify(summary)).digest('hex');
}
function play(data, version, seed, index) {
  const next = random(seed * 7919 + index);
  const teams = makeTeams(data, next), plans = teams.map(t => makePlan(t, next));
  let m = beginMatch(teams[0], teams[1], seed * 100003 + index, index % 3, {version, neutral: index % 2 === 0});
  m = simulateHalf(m, plans);
  if (!m.finished) m = simulateHalf(m, plans);
  return {m, plans};
}
// Berabere biten maçlardan uzatma içeren finaller; en az 2'si penaltılara giden finaller olacak şekilde.
function finals(data, version) {
  const out = [];
  for (let index = 0, shootouts = 0; index < 3000 && (out.length < FINALS || shootouts < 2); index++) {
    const {m, plans} = play(data, version, 90 + version, 1000 + index);
    if (!m.finished || m.forfeit || m.teams[0].goals !== m.teams[1].goals) continue;
    const final = resolveFinal(m, plans), penalties = Boolean(final.shootout);
    if (out.length >= FINALS && !penalties) continue;
    out.push({m: final, index}); shootouts += penalties;
  }
  return out;
}
async function build() {
  const data = await arenaData(), golden = {aciklama: 'Model 3/4/5 altın kaydı; yeniden üretim yönergesi test dosyasının başındadır.', matches: {}, finals: {}};
  for (const version of VERSIONS) {
    golden.matches['v' + version] = Array.from({length: MATCHES}, (_, i) => digest(play(data, version, 1, i).m));
    if (version >= 4) golden.finals['v' + version] = finals(data, version).map(({m, index}) => ({index, penalties: Boolean(m.shootout), digest: digest(m)}));
  }
  return golden;
}

const actual = await build();
if (process.env.ARENA_GOLDEN_UPDATE === '1') {
  mkdirSync(new URL('./fixtures/', import.meta.url), {recursive: true});
  writeFileSync(FIXTURE, JSON.stringify(actual, null, 1) + '\n');
}
const golden = JSON.parse(readFileSync(FIXTURE, 'utf8'));

for (const version of VERSIONS) {
  test(`model ${version}: ${MATCHES} sabit tohumlu maçın olay özeti değişmedi`, () => {
    assert.equal(golden.matches['v' + version].length, MATCHES);
    const diff = actual.matches['v' + version].flatMap((h, i) => h === golden.matches['v' + version][i] ? [] : [i]);
    assert.deepEqual(diff, [], `Değişen maç indeksleri (model ${version}): ${diff.join(', ')}`);
  });
}
for (const version of VERSIONS.filter(v => v >= 4)) {
  test(`model ${version}: uzatma ve penaltılı finaller değişmedi`, () => {
    const expected = golden.finals['v' + version], got = actual.finals['v' + version];
    assert.ok(expected.length >= 3, 'En az üç final kaydı olmalı');
    assert.deepEqual(got, expected);
  });
}
test('altın finallerin en az biri penaltılara gidiyor', () => {
  assert.ok(VERSIONS.filter(v => v >= 4).every(v => golden.finals['v' + v].filter(f => f.penalties).length >= 2));
});
