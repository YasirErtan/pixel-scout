import {createHash,randomBytes,randomInt} from 'node:crypto';
import {createRoom,command,publicView} from './room.js';
import {addChampion,championEntry,publicChampions} from './champions.js';

export const sessionIdentity=token=>createHash('sha256').update(token).digest('hex');
export function arenaService({store,data,clock=Date.now}){
 async function quota(key,limit,window){
  const now=clock();await store.transaction('limits/'+key,current=>{
   const bucket=current&&now<current.until?current:{count:0,until:now+window};
   if(bucket.count>=limit)throw Error('Çok sık istek gönderildi; biraz bekle');return {...bucket,count:bucket.count+1};
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
  if(!token||!/^[a-zA-Z0-9_-]{43}$/.test(token))throw Error('Oturum gerekli');
  const uid=sessionIdentity(token),now=clock();
  const ipKey=sessionIdentity(String(ip||'unknown'));
  await quota(ipKey,600,60000);
  if(!action||typeof action!=='object'||!/^[-a-zA-Z0-9]{1,80}$/.test(action.requestId||''))throw Error('Geçersiz istek');
  if(action.type==='create'){
   await quota('create_'+ipKey,5,3600000);
   for(let attempt=0;attempt<10;attempt++){
    const code=String(randomInt(100000,1000000));
    try{
     const room=await store.transaction('rooms/'+code,current=>{
      if(current&&now<current.createdAt+86400000)throw Error('CODE_COLLISION');
      if(['bonusEnabled','bonusCardsEnabled'].some(key=>action[key]!==undefined&&typeof action[key]!=='boolean'))throw Error('Geçersiz bonus seçimi');
      return createRoom(code,uid,action.name,randomInt(0,4294967296),now,{bonusEnabled:action.bonusEnabled===true,bonusCardsEnabled:action.bonusCardsEnabled===true});
     });return {...publicView(room,uid,now),uid,serverNow:now};
    }catch(e){if(e.message!=='CODE_COLLISION')throw e;}
   }
   throw Error('Oda açılamadı; tekrar dene');
  }
  if(action.type==='champions')return {champions:publicChampions(await store.transaction('champions',list=>list??undefined))};
  if(!/^\d{6}$/.test(action.code||''))throw Error('Altı haneli oda kodu gerekli');
  const room=await store.transaction('rooms/'+action.code,current=>{
   if(!current||now>=current.createdAt+86400000)throw Error('Oda bulunamadı veya süresi doldu');
   return command(current,uid,action,now,data);
  });
  await recordChampion(room,now);
  return {...publicView(room,uid,now),uid,serverNow:now};
 }
 return {handle};
}
export function newSession(){return randomBytes(32).toString('base64url');}
