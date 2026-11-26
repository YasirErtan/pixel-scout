import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {generateKeyPairSync} from 'node:crypto';
import handler from '../api/transfer-arena.js';
import {ArenaError, arenaError, isPublicError} from '../server/transfer-arena/errors.js';
import {createRoom, command} from '../server/transfer-arena/room.js';
import {arenaService} from '../server/transfer-arena/service.js';

function createMockRes(){
 return {
  statusCode: 200,
  headers: {},
  body: null,
  setHeader(k, v){ this.headers[k] = v; },
  status(code){ this.statusCode = code; return this; },
  json(payload){ this.body = payload; return this; }
 };
}

function createMockReq(body, overrides = {}){
 return {
  method: 'POST',
  headers: {
   origin: 'https://arena.example',
   host: 'arena.example',
   'content-type': 'application/json',
   cookie: '__Host-arena=' + 'A'.repeat(43),
   ...overrides.headers
  },
  body,
  socket: {remoteAddress: '127.0.0.1'},
  ...overrides
 };
}

test('ArenaError ve isPublicError kamusal hataları iç hatalardan ayırır', () => {
 const pub = arenaError('Kamusal hata');
 assert.ok(pub instanceof Error);
 assert.ok(pub instanceof ArenaError);
 assert.equal(pub.name, 'ArenaError');
 assert.equal(pub.public, true);
 assert.equal(isPublicError(pub), true);

 assert.equal(isPublicError(new Error('internal secret')), false);
 assert.equal(isPublicError(new Error('CODE_COLLISION')), false);
 assert.equal(isPublicError(new SyntaxError('Unexpected token')), false);
 assert.equal(isPublicError(null), false);
 assert.equal(isPublicError(undefined), false);
 assert.equal(isPublicError({public: 'true'}), false);
});

test('tüm sunucu modüllerindeki throw ifadeleri (CODE_COLLISION hariç) arenaError kullanır', () => {
 const files = [
  'server/transfer-arena/room.js',
  'server/transfer-arena/market.js',
  'server/transfer-arena/simulation.js',
  'server/transfer-arena/service.js',
  'server/transfer-arena/store.js',
  'server/transfer-arena/limits.js'
 ];
 for (const rel of files) {
  const source = fs.readFileSync(rel, 'utf8');
  assert.match(source, /import\s+\{arenaError\}\s+from\s+'\.\/errors\.js'/, `${rel} errors.js içe aktarmalı`);
  const matches = [...source.matchAll(/\bthrow\s+([^;\n]+)/g)].map(m => m[1].trim());
  assert.ok(matches.length > 0, `${rel} en az bir throw içermeli`);
  for (const expr of matches) {
   if (rel.endsWith('service.js') && (expr === "Error('CODE_COLLISION')" || expr === 'e')) continue;
   assert.ok(expr.startsWith('arenaError('), `${rel} içinde beklenmeyen throw ifadesi: ${expr}`);
  }
 }
});

