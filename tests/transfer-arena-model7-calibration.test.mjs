// Model 7 kalibrasyon testleri: tarz üstünlüğü, hoca uyumu, hazır profiller ve genel sayılar (sabit tohum).
// Tam ölçüm için: node scripts/calibrate-arena.mjs --model 7 --matches 3000 --seed 1
// Burada çalışma süresini kısa tutmak için daha az maç ve biraz geniş toleranslar kullanılır.
import test from 'node:test';
import assert from 'node:assert/strict';
import {calibrate, calibrateTactics, PRESET_BEATS} from '../scripts/calibrate-arena.mjs';

test('model 7 tarz üstünlüğü: üstün taraf %44–52 kazanır, %24–31 kaybeder; nötr ve aynı tarz dengelidir', {timeout: 120000}, async () => {
  const {style} = await calibrateTactics({matches: 2000, seed: 11, only: ['style']});
  const {beats, weak, neutral, same} = style;
  assert.ok(beats.win >= .42 && beats.win <= .54, `üstün kazanma ${beats.win}`);
  assert.ok(beats.loss >= .21 && beats.loss <= .33, `üstün kaybetme ${beats.loss}`);
  assert.ok(weak.loss >= .42 && weak.win >= .21 && weak.win <= .33, `zayıf taraf ${weak.win}/${weak.loss}`);
  assert.ok(Math.abs(neutral.win - neutral.loss) <= .08, `nötr çift ${neutral.win}/${neutral.loss}`);
  assert.ok(Math.abs(same.win - same.loss) <= .08, `aynı tarz ${same.win}/${same.loss}`);
});

test('model 7 hoca uyumu: koşulu sağlayan 5★ hocalı takım ≥ %42 kazanır, ≤ %33 kaybeder', {timeout: 120000}, async () => {
  const {fit} = await calibrateTactics({matches: 1200, seed: 12, only: ['fit']});
  assert.ok(fit.win >= .42, `kazanma ${fit.win}`);
  assert.ok(fit.loss <= .33, `kaybetme ${fit.loss}`);
});

test('model 7 hazır profiller: baskın profil yok; her profil yalnız döngüdeki rakibini yener', {timeout: 180000}, async () => {
  const {presets, presetAverage} = await calibrateTactics({matches: 400, presetMatches: 400, seed: 13, only: ['presets']});
  for (const [id, avg] of Object.entries(presetAverage)) assert.ok(avg.win <= .45, `${id} ortalama kazanma ${avg.win}`);
  for (const [x, y] of Object.entries(PRESET_BEATS)) {
    const r = presets[`${x}>${y}`];
    assert.ok(r.win - r.loss >= .02, `${x} > ${y}: ${r.win}/${r.loss}`);
  }
});

test('model 7 genel sayılar model 6 hedefleri içinde kalır', {timeout: 120000}, async () => {
  const r = await calibrate({model: 7, matches: 1200, seed: 14});
  assert.ok(r.goalsPerMatch >= 2.6 && r.goalsPerMatch <= 3.1, `maç başı gol ${r.goalsPerMatch}`);
  assert.ok(r.sixPlusMatchRate <= .03, `6+ gollü maç ${r.sixPlusMatchRate}`);
  assert.ok(r.favorite.win >= .58 && r.favorite.win <= .72, `favori kazanma ${r.favorite.win}`);
});
