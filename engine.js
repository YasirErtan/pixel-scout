/** Pure game rules. All dates use a fixed data snapshot, never the device clock. */
export const MAX_GUESSES = 8;
export const DEFAULT_AS_OF = '2026-10-14';

export function normalizeName(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/ı/g, 'i').replace(/ß/g, 'ss').replace(/ł/g, 'l')
    .replace(/[^a-z0-9]/g, '');
}

function dateParts(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return [year, month, day];
}

export function ageOn(birthDate, asOf = DEFAULT_AS_OF) {
  const birth = dateParts(birthDate), snapshot = dateParts(asOf);
  if (!birth || !snapshot) return null;
  const years = snapshot[0] - birth[0] - Number(snapshot[1] < birth[1] || (snapshot[1] === birth[1] && snapshot[2] < birth[2]));
  return years >= 0 ? years : null;
}

function equalKnown(a, b) {
  return a !== null && a !== undefined && a !== '' && b !== null && b !== undefined && b !== '' && normalizeName(a) === normalizeName(b);
}

function category(value, targetValue, status) {
  return { value: value ?? null, targetValue: targetValue ?? null, status, direction: null };
}

function numberCategory(value, targetValue) {
  const a = value === null || value === undefined || value === '' ? null : Number(value);
  const b = targetValue === null || targetValue === undefined || targetValue === '' ? null : Number(targetValue);
  const known = Number.isFinite(a) && Number.isFinite(b);
  return { value: Number.isFinite(a) ? a : null, targetValue: Number.isFinite(b) ? b : null,
    status: known && a === b ? 'exact' : 'miss', direction: known && a !== b ? (b > a ? 'up' : 'down') : null };
}

export function compareGuess(guess, target, { asOf = DEFAULT_AS_OF } = {}) {
  const nationality = guess.nationalityCode ?? guess.nationality;
  const targetNationality = target.nationalityCode ?? target.nationality;
  return {
    club: category(guess.club, target.club, equalKnown(guess.club, target.club) ? 'exact' : equalKnown(guess.league, target.league) ? 'league' : 'miss'),
    nationality: category(nationality, targetNationality, equalKnown(nationality, targetNationality) ? 'exact' : 'miss'),
    position: category(guess.position, target.position, equalKnown(guess.position, target.position) ? 'exact' : 'miss'),
    age: numberCategory(ageOn(guess.birthDate, asOf), ageOn(target.birthDate, asOf)),
    shirt: numberCategory(guess.shirtNumber, target.shirtNumber),
  };
}

function playerMap(players) {
  return new Map(players.filter(p => p && typeof p.id === 'string' && p.id).map(p => [p.id, p]));
}

export function createRound(targetId, mode = 'photo') {
  if (typeof targetId !== 'string' || !targetId) throw new Error('Invalid target');
  if (!['photo', 'hard'].includes(mode)) throw new Error('Invalid mode');
  return { targetId, mode, guessIds: [], status: 'playing', comparisons: [] };
}

/** Treat storage as untrusted. Discard malformed rounds and reconstruct all results. */
export function validateRound(saved, players, options = {}) {
  if (!saved || typeof saved !== 'object' || !['photo', 'hard'].includes(saved.mode) || !Array.isArray(saved.guessIds)) return null;
  const byId = playerMap(players);
  if (!byId.has(saved.targetId) || saved.guessIds.length > MAX_GUESSES || new Set(saved.guessIds).size !== saved.guessIds.length || saved.guessIds.some(id => !byId.has(id))) return null;
  const winIndex = saved.guessIds.indexOf(saved.targetId);
  // No legal round can contain a guess after the correct answer.
  if (winIndex !== -1 && winIndex !== saved.guessIds.length - 1) return null;
  const target = byId.get(saved.targetId);
  return { targetId: saved.targetId, mode: saved.mode, guessIds: [...saved.guessIds],
    status: winIndex !== -1 ? 'won' : saved.guessIds.length === MAX_GUESSES ? 'lost' : 'playing',
    comparisons: saved.guessIds.map(id => compareGuess(byId.get(id), target, options)) };
}

export function submitGuess(round, guessId, players, options = {}) {
  const current = validateRound(round, players, options);
  if (!current) throw new Error('Invalid round');
  if (current.status !== 'playing') throw new Error('Round is finished');
  if (!playerMap(players).has(guessId)) throw new Error('Unknown player');
  if (current.guessIds.includes(guessId)) throw new Error('Player already guessed');
  return validateRound({ ...current, guessIds: [...current.guessIds, guessId] }, players, options);
}

function shuffle(ids, rng) {
  const result = [...ids];
  for (let i = result.length - 1; i > 0; i--) {
    const random = Number(rng());
    if (!Number.isFinite(random) || random < 0 || random >= 1) throw new Error('Random source must return a number in [0, 1)');
    const j = Math.floor(random * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Pass only eligible players. A changed filter/pool invalidates the old bag. */
export function drawNext(players, savedBag = {}, rng = Math.random) {
  const byId = playerMap(players);
  const ids = [...byId.keys()].sort();
  const signature = JSON.stringify(ids);
  const prior = savedBag && typeof savedBag === 'object' ? savedBag : {};
  const validRemaining = prior.signature === signature && Array.isArray(prior.remaining) && new Set(prior.remaining).size === prior.remaining.length && prior.remaining.every(id => byId.has(id));
  let remaining = validRemaining ? [...prior.remaining] : [];
  if (!ids.length) return { player: null, bag: { signature, remaining: [], lastId: null } };
  if (!remaining.length) {
    remaining = shuffle(ids, rng);
    // Draw from the end; do not repeat the last player at a cycle boundary.
    if (remaining.length > 1 && remaining.at(-1) === prior.lastId) {
      [remaining[0], remaining[remaining.length - 1]] = [remaining.at(-1), remaining[0]];
    }
  }
  const id = remaining.pop();
  return { player: byId.get(id), bag: { signature, remaining, lastId: id } };
}
