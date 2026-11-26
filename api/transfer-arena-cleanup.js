import {timingSafeEqual} from 'node:crypto';
import {firebaseStore} from '../server/transfer-arena/store.js';
import {cleanupExpired} from '../server/transfer-arena/cleanup.js';

// Vercel Cron günde bir kez çağırır ve CRON_SECRET'i Authorization başlığında gönderir.
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET'){res.status(405).json({error:'GET gerekli'});return;}
 const secret=process.env.CRON_SECRET;
 if(!secret||secret.length<16||!process.env.ARENA_SERVICE_ACCOUNT||!process.env.ARENA_DATABASE_URL||!process.env.ARENA_FIREBASE_API_KEY){res.status(503).json({error:'Temizlik görevi yapılandırılmadı'});return;}
 const given=Buffer.from(String(req.headers.authorization||'')),expected=Buffer.from('Bearer '+secret);
 if(given.length!==expected.length||!timingSafeEqual(given,expected)){res.status(401).json({error:'Yetkisiz'});return;}
 try{
  const store=firebaseStore({databaseURL:process.env.ARENA_DATABASE_URL,serviceAccount:JSON.parse(process.env.ARENA_SERVICE_ACCOUNT),apiKey:process.env.ARENA_FIREBASE_API_KEY});
  res.status(200).json(await cleanupExpired(store,{now:Date.now()}));
 }catch{
  // Yukarıdan gelen hata ayrıntıları (adresler, kimlik bilgisi) dışarı verilmez.
  res.status(500).json({error:'Temizlik tamamlanamadı'});
 }
}
