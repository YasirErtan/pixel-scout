// Transfer Arenası maç modeli kalibrasyon ölçümü (model 5 ve model 6).
// Kullanım: node scripts/calibrate-arena.mjs --model 5|6 --matches 3000 --seed 1 [--json] [--all-in-rate 0.5]
// Kadrolar ihale pazarından kurulur; dizilişler ve taktikler sabit tohumla rastgele seçilir (deterministik).
// Ağa çıkmaz; yalnız yerel oyuncu verisini okur.
import {fileURLToPath} from 'node:url';
import {beginMatch, simulateHalf, simulateSegment, allInEligible, DEFAULT_PLAN} from '../server/transfer-arena/simulation.js';
import {arenaData} from '../server/transfer-arena/data.js';
import {makeMarket, random, shuffle} from '../server/transfer-arena/market.js';
import {COACHES} from '../server/transfer-arena/coaches.js';
import {coachRatingBoost} from '../dist/games/transfer-arenasi/coach-card.js';

const FORMS = ['2-2-2', '2-3-1', '3-2-1', '1-3-2'], STYLES = ['short', 'wide', 'direct', 'counter'];
export const FAVORITE_GAP = 6;
export const SLICES = [[0, 45], [45, 70], [70, 90]];

// Ortak takım gücü tanımı (docs/ARENA_MODEL6_CONTRACT.md): kaleci dahil tüm oyuncuların
// ortalama overall'ı × (1 + hoca reyting çarpanı).
export function teamStrength(team) {
  const players = team.players;
  if (!players.length) return 0;
  const mean = players.reduce((s, p) => s + p.overall, 0) / players.length;
  return mean * (1 + coachRatingBoost(team.coach));
}

