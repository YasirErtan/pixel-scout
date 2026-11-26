import {createSign} from 'node:crypto';
import {arenaError} from './errors.js';

// Keep this module outside dist: OAuth credentials must never reach a browser.
export function firebaseStore({databaseURL,serviceAccount,apiKey,fetcher=fetch,clock=Date.now}){
 const origin=new URL(databaseURL);
 if(origin.protocol!=='https:'||!/^[-a-z0-9]+\.(firebaseio\.com|[-a-z0-9]+\.firebasedatabase\.app)$/.test(origin.hostname))throw arenaError('Geçersiz veritabanı adresi');
 let cached;
 async function accessToken(){
  const now=Math.floor(clock()/1000);if(cached&&cached.until>now+60)return cached.token;
  const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
  const claims=apiKey?{iss:serviceAccount.client_email,sub:serviceAccount.client_email,aud:'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',iat:now,exp:now+3600,uid:'transfer-arena-server'}:{iss:serviceAccount.client_email,scope:'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600};
  const body=encode({alg:'RS256',typ:'JWT',...(serviceAccount.private_key_id?{kid:serviceAccount.private_key_id}:{})})+'.'+encode(claims);
  const signer=createSign('RSA-SHA256');signer.update(body);signer.end();
  const assertion=body+'.'+signer.sign(serviceAccount.private_key,'base64url');
  const res=await fetcher(apiKey?'https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key='+encodeURIComponent(apiKey):'https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':apiKey?'application/json':'application/x-www-form-urlencoded'},body:apiKey?JSON.stringify({token:assertion,returnSecureToken:true}):new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}),signal:AbortSignal.timeout(8000)});
  if(!res.ok)throw arenaError('Veritabanı kimlik doğrulaması başarısız');
  const value=await res.json();cached={token:apiKey?value.idToken:value.access_token,until:now+Number(apiKey?value.expiresIn:value.expires_in)};return cached.token;
 }
 function recordURL(key){
  if(!/^[a-zA-Z0-9_/-]+$/.test(key))throw arenaError('Geçersiz kayıt yolu');
  return new URL('/transfer_arena_v1/'+key+'.json',origin);
 }
 // Kimlik: custom token ile auth sorgu parametresi, yoksa OAuth Bearer başlığı.
 async function authorize(url){
  const token=await accessToken();
  if(apiKey){url.searchParams.set('auth',token);return {};}
  return {Authorization:'Bearer '+token};
 }
 async function transaction(key,update){
  const url=recordURL(key);
  for(let attempt=0;attempt<8;attempt++){
   const headers=await authorize(url);
   const read=await fetcher(url,{headers:{...headers,'X-Firebase-ETag':'true'},signal:AbortSignal.timeout(8000)});
   if(!read.ok)throw arenaError('Veritabanına erişilemiyor');
   const etag=read.headers.get('etag');if(!etag)throw arenaError('Atomik kayıt desteği gerekli');
   const record=await read.json(),current=record?JSON.parse(record.payload):null;
   const updated=update(current);
   // undefined: yalnız okuma; boş kayıt oluşturulmaz.
   if(updated===undefined)return current;
   if(record&&JSON.stringify(current)===JSON.stringify(updated))return updated;
   // Strings preserve empty arrays/objects and nulls across Firebase round trips.
   const write=await fetcher(url,{method:'PUT',headers:{...headers,'Content-Type':'application/json','if-match':etag},body:JSON.stringify({payload:JSON.stringify(updated)}),signal:AbortSignal.timeout(8000)});
   if(write.status===412)continue;
   if(!write.ok)throw arenaError('Kayıt tamamlanamadı');return updated;
  }
  throw arenaError('Oda meşgul; tekrar dene');
 }
 // Bir yolun alt anahtarları (shallow okuma; kayıt içerikleri indirilmez).
 async function keys(key){
  const url=recordURL(key);const headers=await authorize(url);url.searchParams.set('shallow','true');
  const res=await fetcher(url,{headers,signal:AbortSignal.timeout(8000)});
  if(!res.ok)throw arenaError('Veritabanına erişilemiyor');
  const value=await res.json();return value&&typeof value==='object'?Object.keys(value):[];
 }
 // Kayıt, okunduğu andaki ETag ile koşullu silinir: arada değiştiyse (ör. aynı kodla yeni oda) silinmez.
 async function remove(key,shouldRemove){
  const url=recordURL(key);const headers=await authorize(url);
  const read=await fetcher(url,{headers:{...headers,'X-Firebase-ETag':'true'},signal:AbortSignal.timeout(8000)});
  if(!read.ok)throw arenaError('Veritabanına erişilemiyor');
  const etag=read.headers.get('etag');if(!etag)throw arenaError('Atomik kayıt desteği gerekli');
  const record=await read.json();if(record===null)return false;
  let current=null;try{current=JSON.parse(record.payload);}catch{}
  if(!shouldRemove(current))return false;
  const res=await fetcher(url,{method:'DELETE',headers:{...headers,'if-match':etag},signal:AbortSignal.timeout(8000)});
  if(res.status===412)return false;
  if(!res.ok)throw arenaError('Kayıt silinemedi');
  return true;
 }
 return {transaction,keys,remove};
}
