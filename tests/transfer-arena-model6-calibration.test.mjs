// Model 6 kalibrasyon hedefleri. Sabit tohumlu örneklem; aralıklar istatistiksel gürültü için hedeflerden biraz geniştir.
// Model 6 hedef aralıkları (Akış A kalibrasyonu birleşti; testler etkin).
import test from 'node:test';
import assert from 'node:assert/strict';
import {calibrate, teamStrength, targets} from '../scripts/calibrate-arena.mjs';

const MATCHES = 1500;

// İskelette de geçmesi gereken gerçek testler: takım gücü tanımı ve betiğin çalışması.
test('teamStrength: kaleci dahil ortalama overall × (1 + hoca çarpanı)', () => {
  const team = {players: [{overall: 80}, {overall: 70}, {overall: 90}], coach: {stars: 5}};
  assert.equal(teamStrength(team), 80 * 1.08);
  assert.equal(teamStrength({players: [{overall: 80}], coach: null}), 80);
});
test('calibrate: küçük örneklemle deterministik ve tutarlı sonuç verir', async () => {
  const a = await calibrate({model: 6, matches: 40, seed: 3}), b = await calibrate({model: 6, matches: 40, seed: 3});
  assert.deepEqual(a, b);
  assert.ok(a.goalsPerMatch > 0 && a.minuteShare.length === 6);
  assert.ok(Math.abs(a.minuteShare.reduce((x, y) => x + y, 0) - 1) < 1e-9);
  assert.ok(targets(a).length >= 9);
});

const sample = calibrate({model: 6, matches: MATCHES, seed: 1});
const between = (v, lo, hi, what) => assert.ok(v >= lo && v <= hi, `${what}: ${v} beklenen aralık ${lo}–${hi} dışında`);

test('model 6: maç başı gol 2,5–3,1', async () => between((await sample).goalsPerMatch, 2.5, 3.1, 'gol ortalaması'));
test('model 6: belirgin favori %58–72 kazanır, en fazla %20 kaybeder', async () => {
  const r = await sample;
  assert.ok(r.favorite.n >= 100, 'Yeterli belirgin favori maçı yok');
  between(r.favorite.win, .58, .72, 'favori kazanma');
  assert.ok(r.favorite.loss <= .20, `favori kaybetme ${r.favorite.loss}`);
});
test('model 6: 6+ gollü maç en fazla %3', async () => assert.ok((await sample).sixPlusMatchRate <= .03));
test('model 6: 75–90 dilimi en yüksek gol dilimidir', async () => {
  const share = (await sample).minuteShare;
  assert.equal(share[5], Math.max(...share), `dilimler: ${share.map(v => v.toFixed(3))}`);
});
test('model 6: asistli gol oranı %69–79', async () => between((await sample).assistedGoalRate, .69, .79, 'asistli gol'));
test('model 6: penaltı golü payı %7–11', async () => between((await sample).penaltyGoalShare, .07, .11, 'penaltı payı'));
test('model 6: "Tüm riskleri al!" seçen takım 70–90 arasında daha çok gol yer', async () => {
  const {chose, notChose} = (await sample).allIn;
  assert.ok(chose.n >= 100 && notChose.n >= 100, 'Yeterli örnek yok');
  assert.ok(chose.goalsAgainst > notChose.goalsAgainst * 1.1, `yediği: ${chose.goalsAgainst} / ${notChose.goalsAgainst}`);
  assert.ok(chose.shots > notChose.shots, 'Seçen takım daha çok şut atmalı');
});
