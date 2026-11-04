import fs from 'node:fs/promises';
import {cleanPortraitMetadata} from './clean-portrait-metadata.mjs';
import {createHash} from 'node:crypto';
const selection=JSON.parse(await fs.readFile('research/transfer-arena-legends.json','utf8'));
const COACHES=selection.players.map(p=>({id:p.id,name:p.wikiTitle}));
const headers={'User-Agent':'PixelScout/1.0 (free legend portraits, attribution retained)'};
async function api(host,params,attempt=0){const url=new URL('/w/api.php',host);url.search=new URLSearchParams({action:'query',format:'json',...params});const res=await fetch(url,{headers});if(res.status===429){if(attempt>=4)throw Error('Wikimedia rate limit; try later');const seconds=Number(res.headers.get('retry-after'))||30;console.log('Wikimedia rate limit; waiting',seconds,'seconds');await new Promise(resolve=>setTimeout(resolve,seconds*1000));return api(host,params,attempt+1);}if(!res.ok)throw Error('Wikimedia '+res.status);return res.json();}
const wiki=await api('https://en.wikipedia.org',{titles:COACHES.map(c=>c.name).join('|'),redirects:'1',prop:'pageimages',piprop:'name|thumbnail',pithumbsize:'320'});
const redirects=new Map([...(wiki.query.normalized||[]),...(wiki.query.redirects||[])].map(x=>[x.from,x.to]));
function title(name){let t=name;for(let i=0;i<4&&redirects.has(t);i++)t=redirects.get(t);return t;}
const pages=Object.values(wiki.query.pages),records=[];
if(!pages.find(p=>p.title==='Xavi')?.pageimage){const fallback=await api('https://es.wikipedia.org',{titles:'Xavi Hernández',prop:'pageimages',piprop:'name'});const page=pages.find(p=>p.title==='Xavi');if(page)page.pageimage=Object.values(fallback.query.pages)[0]?.pageimage;}
const commons=await api('https://commons.wikimedia.org',{titles:pages.filter(p=>p.pageimage).map(p=>'File:'+p.pageimage).join('|'),prop:'imageinfo',iiprop:'url|extmetadata|mime',iiurlwidth:'320'});const images=Object.values(commons.query.pages);
const plain=value=>String(value||'').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(+n)).trim();
await fs.mkdir('dist/games/transfer-arenasi/assets/legends',{recursive:true});
for(const coach of COACHES){
 const page=pages.find(p=>p.title===title(coach.name));
 if(!page?.pageimage){console.log('MISSING',coach.name);continue;}
 const data={query:{pages:images.filter(p=>p.title===('File:'+page.pageimage).replaceAll('_',' '))}};
 const info=Object.values(data.query.pages)[0]?.imageinfo?.[0],meta=info?.extmetadata;
 const license=plain(meta?.LicenseShortName?.value);
 if(!info||!(/CC BY|CC0|Public domain/i.test(license))){console.log('LICENSE CHECK',coach.name,license);continue;}
 const url=info.thumburl||info.url,res=await fetch(url,{headers});if(!res.ok)throw Error('Image download '+coach.name+' '+res.status);
 const bytes=cleanPortraitMetadata(Buffer.from(await res.arrayBuffer())),ext=(res.headers.get('content-type')||'').includes('png')?'png':'jpg';
 const filename=coach.id.replace('legend-','')+'.'+ext;
 await fs.writeFile('dist/games/transfer-arenasi/assets/legends/'+filename,bytes);
 records.push({id:coach.id,name:coach.name,path:'./assets/legends/'+filename,source:info.descriptionurl,author:plain(meta.Artist?.value),license,licenseURL:meta.LicenseUrl?.value||'',changes:'Wikimedia thumbnail; contact-bearing metadata removed if present; CSS object-fit crop',sha256:createHash('sha256').update(bytes).digest('hex'),width:info.thumbwidth,height:info.thumbheight});
 console.log('OK',coach.name,license);
}
await fs.writeFile('research/transfer-arena-legend-portraits.json',JSON.stringify({retrievedAt:new Date().toISOString(),portraits:records},null,2)+'\n');
await fs.writeFile('dist/games/transfer-arenasi/legend-portraits.js','// Photo attribution must accompany redistributed images.\nexport const LEGEND_PORTRAITS='+JSON.stringify(Object.fromEntries(records.map(r=>[r.id,r])))+';\n');
console.log('TOTAL',records.length,'of',COACHES.length);
