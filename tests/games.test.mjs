import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
test('registered games have unique identifiers and local HTML entrypoints', () => {
  const games = JSON.parse(fs.readFileSync(path.join(root, 'dist/games/registry.json'), 'utf8'));
  const ids = new Set();
  for (const game of games) {
    assert.match(game.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(!ids.has(game.id)); ids.add(game.id);
    assert.ok(game.title && game.description);
    assert.match(game.href, /^\.\.?\//);
    const entry = path.resolve(root, 'dist/games', game.href);
    assert.ok(entry.startsWith(path.resolve(root, 'dist') + path.sep));
    assert.ok(fs.statSync(entry).isFile());
    assert.equal(path.extname(entry), '.html');
  }
});

test('scaffold creates an isolated game, escapes title markup and refuses overwrites or traversal', () => {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'pixel-scout-scaffold-'));
  try {
    fs.mkdirSync(path.join(sandbox, 'scripts'));
    fs.mkdirSync(path.join(sandbox, 'dist/games'), { recursive: true });
    fs.cpSync(path.join(root, 'templates'), path.join(sandbox, 'templates'), { recursive: true });
    fs.copyFileSync(path.join(root, 'scripts/new-game.mjs'), path.join(sandbox, 'scripts/new-game.mjs'));
    fs.writeFileSync(path.join(sandbox, 'dist/games/registry.json'), '[]');
    const script = path.join(sandbox, 'scripts/new-game.mjs');
    execFileSync(process.execPath, [script, 'penalty-quiz', '<Penalty & Quiz>']);
    const registry = JSON.parse(fs.readFileSync(path.join(sandbox, 'dist/games/registry.json')));
    assert.equal(registry[0].href, './penalty-quiz/index.html');
    const html = fs.readFileSync(path.join(sandbox, 'dist/games/penalty-quiz/index.html'), 'utf8');
    assert.ok(html.includes('&lt;Penalty &amp; Quiz&gt;'));
    assert.ok(!html.includes('__GAME_'));
    const app = fs.readFileSync(path.join(sandbox, 'dist/games/penalty-quiz/app.js'), 'utf8');
    assert.ok(app.includes('pixel-scout:penalty-quiz:v1'));
    assert.equal(spawnSync(process.execPath, [script, 'penalty-quiz']).status, 1);
    assert.equal(spawnSync(process.execPath, [script, '../escape']).status, 1);
    assert.equal(fs.readFileSync(path.join(sandbox, 'dist/games/penalty-quiz/index.html'), 'utf8'), html);
  } finally {
    const resolved = path.resolve(sandbox);
    assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep));
    assert.ok(path.basename(resolved).startsWith('pixel-scout-scaffold-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
});
