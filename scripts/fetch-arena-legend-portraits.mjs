import fs from 'node:fs/promises';
import {cleanPortraitMetadata} from './clean-portrait-metadata.mjs';
import {createHash} from 'node:crypto';
const selection=JSON.parse(await fs.readFile('research/transfer-arena-legends.json','utf8'));
const LEGENDS=selection.players.map(p=>({id:p.id,name:p.wikiTitle}));
// Elle seçilmiş Commons dosyaları: mümkün olduğunca oyunculuk döneminden, yüzü net görünen kareler.
// Listede olmayan efsane için Wikipedia sayfa görseli kullanılır.
const PHOTO_FILES={
 'legend-237067':'File:Pele con brasil (cropped).jpg',
 'legend-190042':'File:Argentina celebrando copa (cropped).jpg',
 'legend-37576':'File:Ronaldo 2002 cropped.jpg',
 'legend-1397':'File:Zidane Zizu.jpg',
 'legend-190045':'File:Johan Cruijff (1974).jpg',
 'legend-238439':'File:Maldini2008.JPG',
 'legend-247553':'File:Manoel Francisco dos Santos-Garrincha.jpg',
 'legend-168473':'File:Franz Beckenbauer (1975).jpg',
 'legend-254642':'File:Ferenc Puskas en 1965.jpg',
 'legend-190048':'File:Gerd Müller c1973 (cropped).jpg',
 'legend-41':'File:Andrés Iniesta Euro 2012 vs France 01.jpg',
 'legend-1179':'File:Gianluigi Buffon (31784615942) (cropped).jpg',
 'legend-1625':'File:Thierry Henry 2008.jpg',
 'legend-10535':'File:2012 2013 - 06 Xavi Hernández.jpg',
 'legend-488':'File:Persepolis VS Bayern Munich in 13 January 2006 3 (cropped).jpg'
};
// Kart çerçevesinde yüz odağı: [x%, y%, yakınlaştırma].
const FOCUS={
 'legend-237067':[50,22,1.15],'legend-190042':[42,20,1.7],'legend-37576':[50,24,1.2],'legend-1397':[50,20,1.2],
 'legend-190045':[45,25,1.1],'legend-238439':[50,30,1.15],'legend-247553':[50,10,2.4],'legend-168473':[50,22,1.15],
 'legend-254642':[48,24,1.2],'legend-190048':[50,24,1.15],'legend-41':[50,20,1.15],'legend-1179':[50,22,1.2],
 'legend-1625':[50,4,1.1],'legend-10535':[45,9,2.8],'legend-488':[50,35,1.2]
};
const headers={'User-Agent':'PixelScout/1.0 (free legend portraits, attribution retained)'};
async function api(host,params,attempt=0){const url=new URL('/w/api.php',host);url.search=new URLSearchParams({action:'query',format:'json',...params});const res=await fetch(url,{headers});if(res.status===429){if(attempt>=4)throw Error('Wikimedia rate limit; try later');const seconds=Number(res.headers.get('retry-after'))||30;console.log('Wikimedia rate limit; waiting',seconds,'seconds');await new Promise(resolve=>setTimeout(resolve,seconds*1000));return api(host,params,attempt+1);}if(!res.ok)throw Error('Wikimedia '+res.status);return res.json();}
const fallback=LEGENDS.filter(l=>!PHOTO_FILES[l.id]);
if(fallback.length){
 const wiki=await api('https://en.wikipedia.org',{titles:fallback.map(c=>c.name).join('|'),redirects:'1',prop:'pageimages',piprop:'name'});
 const redirects=new Map([...(wiki.query.normalized||[]),...(wiki.query.redirects||[])].map(x=>[x.from,x.to]));
 const title=name=>{let t=name;for(let i=0;i<4&&redirects.has(t);i++)t=redirects.get(t);return t;};
 for(const legend of fallback){const page=Object.values(wiki.query.pages).find(p=>p.title===title(legend.name));if(page?.pageimage)PHOTO_FILES[legend.id]='File:'+page.pageimage.replaceAll('_',' ');else console.log('MISSING',legend.name);}
}
const titles=Object.values(PHOTO_FILES);const images=[];
for(let i=0;i<titles.length;i+=40){const commons=await api('https://commons.wikimedia.org',{titles:titles.slice(i,i+40).join('|'),prop:'imageinfo',iiprop:'url|extmetadata|mime',iiurlwidth:'500'});images.push(...Object.values(commons.query.pages));}
// Görsel sunucusu da hız sınırı uygular: kısa aralıklarla ve 429'da bekleyerek indir.
async function download(url,attempt=0){await new Promise(r=>setTimeout(r,1500));const res=await fetch(url,{headers});if(res.status===429&&attempt<2){const seconds=Number(res.headers.get('retry-after'))||20;console.log('Görsel hız sınırı; bekleniyor',seconds,'sn');await new Promise(r=>setTimeout(r,seconds*1000));return download(url,attempt+1);}return res;}
// İndirilen ham görseller research/legend-portraits-cache/ altında saklanır (Git dışı); yeniden çalıştırmada tekrar indirilmez.
const CACHE='research/legend-portraits-cache/';await fs.mkdir(CACHE,{recursive:true});
async function image(info,name){
 const key=CACHE+createHash('sha256').update(info.descriptionurl+'|500').digest('hex').slice(0,24);
 const cached=await fs.readFile(key).catch(()=>null);if(cached)return {bytes:cached,png:cached[0]===0x89};
 // Küçük resim sunucusu hız sınırına takılırsa orijinal dosya denenir.
 for(const url of [info.thumburl,info.url].filter(Boolean)){const res=await download(url);if(res.ok){const bytes=Buffer.from(await res.arrayBuffer());await fs.writeFile(key,bytes);return {bytes,png:bytes[0]===0x89};}console.log('İndirilemedi',name,res.status,url===info.url?'(orijinal)':'(küçük resim)');}
 throw Error('Image download '+name);
}
const plain=value=>String(value||'').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(+n)).replace(/\s+/g,' ').trim();
await fs.mkdir('dist/games/transfer-arenasi/assets/legends',{recursive:true});
const records=[];
for(const legend of LEGENDS){
 const file=PHOTO_FILES[legend.id];if(!file)continue;
 const info=images.find(p=>p.title===file.replaceAll('_',' '))?.imageinfo?.[0],meta=info?.extmetadata;
 const license=plain(meta?.LicenseShortName?.value);
 if(!info||!(/CC BY|CC0|Public domain/i.test(license))||/NC|ND/.test(license)){console.log('LICENSE CHECK',legend.name,file,license);continue;}
 const raw=await image(info,legend.name);
 const bytes=cleanPortraitMetadata(raw.bytes),ext=raw.png?'png':'jpg';
 const filename=legend.id.replace('legend-','')+'.'+ext;
 await fs.writeFile('dist/games/transfer-arenasi/assets/legends/'+filename,bytes);
 records.push({id:legend.id,name:legend.name,path:'./assets/legends/'+filename,source:info.descriptionurl,author:plain(meta.Artist?.value)||'Bilinmiyor',license,licenseURL:meta.LicenseUrl?.value||'',changes:'Wikimedia thumbnail; contact-bearing metadata removed if present; CSS object-fit crop and zoom',focus:FOCUS[legend.id]||[50,20,1],sha256:createHash('sha256').update(bytes).digest('hex'),width:info.thumbwidth,height:info.thumbheight});
 console.log('OK',legend.name,license);
}
await fs.writeFile('research/transfer-arena-legend-portraits.json',JSON.stringify({retrievedAt:new Date().toISOString(),portraits:records},null,2)+'\n');
await fs.writeFile('dist/games/transfer-arenasi/legend-portraits.js','// Photo attribution must accompany redistributed images.\nexport const LEGEND_PORTRAITS='+JSON.stringify(Object.fromEntries(records.map(r=>[r.id,r])))+';\n');
console.log('TOTAL',records.length,'of',LEGENDS.length);
