import test from 'node:test';
import assert from 'node:assert/strict';
import {COACH_FIT_PER_STAR,COACH_SPECIALTY_PER_STAR,STYLE_BEATS,STYLE_EDGE,STYLE_NAMES,TACTIC_PRESETS,matchPreset,styleEdge,styleWeakTo} from '../dist/games/transfer-arenasi/tactic-presets.js';
import {coachTactics,presetPanel,styleHint} from '../dist/games/transfer-arenasi/coach-tactics.js';
import {coachEffect} from '../dist/games/transfer-arenasi/coach-card.js';
import {mechanicsHTML} from '../dist/games/transfer-arenasi/mechanics.js';

const tr=n=>new Intl.NumberFormat('tr-TR',{maximumFractionDigits:2}).format(n);
const coach={id:'c',name:'Test Hoca',stars:4,specialty:'press'};

test('matchPreset her profili tanır, değiştirilmiş planı Özel sayar',()=>{
 for(const preset of TACTIC_PRESETS){
  assert.equal(matchPreset(preset.plan),preset.id);
  assert.equal(matchPreset({...preset.plan,press:String(preset.plan.press)}),preset.id);
  assert.equal(matchPreset({...preset.plan,tackle:(preset.plan.tackle+1)%4}),null);
 }
 assert.equal(matchPreset(undefined),null);
});

test('tarz döngüsü tutarlı: her tarz birine üstün, birine zayıf',()=>{
 for(const style of Object.keys(STYLE_NAMES)){
  assert.equal(styleEdge(style,STYLE_BEATS[style]),1);
  assert.equal(styleEdge(STYLE_BEATS[style],style),-1);
  assert.equal(STYLE_BEATS[styleWeakTo(style)],style);
  assert.equal(styleEdge(style,style),0);
 }
 assert.equal(styleHint('counter'),`Üstün: ${STYLE_NAMES.short} · Zayıf: ${STYLE_NAMES.direct}`);
});

test('presetPanel dört kart, seçili durum ve hoca uyumu rozeti',()=>{
 const preset=TACTIC_PRESETS[0],html=presetPanel(preset.plan,coach,[]);
 assert.equal((html.match(/data-preset=/g)||[]).length,4);
 assert.equal((html.match(/aria-pressed="true"/g)||[]).length,1);
 assert.match(html,/<button type="button"/);
 for(const p of TACTIC_PRESETS)assert.ok(html.includes(p.name));
 // press hocası yalnız press=2 profillerde uyum alır
 const fitCount=(html.match(/Hoca uyumu/g)||[]).length;
 assert.equal(fitCount,TACTIC_PRESETS.filter(p=>p.plan.press===2).length);
 const custom=presetPanel({...preset.plan,press:0},null);
 assert.match(custom,/Özel/);assert.equal((custom.match(/aria-pressed="true"/g)||[]).length,0);
});

test('coachTactics model 7 uyum satırı; eski odalarda yok',()=>{
 const pct=tr(coach.stars*COACH_FIT_PER_STAR*100);
 const on=coachTactics(coach,{press:2,style:'short'},[],{rulesVersion:7});
 assert.ok(on.includes(`Taktik uyumu: tüm özelliklere +%${pct}`));assert.match(on,/etkin/);
 const off=coachTactics(coach,{press:0,style:'short'},[],{rulesVersion:7});
 assert.match(off,/koşul bekleniyor/);
 assert.ok(!coachTactics(coach,{press:2,style:'short'},[]).includes('Taktik uyumu'));
 assert.ok(!coachTactics(coach,{press:2,style:'short'},[],{rulesVersion:6}).includes('Taktik uyumu'));
});

test('coachEffect sürüm farkındalıklı, varsayılan eski sayılar',()=>{
 assert.match(coachEffect(coach),/%8 azaltır/);
 assert.ok(coachEffect(coach,{rulesVersion:7}).includes('%'+tr(4*COACH_SPECIALTY_PER_STAR*100)));
});

test('mechanicsHTML model 7 sayılarını içe aktarılan sabitlerden gösterir',()=>{
 const html=mechanicsHTML();
 assert.ok(html.includes('Kontra atak &gt; Kısa pas')||html.includes('Kontra atak > Kısa pas'));
 assert.ok(html.includes(`${STYLE_NAMES.counter} > ${STYLE_NAMES.short} > ${STYLE_NAMES.wide} > ${STYLE_NAMES.direct} > ${STYLE_NAMES.counter}`));
 for(const p of TACTIC_PRESETS)assert.ok(html.includes(p.name));
 for(const k of ['pass','progress','tackle','xg'])assert.ok(html.includes('+'+tr(STYLE_EDGE[k]*100)+' '));
 assert.ok(html.includes('+%'+tr(COACH_FIT_PER_STAR*100)));
 assert.ok(html.includes('%'+tr(COACH_SPECIALTY_PER_STAR*100)));
});

test('her taktikte etkin uzmanlıklar kart rozeti yerine tek not gösterir',()=>{
 const plan=TACTIC_PRESETS[2].plan;
 for(const specialty of ['fitness','discipline']){
  const html=presetPanel(plan,{name:'H',stars:5,specialty},[]);
  assert.equal((html.match(/Hoca uyumu/g)||[]).length,0);
  assert.match(html,/her taktikte etkin/);
 }
 // Taktiğe bağlı uzmanlıkta (pas oyunu → kısa pas) yalnız uyan kart rozet alır, not çıkmaz.
 const passing=presetPanel(plan,{name:'H',stars:5,specialty:'passing'},[]);
 assert.equal((passing.match(/Hoca uyumu/g)||[]).length,1);assert.doesNotMatch(passing,/her taktikte etkin/);
});
