import {escapeHTML as esc} from './cards.js';
import {logoSVG} from './logos.js';
export function auctionResult(result,teams){
 const name=id=>{const t=teams.find(t=>t.id===id);return t?(t.logo?logoSVG(t.logo,18)+' ':'')+esc(t.name):'—';};
 const statuses={pass:'Pas',timeout:'Teklif vermedi',ineligible:'Kadro yeri dolu'};
 const tiedTeams=result.tied&&result.tieBreak==='firstLocked'?(result.offers||[]).filter(o=>o.amount===result.amount).map(o=>o.team):[];
 const tieNote=result.tieBreak==='firstLocked'?`Eşit teklif (${result.amount} kredi): teklifini ilk kilitleyen ${name(result.bidder)} kazandı.`:'Eşit en yüksek teklifler arasında kura çekildi.';
 return `<h2>İhale sonucu</h2><p class="auction-winner">${result.bidder?'🏆 '+name(result.bidder)+' · '+result.amount+' kredi':'Teklif gelmedi · Pas havuzuna gitti'}</p>${result.tied?`<p class="tie-note">${tieNote}</p>`:''}<div class="result-card"><strong>${esc(result.card.name)}</strong><span>${result.card.kind==='coach'?result.card.stars+'★ · Teknik direktör':result.card.overall+' · '+esc(result.card.detailPosition||result.card.position)}</span></div><table class="offer-results"><thead><tr><th>Takım</th><th>Teklif</th></tr></thead><tbody>${result.rows.map(row=>`<tr ${row.team===result.bidder?'class="winning-offer"':''}><th>${name(row.team)}${row.team===result.bidder?' · Kazanan':tiedTeams.includes(row.team)?' · Sonra kilitledi':''}</th><td>${row.amount!==null?row.amount+' kredi':statuses[row.status]}</td></tr>`).join('')}</tbody></table>`;
}
