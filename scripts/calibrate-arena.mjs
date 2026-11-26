// Transfer Arenası maç modeli kalibrasyon ölçümü (model 5, 6 ve 7).
// Kullanım: node scripts/calibrate-arena.mjs --model 5|6|7 --matches 3000 --seed 1 [--json] [--all-in-rate 0.5]
// Model 7 ayrıca taktik katmanını ölçer: tarz üstünlüğü, hoca uyumu ve hazır profiller (--tactics ile yalnız bu bölüm).
// Kadrolar ihale pazarından kurulur; dizilişler ve taktikler sabit tohumla rastgele seçilir (deterministik).
// Ağa çıkmaz; yalnız yerel oyuncu verisini okur.
import {fileURLToPath} from 'node:url';
import {beginMatch, simulateHalf, simulateSegment, allInEligible, DEFAULT_PLAN} from '../server/transfer-arena/simulation.js';
import {arenaData} from '../server/transfer-arena/data.js';
import {makeMarket, random, shuffle} from '../server/transfer-arena/market.js';
import {COACHES} from '../server/transfer-arena/coaches.js';
import {TACTIC_PRESETS} from '../dist/games/transfer-arenasi/tactic-presets.js';
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
  let m = beginMatch(teams[0], teams[1], seed, referee, {version: model, neutral: true});
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
  if (![3, 4, 5, 6, 7].includes(model)) throw Error('Model 3, 4, 5, 6 ya da 7 olmalı');
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

// ---- Model 7 taktik ölçümleri ----
// Taktik ölçümlerinde takımlar eşit güçtedir; hoca yoksa yalnız taktik farkı ölçülür.
const plain = team => ({...team, coach: null});
// Eşit güçte (takım gücü farkı < 2) iki gerçekçi takım; hoca yok.
export function equalTeams(data, next) { for (;;) { const t = buildTeams(data, next).map(plain); if (Math.abs(teamStrength(t[0]) - teamStrength(t[1])) < 2) return t; } }
export function playTactic(a, b, planA, planB, seed, referee) {
  const plans = [planA, planB];
  let m = beginMatch(a, b, seed, referee, {version: 7, neutral: true});
  for (const [start, end] of SLICES) { if (m.finished) break; m = simulateSegment(m, plans, {start, end}); }
  return m;
}
export const rec = () => ({n: 0, w: 0, d: 0, l: 0, goalsFor: 0, goalsAgainst: 0});
export function add(r, ga, gb) { r.n++; r.goalsFor += ga; r.goalsAgainst += gb; if (ga > gb) r.w++; else if (ga === gb) r.d++; else r.l++; }
export const rates = r => ({n: r.n, win: r.w / r.n, draw: r.d / r.n, loss: r.l / r.n, goals: (r.goalsFor + r.goalsAgainst) / r.n});
const STYLE_ORDER = ['counter', 'short', 'wide', 'direct'], BEATS = {counter: 'short', short: 'wide', wide: 'direct', direct: 'counter'};
const SPECIALTY_FOR = {short: 'passing', counter: 'transition'};