// İhale pazarından iki gerçekçi takım (hoca dahil) çıkarır.
function buildTeams(data, next) {
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
function randomPlan(team, next) {
  const pick = a => a[Math.floor(next() * a.length)];
  return {...DEFAULT_PLAN, formation: team.formation, style: pick(STYLES), press: Math.floor(next() * 3), risk: Math.floor(next() * 3), tempo: Math.floor(next() * 3), width: Math.floor(next() * 3), tackle: Math.floor(next() * 4)};
}

const SHOT_TYPES = new Set(['goal', 'shot', 'save', 'post']);
const GAP_BUCKETS = [[0, 2], [2, 4], [4, 6], [6, Infinity]];
const sliceOf = minute => Math.min(5, Math.max(0, Math.ceil(minute / 15) - 1));

// Tek bir maçı oynatır; model 6'da dilim dilim, "Tüm riskleri al!" seçimiyle.
function playMatch(model, teams, plans, seed, referee, next, allInRate) {
  const choices = [false, false], eligible = [false, false];
  if (model < 6) {
    let m = beginMatch(teams[0], teams[1], seed, referee, {version: model, neutral: true});
    m = simulateHalf(m, plans);
    if (!m.finished) m = simulateHalf(m, plans);
    return {m, choices, eligible};
  }
  let m = beginMatch(teams[0], teams[1], seed, referee, {version: 6, neutral: true});
  for (const [start, end] of SLICES) {
    if (m.finished) break;
    let allIn = [false, false];
    if (start === 70) {
      for (let side = 0; side < 2; side++) {
        eligible[side] = allInEligible(m, side);
        choices[side] = eligible[side] && next() < allInRate;
      }
      allIn = [...choices];
    }
    m = simulateSegment(m, plans, {start, end, allIn});
  }
  return {m, choices, eligible};
}

const emptyAllIn = () => ({n: 0, goalsFor: 0, goalsAgainst: 0, shots: 0, shotsAgainst: 0});

// Ölçümü yürütür ve ham sayımları + türetilmiş oranları döndürür.
export async function calibrate({model = 6, matches = 3000, seed = 1, allInRate = .5} = {}) {
  if (![3, 4, 5, 6].includes(model)) throw Error('Model 3, 4, 5 ya da 6 olmalı');
  const data = await arenaData(), next = random((Math.imul(seed >>> 0, 2654435761) + 20261125) >>> 0);
  const s = {
    goals: [], draws: 0, maxTeamGoals: 0, teamSixPlus: 0, forfeits: 0,
    shots: 0, onTarget: 0, xg: 0, passes: 0, completed: 0, yellow: 0, red: 0,
    goalEvents: 0, penGoals: 0, assisted: 0, setPieceGoals: {penalty: 0, freeKick: 0, corner: 0},
    minute: Array(6).fill(0), gap: GAP_BUCKETS.map(() => ({n: 0, w: 0, d: 0, l: 0})),
    events: {post: 0, big: 0, setPiece: 0, allIn: 0},
    allIn: {chose: emptyAllIn(), notChose: emptyAllIn(), eligibleTeams: 0}
  };
  for (let i = 0; i < matches; i++) {
    const teams = buildTeams(data, next), plans = teams.map(t => randomPlan(t, next));
    const {m, choices, eligible} = playMatch(model, teams, plans, (Math.imul(seed >>> 0, 1000003) + i) >>> 0, i % 3, next, allInRate);
    const [ga, gb] = m.teams.map(t => t.goals);
    s.goals.push(ga + gb); s.maxTeamGoals = Math.max(s.maxTeamGoals, ga, gb);
    s.teamSixPlus += (ga >= 6) + (gb >= 6);
    if (ga === gb) s.draws++;
    if (m.forfeit) s.forfeits++;
    for (const t of m.teams) { s.shots += t.shots; s.onTarget += t.onTarget; s.xg += t.xg; s.passes += t.passes; s.completed += t.completed; }
    // "Güçlü" takım = takım gücü yüksek olan; fark küçükse bile ayrım yapılır.
    const diff = teamStrength(teams[0]) - teamStrength(teams[1]), strong = diff >= 0 ? ga : gb, weak = diff >= 0 ? gb : ga;
    const bucket = s.gap[GAP_BUCKETS.findIndex(([lo, hi]) => Math.abs(diff) >= lo && Math.abs(diff) < hi)];
    bucket.n++; if (strong > weak) bucket.w++; else if (strong === weak) bucket.d++; else bucket.l++;
    const late = [emptyAllIn(), emptyAllIn()];
    for (const e of m.events) {
      if (e.type === 'yellow') s.yellow++;
      if (e.type === 'red') s.red++;
      if (e.type === 'post') s.events.post++;
      if (e.type === 'allIn') s.events.allIn++;
      if (e.big) s.events.big++;
      if (e.setPiece) s.events.setPiece++;
      if (e.type === 'goal') {
        s.goalEvents++; s.minute[sliceOf(e.minute)]++;
        if (e.penalty) s.penGoals++;
        if (e.assisterId != null) s.assisted++;
        if (e.setPiece) s.setPieceGoals[e.setPiece] = (s.setPieceGoals[e.setPiece] || 0) + 1;
      }
      if (model >= 6 && e.minute > 70 && e.minute <= 90) {
        const side = m.teams.findIndex(t => t.id === e.team);
        if (e.type === 'goal') { late[side].goalsFor++; late[1 - side].goalsAgainst++; }
        if (SHOT_TYPES.has(e.type)) { late[side].shots++; late[1 - side].shotsAgainst++; }
      }
    }
    if (model >= 6) for (let side = 0; side < 2; side++) {
      if (!eligible[side]) continue;
      s.allIn.eligibleTeams++;
      const bin = choices[side] ? s.allIn.chose : s.allIn.notChose;
      bin.n++; for (const k of ['goalsFor', 'goalsAgainst', 'shots', 'shotsAgainst']) bin[k] += late[side][k];
    }
  }
  return summarize(model, matches, seed, allInRate, s);
}

function summarize(model, matches, seed, allInRate, s) {
  const N = matches, total = s.goals.reduce((x, y) => x + y, 0), ratio = (a, b) => b ? a / b : 0;
  const dist = Array(8).fill(0); for (const g of s.goals) dist[Math.min(7, g)]++;
  const favorite = s.gap[3], goalShare = s.goalEvents || 1;
  const avgAllIn = b => ({n: b.n, goalsFor: ratio(b.goalsFor, b.n), goalsAgainst: ratio(b.goalsAgainst, b.n), shots: ratio(b.shots, b.n), shotsAgainst: ratio(b.shotsAgainst, b.n)});
  return {
    model, matches: N, seed, allInRate,
    goalsPerMatch: total / N,
    goalDistribution: dist.map(v => v / N),
    sixPlusMatchRate: s.goals.filter(g => g >= 6).length / N,
    sixPlusTeamRate: s.teamSixPlus / (2 * N),
    maxTeamGoals: s.maxTeamGoals,
    drawRate: s.draws / N,
    forfeits: s.forfeits,
    gap: s.gap.map((g, i) => ({range: GAP_BUCKETS[i][1] === Infinity ? '6+' : GAP_BUCKETS[i].join('–'), n: g.n, win: ratio(g.w, g.n), draw: ratio(g.d, g.n), loss: ratio(g.l, g.n)})),
    favorite: {n: favorite.n, win: ratio(favorite.w, favorite.n), draw: ratio(favorite.d, favorite.n), loss: ratio(favorite.l, favorite.n)},
    minuteShare: s.minute.map(v => v / goalShare),
    penaltyGoalShare: s.penGoals / goalShare,
    setPieceGoalShare: Object.fromEntries(Object.entries(s.setPieceGoals).map(([k, v]) => [k, v / goalShare])),
    assistedGoalRate: s.assisted / goalShare,
    yellowPerMatch: s.yellow / N, redPerMatch: s.red / N,
    shotsPerTeam: s.shots / N / 2, onTargetPerTeam: s.onTarget / N / 2, xgPerTeam: s.xg / N / 2,
    passAccuracy: ratio(s.completed, s.passes),
    eventsPerMatch: Object.fromEntries(Object.entries(s.events).map(([k, v]) => [k, v / N])),
    allIn: model >= 6 ? {eligibleTeams: s.allIn.eligibleTeams, chose: avgAllIn(s.allIn.chose), notChose: avgAllIn(s.allIn.notChose)} : null
  };
}

// Hedefler (docs/ARENA_MODEL6_CONTRACT.md "Kullanıcı kararları" ve Akış D görev tanımı).
export function targets(r) {
  const inRange = (v, lo, hi) => v >= lo && v <= hi;
  const late = r.minuteShare[5] === Math.max(...r.minuteShare);
  const list = [
    ['Maç başı gol', r.goalsPerMatch, '2,6–3,0', inRange(r.goalsPerMatch, 2.6, 3.0), 'sayı'],
    ['6+ gollü maç oranı', r.sixPlusMatchRate, '≤ %3', r.sixPlusMatchRate <= .03, 'yüzde'],
    ['Tek takımın 6+ golü (takım başı)', r.sixPlusTeamRate, 'çok nadir (≤ %1)', r.sixPlusTeamRate <= .01, 'yüzde'],
    ['Belirgin favori (fark ≥ 6) kazanma', r.favorite.win, '%60–70', inRange(r.favorite.win, .60, .70), 'yüzde'],
    ['Belirgin favori kaybetme', r.favorite.loss, '≤ %20 (hedef ~%15)', r.favorite.loss <= .20, 'yüzde'],
    ['Eşit güçte (fark 0–2) beraberlik', r.gap[0].draw, '~%26 (%22–30)', inRange(r.gap[0].draw, .22, .30), 'yüzde'],
    ['75–90 dilimi en yüksek gol dilimi', r.minuteShare[5], 'en yüksek', late, 'yüzde'],
    ['Asistli gol oranı', r.assistedGoalRate, '%70–78', inRange(r.assistedGoalRate, .70, .78), 'yüzde'],
    ['Penaltı golü payı', r.penaltyGoalShare, '%8–10', inRange(r.penaltyGoalShare, .08, .10), 'yüzde']
  ];
  if (r.allIn) {
    const {chose, notChose} = r.allIn;
    list.push(['Tüm riskleri al: seçenin attığı gol > seçmeyenin', chose.goalsFor - notChose.goalsFor, 'pozitif fark', chose.n > 0 && notChose.n > 0 && chose.goalsFor > notChose.goalsFor, 'fark']);
    list.push(['Tüm riskleri al: seçenin yediği gol > seçmeyenin', chose.goalsAgainst - notChose.goalsAgainst, 'belirgin pozitif fark', chose.n > 0 && notChose.n > 0 && chose.goalsAgainst > notChose.goalsAgainst, 'fark']);
  }
  return list.map(([name, value, target, ok, unit]) => ({name, value, target, ok, unit}));
}

const pct = (x, d = 1) => (100 * x).toFixed(d).replace('.', ',') + '%';
const num = (x, d = 2) => x.toFixed(d).replace('.', ',');
export function formatReport(r) {
  const out = [];
  out.push(`Transfer Arenası kalibrasyon raporu — model ${r.model}, ${r.matches} maç, tohum ${r.seed}${r.model >= 6 ? `, "Tüm riskleri al!" oranı ${pct(r.allInRate, 0)}` : ''}`);
  out.push('');
  out.push('Hedef karşılaştırması');
  for (const t of targets(r)) {
    const v = t.unit === 'yüzde' ? pct(t.value) : num(t.value);
    out.push(`  ${t.ok ? '✓' : '✗'}  ${t.name.padEnd(52)} ${v.padStart(8)}   hedef: ${t.target}`);
  }
  out.push('');
  out.push(`Gol dağılımı (toplam gol, 7 = 7+): ${r.goalDistribution.map((v, i) => `${i}: ${pct(v, 0)}`).join('  ')}`);
  out.push(`Bir takımın en fazla golü: ${r.maxTeamGoals} | hükmen biten maç: ${r.forfeits} | 6+ gollü maç: ${pct(r.sixPlusMatchRate)} | beraberlik: ${pct(r.drawRate)}`);
  out.push('');
  out.push('Takım gücü farkına göre güçlü takımın sonucu (G/B/M):');
  for (const g of r.gap) out.push(`  fark ${g.range.padEnd(4)} n=${String(g.n).padStart(5)}   G ${pct(g.win, 0).padStart(4)}  B ${pct(g.draw, 0).padStart(4)}  M ${pct(g.loss, 0).padStart(4)}`);
  out.push('');
  out.push(`Gol dakikaları (15 dk dilim): ${r.minuteShare.map((v, i) => `${i * 15}–${i * 15 + 15}: ${pct(v, 0)}`).join('  ')}`);
  const sp = Object.entries(r.setPieceGoalShare).filter(([, v]) => v > 0);
  out.push(`Penaltı golü payı: ${pct(r.penaltyGoalShare)} | duran top gol payı: ${sp.length ? sp.map(([k, v]) => `${k} ${pct(v)}`).join(', ') : 'olay etiketi yok'} | asistli gol: ${pct(r.assistedGoalRate)}`);
  out.push(`Kartlar (maç başı): sarı ${num(r.yellowPerMatch)}, kırmızı ${num(r.redPerMatch, 3)}`);
  out.push(`Takım başı: şut ${num(r.shotsPerTeam, 1)}, isabetli ${num(r.onTargetPerTeam, 1)}, xG ${num(r.xgPerTeam)}, pas isabeti ${pct(r.passAccuracy, 0)}`);
  out.push(`Yeni olaylar (maç başı): post ${num(r.eventsPerMatch.post, 3)}, büyük fırsat ${num(r.eventsPerMatch.big, 3)}, duran top ${num(r.eventsPerMatch.setPiece, 3)}, allIn ${num(r.eventsPerMatch.allIn, 3)}`);
  if (r.allIn) {
    const row = (name, b) => `  ${name.padEnd(12)} n=${String(b.n).padStart(5)}  attığı ${num(b.goalsFor)}  yediği ${num(b.goalsAgainst)}  şutu ${num(b.shots, 1)}  rakip şutu ${num(b.shotsAgainst, 1)}`;
    out.push('');
    out.push(`"Tüm riskleri al!" (70'te geride/berabere ${r.allIn.eligibleTeams} takım; 70–90 arası takım başı ortalama):`);
    out.push(row('seçenler', r.allIn.chose));
    out.push(row('seçmeyenler', r.allIn.notChose));
  }
  return out.join('\n');
}

function parseArgs(argv) {
  const o = {model: 6, matches: 3000, seed: 1, json: false, allInRate: .5};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') o.json = true;
    else if (a === '--model') o.model = Number(argv[++i]);
    else if (a === '--matches') o.matches = Number(argv[++i]);
    else if (a === '--seed') o.seed = Number(argv[++i]);
    else if (a === '--all-in-rate') o.allInRate = Number(argv[++i]);
    else throw Error(`Bilinmeyen bağımsız değişken: ${a}`);
  }
  if (!Number.isInteger(o.matches) || o.matches < 1 || !Number.isInteger(o.seed)) throw Error('--matches pozitif, --seed tam sayı olmalı');
  return o;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const o = parseArgs(process.argv.slice(2));
  const result = await calibrate(o);
  console.log(o.json ? JSON.stringify({...result, targets: targets(result)}, null, 2) : formatReport(result));
}
