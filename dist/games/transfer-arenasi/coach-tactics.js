import {coachEffect,coachRatingBoost} from './coach-card.js';
import {escapeHTML as esc} from './cards.js';
import {COACH_FIT_PER_STAR,STYLE_BEATS,STYLE_NAMES,TACTIC_PRESETS,matchPreset,styleWeakTo} from './tactic-presets.js';
const pct=n=>new Intl.NumberFormat('tr-TR',{maximumFractionDigits:1}).format(n);
export function coachBoostActive(coach,plan,players=[]){
 if(!coach)return false;
 switch(coach.specialty){
  case 'press':return Number(plan.press)===2;
  case 'passing':return plan.style==='short';
  case 'defense':return Number(plan.risk)===0;
  case 'transition':return plan.style==='counter';
  case 'development':return players.some(p=>p.position!=='GK'&&p.overall<=81);
  case 'discipline':return true;
  case 'attack':return Number(plan.risk)===2;
  case 'fitness':return true;
  default:return false;
 }
}
// Üçüncü argüman oyuncular, dördüncü argüman {rulesVersion}: model 7 odalarında taktik uyumu satırı eklenir.
export function coachTactics(coach,plan,players=[],{rulesVersion=0}={}){
 if(!coach)return '';
 const active=coachBoostActive(coach,plan,players);
 const fit=rulesVersion>=7?`<p class="coach-fit-line ${active?'on':'off'}">Taktik uyumu: tüm özelliklere +%${pct(coach.stars*COACH_FIT_PER_STAR*100)} · ${active?'etkin':'koşul bekleniyor'}</p>`:'';
 return `<aside class="tactic-coach ${active?'boost-active':''}"><div><strong>${esc(coach.name)} · ${coach.stars}★</strong><span>${active?'Boost etkin':'Boost koşulu bekleniyor'}</span></div><p>Takım gücü: tüm özelliklere +%${pct(coachRatingBoost(coach)*100)} (her zaman etkin)</p>${fit}<p>${esc(coachEffect(coach,{rulesVersion}))}</p></aside>`;
}
// Tarz üstünlüğü ipucu: yalnız kendi tarzın; rakibin taktiği gizlidir.
export function styleHint(style){
 if(!STYLE_BEATS[style])return '';
 return `Üstün: ${STYLE_NAMES[STYLE_BEATS[style]]} · Zayıf: ${STYLE_NAMES[styleWeakTo(style)]}`;
}
// Model 7 hazır profil kartları (2x2). Düğmeler type=button; seçili olan aria-pressed=true.
// Uyumu seçilen plana bağlı uzmanlıklar (bkz. coachBoostActive).
export const TACTIC_SPECIALTIES=Object.freeze(['press','passing','defense','transition','attack']);
export function presetPanel(plan,coach,players=[]){
 const current=matchPreset(plan);
 // Kondisyon, disiplin ve gelişim uzmanlıkları taktikten bağımsızdır: rozet her kartta çıkıp yol göstermesin diye
 // yalnız taktiğe bağlı uzmanlıklarda kart rozeti, diğerlerinde tek satırlık not gösterilir.
 const tacticalFit=!!coach&&TACTIC_SPECIALTIES.includes(coach.specialty);
 const alwaysFit=!!coach&&!tacticalFit&&coachBoostActive(coach,plan,players);
 const cards=TACTIC_PRESETS.map(preset=>{
  const on=current===preset.id,fit=tacticalFit&&coachBoostActive(coach,{...plan,...preset.plan},players);
  return `<button type="button" class="preset-card ${on?'selected':''}" data-preset="${preset.id}" aria-pressed="${on}"><strong>${preset.name}</strong><small class="preset-style">${STYLE_NAMES[preset.plan.style]}</small><small>${esc(preset.summary)}</small><small class="preset-edge">Üstün: ${STYLE_NAMES[STYLE_BEATS[preset.plan.style]]} · Zayıf: ${STYLE_NAMES[styleWeakTo(preset.plan.style)]}</small>${fit?'<em class="preset-fit">Hoca uyumu</em>':''}</button>`;
 }).join('');
 return `<div class="preset-head"><strong>Hazır taktik</strong><span class="preset-state">${current?esc(TACTIC_PRESETS.find(x=>x.id===current).name):'Özel'}</span></div><div class="preset-grid">${cards}</div><p class="style-hint">${styleHint(plan.style)}</p>${alwaysFit?'<p class="small muted preset-fit-note">Hocanın uyumu her taktikte etkin.</p>':''}`;
}
