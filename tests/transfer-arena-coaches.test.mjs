import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {COACHES} from '../server/transfer-arena/coaches.js';
import {coachCard,coachEffect} from '../dist/games/transfer-arenasi/coach-card.js';
import {COACH_PORTRAITS} from '../dist/games/transfer-arenasi/coach-portraits.js';
import {selectCoaches,random} from '../server/transfer-arena/market.js';

test('expanded coach pool retains requested stars and keeps every star level varied',()=>{
 assert.equal(COACHES.length,44);assert.equal(new Set(COACHES.map(c=>c.id)).size,44);
 for(const stars of [1,2,3,4,5])assert.ok(COACHES.filter(c=>c.stars===stars).length>=5,'her yıldız seviyesinde en az 5 hoca');
 const find=name=>COACHES.find(c=>c.name===name);
 assert.equal(find('Fatih Terim').stars,5);assert.equal(find('Okan Buruk').stars,4);assert.equal(find('Emre Belözoğlu').stars,2);
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

test('new attack and fitness specialties show their effect and activation condition',async()=>{
 const {coachBoostActive}=await import('../dist/games/transfer-arenasi/coach-tactics.js');
 const ferguson=COACHES.find(c=>c.name==='Alex Ferguson'),heynckes=COACHES.find(c=>c.name==='Jupp Heynckes');
 assert.match(coachEffect(ferguson),/Hücum riski.*2,5 yüzde puan/);assert.match(coachEffect(heynckes),/enerjiyi %7,5/);
 assert.equal(coachBoostActive(ferguson,{risk:2}),true);assert.equal(coachBoostActive(ferguson,{risk:1}),false);
 assert.equal(coachBoostActive(heynckes,{}),true);
});
