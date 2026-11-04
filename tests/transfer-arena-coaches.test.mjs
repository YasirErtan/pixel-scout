import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {COACHES} from '../server/transfer-arena/coaches.js';
import {coachCard,coachEffect} from '../dist/games/transfer-arenasi/coach-card.js';
import {COACH_PORTRAITS} from '../dist/games/transfer-arenasi/coach-portraits.js';
import {selectCoaches,random} from '../server/transfer-arena/market.js';

test('expanded coach pool retains requested stars and adds two one-star and two two-star coaches',()=>{
 assert.equal(COACHES.length,24);assert.equal(new Set(COACHES.map(c=>c.id)).size,24);
 const find=name=>COACHES.find(c=>c.name===name);
 assert.equal(find('Fatih Terim').stars,5);assert.equal(find('Okan Buruk').stars,4);assert.equal(find('Emre Belözoğlu').stars,2);
 assert.equal(COACHES.filter(c=>c.stars===1&&c.id!=='coach-keller').length,2);
 assert.equal(COACHES.filter(c=>c.stars===2&&!['coach-emre-belozoglu','coach-di-matteo'].includes(c.id)).length,2);
});
test('every coach has a bundled licensed photo with attribution and a visible conditional effect',()=>{
 for(const coach of COACHES){
  const photo=COACH_PORTRAITS[coach.id];assert.ok(photo?.author&&photo?.source&&photo?.license&&photo?.licenseURL);
  assert.match(photo.source,/^https:\/\/commons.wikimedia.org\//);assert.match(photo.path,/^\.\/assets\/coaches\/[-a-z]+\.(jpg|png)$/);
  const bytes=fs.readFileSync(new URL('../dist/games/transfer-arenasi/'+photo.path,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),photo.sha256);
  const html=coachCard(coach);assert.ok(html.includes('coach-photo')&&html.includes('Fotoğraf kaynağı ve lisansı'));
  assert.ok(html.includes(coachEffect(coach)));assert.ok(!html.includes('♟'));
 }
 assert.match(coachEffect(COACHES.find(c=>c.name==='Fatih Terim')),/Yoğun pres.*%10/);
 assert.match(coachEffect(COACHES.find(c=>c.name==='Okan Buruk')),/Yoğun pres.*%8/);
 assert.match(coachEffect(COACHES.find(c=>c.name==='Emre Belözoğlu')),/Kontra.*1,2 yüzde puan/);
});
test('coach auctions use distinct star levels, with exactly one repeated level for six seats',()=>{
 for(let seats=3;seats<=6;seats++)for(let seed=1;seed<=100;seed++){
  const market=selectCoaches(COACHES,seats,random(seed));
  assert.equal(market.length,seats);assert.equal(new Set(market.map(c=>c.id)).size,seats);
  const counts=[1,2,3,4,5].map(stars=>market.filter(c=>c.stars===stars).length);
  if(seats<6)assert.ok(counts.every(n=>n<=1));
  else assert.deepEqual(counts.toSorted(),[1,1,1,1,2]);
 }
});
