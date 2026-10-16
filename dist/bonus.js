import { createRound } from './engine.js';
export const BONUS_ID = 'bonus-player';
// Fictional demo opener. No personal photograph or personal biography is bundled.
export const BONUS_PLAYER = {
 id: BONUS_ID, name: 'Bonus Oyuncu', aliases: ['Bonus', 'Bonus Oyuncu'], bonus: true,
 club: null, league: null, nationality: null, nationalityCode: null,
 position: null, birthDate: null, shirtNumber: null,
 photo: { path: 'assets/bonus/demo-player.svg', author: 'Pixel Scout contributors',
 sourcePage: null, license: 'MIT', licenseUrl: null, date: null,
 objectPosition: '50% 50%', scale: 1, transformOrigin: '50% 50%' }
};
export function isBonusRound(round) { return round?.targetId === BONUS_ID; }
export function openingRound() { return createRound(BONUS_ID, 'photo'); }
export function searchRosterForRound(round, normalRoster) {
 return isBonusRound(round) ? [BONUS_PLAYER, ...normalRoster] : normalRoster;
}
