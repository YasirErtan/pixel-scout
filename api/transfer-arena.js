import {firebaseStore} from '../server/transfer-arena/store.js';
import {arenaService,newSession} from '../server/transfer-arena/service.js';
import {arenaData} from '../server/transfer-arena/data.js';
let service;
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='POST'){res.status(405).json({error:'POST gerekli'});return;}
 const origin=req.headers.origin;
 if(!origin||origin!==`https://${req.headers.host}`){res.status(403).json({error:'İstek kaynağı doğrulanamadı'});return;}
 if(!String(req.headers['content-type']).startsWith('application/json')){res.status(415).json({error:'JSON gerekli'});return;}
 if(!process.env.ARENA_SERVICE_ACCOUNT||!process.env.ARENA_DATABASE_URL||!process.env.ARENA_FIREBASE_API_KEY){res.status(503).json({error:'Oda sunucusu henüz hazır değil'});return;}
 try{
  if(!service)service=arenaService({store:firebaseStore({databaseURL:process.env.ARENA_DATABASE_URL,serviceAccount:JSON.parse(process.env.ARENA_SERVICE_ACCOUNT),apiKey:process.env.ARENA_FIREBASE_API_KEY}),data:await arenaData()});
  const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
  if(JSON.stringify(body).length>4096){res.status(413).json({error:'İstek çok büyük'});return;}
  const cookies=String(req.headers.cookie||'').split(';').map(s=>s.trim());
  let token=cookies.find(s=>s.startsWith('__Host-arena='))?.slice(13);
  if(!token||!/^[a-zA-Z0-9_-]{43}$/.test(token)){
   token=newSession();res.setHeader('Set-Cookie',`__Host-arena=${token}; Path=/; Max-Age=2592000; Secure; HttpOnly; SameSite=Strict`);
  }
  const result=await service.handle({token,ip:req.headers['x-vercel-forwarded-for']||req.socket?.remoteAddress,action:body});res.status(200).json(result);
 }catch(e){
  // Never return upstream errors, credential-bearing URLs, or private room data.
  const safe=/^(Oturum gerekli|Çok sık|Geçersiz|Oda |Altı haneli|Takım adı|Lobi |En az üç|İhale |Bu |Bütçe |Taktik |Kayıt |Veritabanı|Atomik |Pazar |Mevki |Hoca |Eksik |Maç |Saha |Bilinmeyen)/.test(e.message);
  res.status(400).json({error:safe?e.message:'İstek tamamlanamadı; tekrar dene'});
 }
}
