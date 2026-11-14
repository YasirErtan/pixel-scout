export const BONUS_CARDS = Object.freeze([
 Object.freeze({id:'president',name:'Başkan',description:'İhale bütçene 15 kredi ekler.',credits:15}),
 Object.freeze({id:'fan',name:'Taraftar',description:'İç saha lig maçlarında pas, ikili mücadele, şut ve kalecilik becerilerine %7 destek verir.',homeBoost:.07}),
 Object.freeze({id:'fitness',name:'Kondisyon',description:'Maç sırasında %25 daha az enerji harcarsın.',fatigueReduction:.25}),
 Object.freeze({id:'passing',name:'Pas Ustası',description:'Kısa pas ve oyun görüşüne %6 destek verir.',passingBoost:.06})
]);

export function bonusCardById(id) {
 return BONUS_CARDS.find(card=>card.id===id);
}
