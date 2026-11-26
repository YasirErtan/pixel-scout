// Süresi dolmuş kayıtların fiziksel temizliği (günlük cron görevi). Odalar 24 saat sonra kullanıma kapanır;
// bir saat pay bırakılarak silinir. Oda oluşturma sınırı kayıtları süreleri bitince silinir.
// Şampiyon listesi silinmez.
export const ROOM_TTL=86400000,ROOM_GRACE=3600000;

export const roomExpired=(room,now)=>!room||typeof room.createdAt!=='number'||now>=room.createdAt+ROOM_TTL+ROOM_GRACE;
export const limitExpired=(bucket,now)=>!bucket||typeof bucket.until!=='number'||now>=bucket.until;

export async function cleanupExpired(store,{now,clock=Date.now,budgetMs=45000,maxRecords=600,concurrency=6}={}){
 const started=clock(),result={rooms:0,limits:0,checked:0,failed:0,complete:true};
 const jobs=[];
 for(const [prefix,expired,field] of [['rooms',roomExpired,'rooms'],['limits',limitExpired,'limits']]){
  for(const key of await store.keys(prefix))jobs.push({key:prefix+'/'+key,expired,field});
 }
 if(jobs.length>maxRecords){result.complete=false;jobs.length=maxRecords;}
 let next=0;
 async function worker(){
  while(next<jobs.length){
   // Süre bütçesi aşılırsa kalanlar bir sonraki çalıştırmaya bırakılır.
   if(clock()-started>budgetMs){result.complete=false;return;}
   const job=jobs[next++];result.checked++;
   try{if(await store.remove(job.key,record=>job.expired(record,now)))result[job.field]++;}
   catch{result.failed++;}
  }
 }
 await Promise.all(Array.from({length:Math.min(concurrency,jobs.length)},worker));
 return result;
}