test('daha önce regex ile maskelenen kritik kullanıcı hataları public: true olarak fırlatılır', () => {
 const now = 1_700_000_000_000;
 let room = createRoom('123456', 'u1', 'Kurucu', 1, now);
 room = command(room, 'u2', {type: 'join', name: 'Misafir', requestId: 'j2'}, now);

 assert.throws(
  () => command(room, 'u1', {type: 'ready', requestId: 'r1'}, now),
  err => isPublicError(err) && err.message === 'Önce diziliş seç'
 );
 assert.throws(
  () => command(room, 'u2', {type: 'close', requestId: 'c1'}, now),
  err => isPublicError(err) && err.message === 'Yalnızca kurucu odayı kapatabilir'
 );
 assert.throws(
  () => command(room, '', {type: 'poll', requestId: 'p1'}, now),
  err => isPublicError(err) && err.message === 'Oturum ve istek kimliği gerekli'
 );

 const closedLobby = {...room, phase: 'prepare'};
 assert.throws(
  () => command(closedLobby, 'u1', {type: 'formation', formation: '2-2-2', requestId: 'f1'}, now),
  err => isPublicError(err) && err.message === 'Diziliş seçimi kapalı'
 );

 const expiredAllInRoom = {
  ...room,
  phase: 'secondHalf',
  phaseVersion: 5,
  nextSegment: null,
  matches: [{teams: [{id: 'u1', goals: 0}, {id: 'u2', goals: 1}], events: [], minute: 70}]
 };
 assert.throws(
  () => command(expiredAllInRoom, 'u1', {type: 'allIn', lock: 70, phaseVersion: 5, requestId: 'a1'}, now),
  err => isPublicError(err) && err.message === '"Tüm riskleri al!" süresi doldu'
 );

 const leadingAllInRoom = {
  ...room,
  phase: 'secondHalf',
  phaseVersion: 5,
  playbackCursor: 45,
  playbackStart: now - 14000,
  playbackEnd: 90,
  deadline: now + 16000,
  nextSegment: {start: 70, end: 90},
  matches: [{
   teams: [{id: 'u1', goals: 2}, {id: 'u2', goals: 0}],
   events: [{minute: 10, type: 'goal', team: 'u1'}],
   minute: 90
  }]
 };
 assert.throws(
  () => command(leadingAllInRoom, 'u1', {type: 'allIn', lock: 70, phaseVersion: 5, requestId: 'a2'}, now),
  err => isPublicError(err) && err.message === 'Önde olan takım tüm riskleri alamaz'
 );
});

test('service CODE_COLLISION sentinelini sızdırmaz ve beklenmeyen iç hatalar maskelenir', async () => {
 const collisionStore = {
  async transaction(key, update){
   if (key.startsWith('limits/')) return update(null);
   return update({createdAt: 999_999_999_000});
  }
 };
 const token = 'B'.repeat(43);
 const svcCollision = arenaService({store: collisionStore, data: {players: [], coaches: []}, clock: () => 1_000_000_000_000});
 await assert.rejects(
  () => svcCollision.handle({token, ip: '1.1.1.1', action: {type: 'create', name: 'A', requestId: 'c1'}}),
  err => isPublicError(err) && err.message === 'Oda açılamadı; tekrar dene'
 );

 const brokenStore = {
  async transaction(){ throw new Error('internal secret db-password'); }
 };
 const svcBroken = arenaService({store: brokenStore, data: {players: [], coaches: []}, clock: () => 1_000_000_000_000});
 await assert.rejects(
  () => svcBroken.handle({token, ip: '1.1.1.1', action: {type: 'poll', code: '123456', requestId: 'p1'}}),
  err => !isPublicError(err) && err.message === 'internal secret db-password'
 );
});

