import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {firebaseStore} from '../server/transfer-arena/store.js';

test('ETag conflicts retry with fresh state; arrays survive the database representation',async()=>{
 const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
 let version=0,payload=null,conflict=true,oauth=0;
 const fetcher=async(url,options)=>{
  if(String(url).includes('oauth2.googleapis.com')){oauth++;return Response.json({access_token:'test',expires_in:3600});}
  assert.equal(options.headers.Authorization,'Bearer test');
  if(!options.method)return Response.json(payload,{headers:{etag:String(version)}});
  if(conflict){conflict=false;version++;payload={payload:JSON.stringify({count:5,items:[]})};return new Response(null,{status:412});}
  assert.equal(options.headers['if-match'],String(version));payload=JSON.parse(options.body);version++;return Response.json(payload);
 };
 const store=firebaseStore({databaseURL:'https://example.firebaseio.com',serviceAccount:{client_email:'test',private_key:privateKey},fetcher});
 const result=await store.transaction('rooms/ABC',current=>({count:(current?.count||0)+1,items:current?.items||[],nested:{},nullable:null}));
 assert.equal(result.count,6);assert.deepEqual(result.items,[]);assert.equal(oauth,1);
 assert.deepEqual(JSON.parse(payload.payload),result);
 await store.transaction('rooms/ABC',x=>x);assert.equal(oauth,1);
 await assert.rejects(store.transaction('../invalid',x=>x),/Geçersiz/);
});

test('failed authentication never attempts a database write',async()=>{
 const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});let requests=0;
 const store=firebaseStore({databaseURL:'https://example.firebaseio.com',serviceAccount:{client_email:'test',private_key:privateKey},fetcher:async()=>{requests++;return new Response(null,{status:403});}});
 await assert.rejects(store.transaction('rooms/ABC',x=>x),/kimlik/);assert.equal(requests,1);
});
