// İstemciye güvenle gösterilebilecek kamusal hata sınıfı ve yardımcıları.
export class ArenaError extends Error {
 constructor(message) {
  super(message);
  this.name = 'ArenaError';
  this.public = true;
 }
}
export const arenaError = message => new ArenaError(message);
export const isPublicError = err => Boolean(err && err.public === true);