test('api/transfer-arena handler ortam, geçersiz body, beklenmeyen hata maskeleme ve kamusal hataları doğru işler', async () => {
 const prevEnv = {
  ARENA_SERVICE_ACCOUNT: process.env.ARENA_SERVICE_ACCOUNT,
  ARENA_DATABASE_URL: process.env.ARENA_DATABASE_URL,
  ARENA_FIREBASE_API_KEY: process.env.ARENA_FIREBASE_API_KEY
 };
 const prevFetch = globalThis.fetch;

 try {
  delete process.env.ARENA_SERVICE_ACCOUNT;
  delete process.env.ARENA_DATABASE_URL;
  delete process.env.ARENA_FIREBASE_API_KEY;

  // 1. Ortam değişkenleri yokken 503 döner
  {
   const res = createMockRes();
   await handler(createMockReq({type: 'poll', requestId: 'r0'}), res);
   assert.equal(res.statusCode, 503);
   assert.equal(res.body.error, 'Oda sunucusu henüz hazır değil');
  }

  // 2. Geçersiz veritabanı adresi (ArenaError) ağa çıkmadan kamusal mesajla 400 döner
  process.env.ARENA_DATABASE_URL = 'http://insecure.example.com';
  process.env.ARENA_SERVICE_ACCOUNT = '{}';
  process.env.ARENA_FIREBASE_API_KEY = 'dummy';
  {
   const res = createMockRes();
   await handler(createMockReq({type: 'poll', requestId: 'r1'}), res);
   assert.equal(res.statusCode, 400);
   assert.equal(res.body.error, 'Geçersiz veritabanı adresi');
  }

  // 3. Bozuk JSON service account (beklenmeyen SyntaxError) güvenli mesajla maskelenir
  process.env.ARENA_DATABASE_URL = 'https://arena-test.firebaseio.com';
  process.env.ARENA_SERVICE_ACCOUNT = '{bad-json';
  {
   const res = createMockRes();
   await handler(createMockReq({type: 'poll', requestId: 'r2'}), res);
   assert.equal(res.statusCode, 400);
   assert.equal(res.body.error, 'İstek tamamlanamadı; tekrar dene');
  }

  // 4. Geçerli yapılandırma ile service başlatılır; req.body undefined ve bozuk JSON string güvenli işlenir
  // Önemli: firebaseStore varsayılan `fetcher = fetch` değerini oluşturulurken yakalar; bu nedenle
  // ağa çıkmamak için mock fetch delegasyonu service oluşturulmadan önce kurulur.
  let fetchImpl = async () => { throw new Error('unexpected network call'); };
  globalThis.fetch = (...args) => fetchImpl(...args);

  const {privateKey} = generateKeyPairSync('rsa', {modulusLength: 2048});
  const pem = privateKey.export({type: 'pkcs8', format: 'pem'});
  process.env.ARENA_SERVICE_ACCOUNT = JSON.stringify({client_email: 'test-service-account', private_key: pem});

  {
   const res = createMockRes();
   await handler(createMockReq(undefined), res);
   assert.equal(res.statusCode, 400);
   assert.equal(res.body.error, 'Geçersiz istek');
  }

  {
   const res = createMockRes();
   await handler(createMockReq('{bozuk-json'), res);
   assert.equal(res.statusCode, 400);
   assert.equal(res.body.error, 'İstek tamamlanamadı; tekrar dene');
  }

  // 5. Beklenmeyen iç hata (fetch throw) maskelenir
  fetchImpl = async () => { throw new Error('internal secret connection string'); };
  {
   const res = createMockRes();
   await handler(createMockReq({type: 'poll', code: '123456', requestId: 'r3'}), res);
   assert.equal(res.statusCode, 400);
   assert.equal(res.body.error, 'İstek tamamlanamadı; tekrar dene');
  }

  // 6. Oda içinden fırlatılan kamusal ArenaError (ör. Önce diziliş seç) handler'dan aynen döner
  const now = Date.now();
  const token = 'A'.repeat(43);
  const {sessionIdentity} = await import('../server/transfer-arena/service.js');
  const room = createRoom('123456', sessionIdentity(token), 'TestTakim', 1, now);
  fetchImpl = async (url) => {
   const target = String(url);
   if (target.includes('identitytoolkit')) {
    return new Response(JSON.stringify({idToken: 'fake-id-token', expiresIn: '3600'}), {
     status: 200, headers: {'Content-Type': 'application/json'}
    });
   }
   return new Response(JSON.stringify({payload: JSON.stringify(room)}), {
    status: 200,
    headers: {'Content-Type': 'application/json', etag: '"etag-1"'}
   });
  };
  {
   const res = createMockRes();
   await handler(createMockReq({type: 'ready', code: '123456', requestId: 'r4'}), res);
   assert.equal(res.statusCode, 400);
   assert.equal(res.body.error, 'Önce diziliş seç');
  }
 } finally {
  globalThis.fetch = prevFetch;
  for (const [k, v] of Object.entries(prevEnv)) {
   if (v === undefined) delete process.env[k];
   else process.env[k] = v;
  }
 }
});
