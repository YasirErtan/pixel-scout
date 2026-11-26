// Sunucu örneği içinde tutulan sabit pencereli istek sınırlayıcı.
// Aynı Wi-Fi'daki oyuncular tek IP paylaşır; önceki tasarımda hepsi veritabanında tek bir sayaç kaydına
// yazdığı için ETag çakışması ve "Oda meşgul" hatası doğabiliyordu. Bellek içi sayaç çakışmaz ve
// her isteğe fazladan bir veritabanı okuma/yazma eklemez. Örnekler arasında paylaşılmaz; bu yüzden
// kötüye kullanıma karşı en iyi çaba koruması sağlar. Oda oluşturma sınırı veritabanında kalır.
export function memoryLimiter({maxKeys=10000}={}){
 const buckets=new Map();
 function sweep(now){for(const [key,bucket] of buckets)if(now>=bucket.until)buckets.delete(key);}
 return function hit(key,limit,windowMs,now){
  let bucket=buckets.get(key);
  if(!bucket||now>=bucket.until){
   if(buckets.size>=maxKeys)sweep(now);
   // Süpürmeden sonra hâlâ doluysa en eski kayıt atılır; bellek sınırsız büyümez.
   if(buckets.size>=maxKeys)buckets.delete(buckets.keys().next().value);
   bucket={count:0,until:now+windowMs};buckets.set(key,bucket);
  }
  if(bucket.count>=limit)throw Error('Çok sık istek gönderildi; biraz bekle');
  bucket.count++;
 };
}