export async function calibrateTactics({matches = 3000, seed = 1, presetMatches = matches, only = ['style', 'fit', 'presets']} = {}) {
  const data = await arenaData(), next = random((Math.imul(seed >>> 0, 2654435761) + 20261126) >>> 0);
  const sliders = () => ({press: Math.floor(next() * 3), risk: Math.floor(next() * 3), tempo: Math.floor(next() * 3), width: Math.floor(next() * 3), tackle: Math.floor(next() * 4)});
  let n = 0;
  const nextSeed = () => (Math.imul(seed >>> 0, 1000003) + 7919 * (n++)) >>> 0;
  // 1) Tarz üstünlüğü: aynı kaydırıcılar; A'nın tarzı B'ninkini yener / A zayıf / nötr çift / aynı tarz.
  const style = {beats: rec(), weak: rec(), neutral: rec(), same: rec()};
  for (let i = 0; i < (only.includes('style') ? matches : 0); i++) {
    const [a, b] = equalTeams(data, next), sl = sliders();
    const sa = STYLE_ORDER[i % 4], kind = ['beats', 'weak', 'neutral', 'same'][Math.floor(i / 4) % 4];
    const sb = kind === 'beats' ? BEATS[sa] : kind === 'weak' ? STYLE_ORDER.find(k => BEATS[k] === sa) : kind === 'neutral' ? BEATS[BEATS[sa]] : sa;
    const m = playTactic(a, b, {...DEFAULT_PLAN, formation: a.formation, ...sl, style: sa}, {...DEFAULT_PLAN, formation: b.formation, ...sl, style: sb}, nextSeed(), i % 3);
    add(style[kind], m.teams[0].goals, m.teams[1].goals);
  }
  // 2) Hoca uyumu: iki takım da 5★ hoca; A'nın planı hocasının koşulunu sağlar, B'ninki sağlamaz (aynı plan).
  const fit = rec();
  for (let i = 0; i < (only.includes('fit') ? matches : 0); i++) {
    const [t0, t1] = equalTeams(data, next), sl = {...sliders(), press: Math.floor(next() * 2)}, st = i % 2 ? 'short' : 'counter';
    const a = {...t0, coach: {id: 'fa', name: 'A', stars: 5, specialty: SPECIALTY_FOR[st]}};
    const b = {...t1, coach: {id: 'fb', name: 'B', stars: 5, specialty: 'press'}}; // press<=1: koşul sağlanmaz
    const plan = {...DEFAULT_PLAN, ...sl, style: st};
    const m = playTactic(a, b, {...plan, formation: a.formation}, {...plan, formation: b.formation}, nextSeed(), i % 3);
    add(fit, m.teams[0].goals, m.teams[1].goals);
  }
  // 3) Hazır profiller: 16 eşleşme (hazır plan + varsayılanlar, diziliş 2-2-2).
  const presets = {};
  for (const x of TACTIC_PRESETS) for (const y of TACTIC_PRESETS) presets[x.id + '>' + y.id] = rec();
  for (const x of TACTIC_PRESETS) for (const y of TACTIC_PRESETS) for (let i = 0; i < (only.includes('presets') ? presetMatches : 0); i++) {
    const [a, b] = equalTeams(data, next);
    const m = playTactic(a, b, {...DEFAULT_PLAN, ...x.plan, formation: '2-2-2'}, {...DEFAULT_PLAN, ...y.plan, formation: '2-2-2'}, nextSeed(), i % 3);
    add(presets[x.id + '>' + y.id], m.teams[0].goals, m.teams[1].goals);
  }
  const presetRates = Object.fromEntries(Object.entries(presets).map(([k, v]) => [k, rates(v)]));
  const presetAverage = Object.fromEntries(TACTIC_PRESETS.map(x => {
    const rows = TACTIC_PRESETS.map(y => presetRates[x.id + '>' + y.id]);
    return [x.id, {win: rows.reduce((s, r) => s + r.win, 0) / rows.length, loss: rows.reduce((s, r) => s + r.loss, 0) / rows.length}];
  }));
  return {matches, seed, style: Object.fromEntries(Object.entries(style).map(([k, v]) => [k, rates(v)])), fit: rates(fit), presets: presetRates, presetAverage};
}
// Hangi hazır profilin hangisini yenmesi gerektiği (tarz döngüsüne göre).
export const PRESET_BEATS = {katenacyo: 'tikitaka', tikitaka: 'gegenpress', gegenpress: 'kontra', kontra: 'katenacyo'};
export function tacticTargets(t) {
  const inRange = (v, lo, hi) => v >= lo && v <= hi, list = [];
  list.push(['Tarz üstünlüğü: kazanma', t.style.beats.win, '%44–52', inRange(t.style.beats.win, .44, .52)]);
  list.push(['Tarz üstünlüğü: kaybetme', t.style.beats.loss, '%24–31', inRange(t.style.beats.loss, .24, .31)]);
  list.push(['Tarz zayıf: kazanma (simetri)', t.style.weak.win, '%24–31', inRange(t.style.weak.win, .24, .31)]);
  list.push(['Nötr çift: kazanma-kaybetme', t.style.neutral.win - t.style.neutral.loss, '±%4', Math.abs(t.style.neutral.win - t.style.neutral.loss) <= .04]);
  list.push(['Aynı tarz: kazanma-kaybetme', t.style.same.win - t.style.same.loss, '±%4', Math.abs(t.style.same.win - t.style.same.loss) <= .04]);
  list.push(['Hoca uyumu: kazanma', t.fit.win, '≥ %42', t.fit.win >= .42]);
  list.push(['Hoca uyumu: kaybetme', t.fit.loss, '≤ %33', t.fit.loss <= .33]);
  for (const [id, avg] of Object.entries(t.presetAverage)) list.push([`Profil ${id} ortalama kazanma`, avg.win, '≤ %45', avg.win <= .45]);
  for (const [x, y] of Object.entries(PRESET_BEATS)) { const r = t.presets[x + '>' + y]; list.push([`Profil ${x} > ${y}`, r.win - r.loss, 'pozitif fark', r.win > r.loss]); }
  return list.map(([name, value, target, ok]) => ({name, value, target, ok}));
}
export function formatTactics(t) {
  const out = [`Model 7 taktik ölçümleri (${t.matches} maç / ölçüm, tohum ${t.seed})`, ''];
  for (const x of tacticTargets(t)) out.push(`  ${x.ok ? '✓' : '✗'}  ${x.name.padEnd(46)} ${pct(x.value).padStart(8)}   hedef: ${x.target}`);
  out.push('', 'Tarz eşleşmeleri (A G/B/M):');
  for (const [k, v] of Object.entries(t.style)) out.push(`  ${k.padEnd(8)} ${pct(v.win, 0)} / ${pct(v.draw, 0)} / ${pct(v.loss, 0)}  gol ${num(v.goals)}`);
  out.push(`  hoca uyumu ${pct(t.fit.win, 0)} / ${pct(t.fit.draw, 0)} / ${pct(t.fit.loss, 0)}`, '', 'Profil eşleşmeleri (satır G/B/M):');
  for (const [k, v] of Object.entries(t.presets)) out.push(`  ${k.padEnd(22)} ${pct(v.win, 0)} / ${pct(v.draw, 0)} / ${pct(v.loss, 0)}`);
  return out.join('\n');
}

function parseArgs(argv) {
  const o = {model: 6, matches: 3000, seed: 1, json: false, allInRate: .5, tactics: false};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') o.json = true;
    else if (a === '--tactics') { o.tactics = true; o.model = 7; }
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
  if (o.tactics) {
    const t = await calibrateTactics({matches: o.matches, seed: o.seed});
    console.log(o.json ? JSON.stringify({...t, targets: tacticTargets(t)}, null, 2) : formatTactics(t));
  } else {
    const result = await calibrate(o);
    console.log(o.json ? JSON.stringify({...result, targets: targets(result)}, null, 2) : formatReport(result));
    if (o.model >= 7 && !o.json) console.log('\n' + formatTactics(await calibrateTactics({matches: o.matches, seed: o.seed})));
  }
}
