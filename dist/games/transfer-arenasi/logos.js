// Özgün, basit takım logoları (MIT). Her logo bir odada yalnızca bir takıma aittir.
const SHIELD='M32 3 58 11v19c0 16-12 26-26 31C18 56 6 46 6 30V11Z';
export const LOGOS=Object.freeze([
 Object.freeze({id:'yildiz',name:'Yıldız',color:'#d6423a',dark:'#7c1f1a',icon:'<path d="M32 16l4 10.6h11.3l-9.1 6.8 3.4 10.9L32 37.9l-9.6 6.4 3.4-10.9-9.1-6.8H28z"/>'}),
 Object.freeze({id:'simsek',name:'Şimşek',color:'#2f6fd6',dark:'#163a78',icon:'<path d="M36 13 21 35h10l-4 16 16-23H33z"/>'}),
 Object.freeze({id:'tac',name:'Taç',color:'#7a4bd0',dark:'#3d2273',icon:'<path d="M17 41 15 21l9.5 8.5L32 17l7.5 12.5L49 21l-2 20zM17 44h30v5H17z"/>'}),
 Object.freeze({id:'alev',name:'Alev',color:'#ef7d22',dark:'#8a3f08',icon:'<path d="M32 13c6 9 12 14 10.5 25C41.5 46 37 50 32 50c-6 0-11-5-10-12 .8-6 5-8 6-14 3 4 3 7 5 9 2-5 1-12-1-20z"/>'}),
 Object.freeze({id:'dalga',name:'Dalga',color:'#159aa6',dark:'#0a5158',icon:'<g fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"><path d="M16 24q4-5 8 0t8 0 8 0 8 0"/><path d="M16 33q4-5 8 0t8 0 8 0 8 0"/><path d="M16 42q4-5 8 0t8 0 8 0 8 0"/></g>'}),
 Object.freeze({id:'kale',name:'Kale',color:'#2e9b55',dark:'#14512a',icon:'<path d="M20 48V24h4v-5h5v5h6v-5h5v5h4v24h-8v-8a4 4 0 0 0-8 0v8z"/>'})
]);
export const LOGO_IDS=Object.freeze(LOGOS.map(logo=>logo.id));
export function logoById(id){return LOGOS.find(logo=>logo.id===id)||null;}
// Dekoratif kullanımda erişilebilir ad, yanında yazılan takım adından gelir.
export function logoSVG(id,size=24,label=''){
 const logo=logoById(id);if(!logo)return '';
 return `<svg class="team-logo" viewBox="0 0 64 64" width="${size}" height="${size}" ${label?`role="img" aria-label="${label}"`:'aria-hidden="true"'}><path d="${SHIELD}" fill="${logo.color}" stroke="${logo.dark}" stroke-width="3"/><g fill="#fff">${logo.icon}</g></svg>`;
}
