import {createHash,randomBytes,randomInt} from 'node:crypto';
import {createRoom,command,publicView} from './room.js';
import {addChampion,championEntry,publicChampions} from './champions.js';
import {memoryLimiter} from './limits.js';
import {arenaError} from './errors.js';

// Genel istek sınırları (dakikada). Aynı ağdaki 6 cihaz, "Tüm riskleri al!" penceresindeki sık yoklamada
// bile IP sınırının altında kalır; tek cihaz normalde dakikada ~40, pencerede ~75 istek gönderir.
export const IP_LIMIT=1200,SESSION_LIMIT=300,LIMIT_WINDOW=60000;
// Görünüm özeti: istemci son özeti gönderirse ve görünüm değişmediyse tam oda yerine kısa yanıt döner.
export const viewHash=view=>createHash('sha256').update(JSON.stringify(view)).digest('base64url').slice(0,22);

export const sessionIdentity=token=>createHash('sha256').update(token).digest('hex');
export function arenaService({store,data,clock=Date.now,limiter=memoryLimiter()}){
 async function quota(key,limit,window){
  const now=clock();await store.transaction('limits/'+key,current=>{
   const bucket=current&&now<current.until?current:{count:0,until:now+window};
   if(bucket.count>=limit)throw arenaError('Çok sık istek gönderildi; biraz bekle');return {...bucket,count:bucket.count+1};
  });
 }
 // Liste yazılamasa bile biten oyun bozulmaz; sonraki yoklamada yeniden denenir.
 async function recordChampion(room,now){
  if(room.phase!=='finished'||room.championRecorded)return;
  const entry=championEntry(room,now);if(!entry)return;
  try{
   await store.transaction('champions',list=>addChampion(list,entry));
   await store.transaction('rooms/'+room.id,current=>current?{...current,championRecorded:true}:undefined);
  }catch{}
 }
 async function handle({token,ip,action}){
  if(!token||!/^[a-zA-Z0-9_-]{43}$/.test(token))throw arenaError('Oturum gerekli');
  const uid=sessionIdentity(token),now=clock();
  const ipKey=sessionIdentity(String(ip||'unknown'));
  limiter('ip:'+ipKey,IP_LIMIT,LIMIT_WINDOW,now);
  limiter('session:'+uid,SESSION_LIMIT,LIMIT_WINDOW,now);
  if(!action||typeof action!=='object'||!/^[-a-zA-Z0-9]{1,80}$/.test(action.requestId||''))throw arenaError('Geçersiz istek');
  if(action.type==='create'){
   await quota('create_'+ipKey,5,3600000);
   for(let attempt=0;attempt<10;attempt++){
    const code=String(randomInt(100000,1000000));
    try{
     const room=await store.transaction('rooms/'+code,current=>{
      if(current&&now<current.createdAt+86400000)throw Error('CODE_COLLISION');
      if(['bonusEnabled','bonusCardsEnabled'].some(key=>action[key]!==undefined&&typeof action[key]!=='boolean'))throw arenaError('Geçersiz bonus seçimi');
      return createRoom(code,uid,action.name,randomInt(0,4294967296),now,{bonusEnabled:action.bonusEnabled===true,bonusCardsEnabled:action.bonusCardsEnabled===true});
     });return respond(publicView(room,uid,now),uid,now);
    }catch(e){if(e.message!=='CODE_COLLISION')throw e;}
   }
   throw arenaError('Oda açılamadı; tekrar dene');
  }
  if(action.type==='champions')return {champions:publicChampions(await store.transaction('champions',list=>list??undefined))};
  if(!/^\d{6}$/.test(action.code||''))throw arenaError('Altı haneli oda kodu gerekli');
  const room=await store.transaction('rooms/'+action.code,current=>{
   if(!current||now>=current.createdAt+86400000)throw arenaError('Oda bulunamadı veya süresi doldu');
   return command(current,uid,action,now,data);
  });
  await recordChampion(room,now);
  const view=publicView(room,uid,now);
  if(action.type==='poll'&&typeof action.since==='string'&&action.since===viewHash(view))return {unchanged:true,viewHash:action.since,serverNow:now};
  return respond(view,uid,now);
 }
 function respond(view,uid,now){return {...view,uid,serverNow:now,viewHash:viewHash(view)};}
 return {handle};
}
export function newSession(){return randomBytes(32).toString('base64url');}
