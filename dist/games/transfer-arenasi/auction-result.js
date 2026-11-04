import {escapeHTML as esc} from './cards.js';
export function auctionResult(result,teams){
 const name=id=>esc(teams.find(t=>t.id===id)?.name||'—');
 const statuses={pass:'Pas',timeout:'Teklif vermedi',ineligible:'Kadro yeri dolu'};
 return `<h2>İhale sonucu</h2><p class="auction-winner">${result.bidder?'🏆 '+name(result.bidder)+' · '+result.amount+' kredi':'Teklif gelmedi · Pas havuzuna gitti'}</p>${result.tied?'<p class="small">Eşit en yüksek teklifler arasında kura çekildi.</p>':''}<div class="result-card"><strong>${esc(result.card.name)}</strong><span>${result.card.kind==='coach'?result.card.stars+'★ · Teknik direktör':result.card.overall+' · '+esc(result.card.detailPosition||result.card.position)}</span></div><table class="offer-results"><thead><tr><th>Takım</th><th>Teklif</th></tr></thead><tbody>${result.rows.map(row=>`<tr ${row.team===result.bidder?'class="winning-offer"':''}><th>${name(row.team)}${row.team===result.bidder?' · Kazanan':''}</th><td>${row.amount!==null?row.amount+' kredi':statuses[row.status]}</td></tr>`).join('')}</tbody></table>`;
}
