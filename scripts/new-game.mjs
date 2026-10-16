import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const [slug, title = slug] = process.argv.slice(2);
if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 48) {
  console.error('Usage: npm run game:new -- penalty-quiz "Penaltı Quiz" (lowercase slug, max 48 chars)');
  process.exit(1);
}
const destination = path.join(root, 'dist/games', slug);
const registryPath = path.join(root, 'dist/games/registry.json');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
if (fs.existsSync(destination) || registry.some(game => game.id === slug)) {
  console.error('This game already exists; no files changed.');
  process.exit(1);
}
const escapeHtml = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
fs.mkdirSync(destination, { recursive: true });
for (const file of ['index.html', 'style.css', 'app.js']) {
  let text = fs.readFileSync(path.join(root, 'templates/mini-game', file), 'utf8');
  text = text.replaceAll('__GAME_TITLE__', escapeHtml(title)).replaceAll('__GAME_SLUG__', slug);
  fs.writeFileSync(path.join(destination, file), text);
}
registry.push({ id: slug, title, description: 'Yeni mini oyun · geliştirme aşamasında', href: `./${slug}/index.html` });
fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n');
console.log(`Created dist/games/${slug}/. Implement the game, then run npm run check.`);
