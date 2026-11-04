import {coachEffect} from './coach-card.js';
import {escapeHTML as esc} from './cards.js';
export function coachBoostActive(coach,plan,players=[]){
 if(!coach)return false;
 switch(coach.specialty){
  case 'press':return Number(plan.press)===2;
  case 'passing':return plan.style==='short';
  case 'defense':return Number(plan.risk)===0;
  case 'transition':return plan.style==='counter';
  case 'development':return players.some(p=>p.position!=='GK'&&p.overall<=81);
  case 'discipline':return true;
  default:return false;
 }
}
export function coachTactics(coach,plan,players=[]){
 if(!coach)return '';
 const active=coachBoostActive(coach,plan,players);
 return `<aside class="tactic-coach ${active?'boost-active':''}"><div><strong>${esc(coach.name)} · ${coach.stars}★</strong><span>${active?'Boost etkin':'Boost koşulu bekleniyor'}</span></div><p>${esc(coachEffect(coach))}</p></aside>`;
}
