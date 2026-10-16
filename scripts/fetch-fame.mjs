import fs from 'node:fs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const paths=['research/portraits.json','research/portraits-pl-laliga.json','research/portraits-serie-ligue.json'];
const photos=paths.flatMap(p=>fs.existsSync(p)?read(p):[]);
const records=fs.existsSync('research/fame-ranking.json')?read('research/fame-ranking.json').records:{};
const candidates=[...new Map(photos.map(p=>[p.catalogueId||p.id,p])).entries()].filter(([id])=>!records[id]);
for(let offset=0;offset<candidates.length;offset+=40){
  const batch=candidates.slice(offset,offset+40);
  const titles=batch.map(([,p])=>p.wikiTitle||p.name);
  const url=new URL('https://en.wikipedia.org/w/api.php');
  for(const [key,value]of Object.entries({action:'query',format:'json',redirects:'1',prop:'pageviews|pageprops',ppprop:'disambiguation',pvipdays:'30',titles:titles.join('|')}))url.searchParams.set(key,value);
  const response=await fetch(url,{headers:{'User-Agent':'PixelScout/2.0 (educational football quiz; public pageview research)'},signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error(`Pageview source ${response.status}; cached completed batches retained.`);
  const data=await response.json();
  const redirects=new Map([...(data.query?.normalized||[]),...(data.query?.redirects||[])].map(r=>[r.from,r.to]));
  const pages=Object.values(data.query?.pages||{});
  batch.forEach(([id,p],i)=>{let title=titles[i];for(let hop=0;hop<5&&redirects.has(title);hop++)title=redirects.get(title);const page=pages.find(p=>p.title===title);const ambiguous=page?.pageprops?.disambiguation!==undefined;const values=Object.values(page?.pageviews||{}).filter(Number.isFinite);records[id]={name:p.name,article:page?.title||title,views:ambiguous?0:values.reduce((a,b)=>a+b,0),days:values.length,ambiguous,missing:page?.missing!==undefined||!page,source:url.href,retrievedAt:new Date().toISOString()};});
  fs.writeFileSync('research/fame-ranking.json',JSON.stringify({method:'English Wikipedia last30days pageviews; attention proxy used to rank already curated real footballer candidates, not a global fame claim.',records},null,2));
  console.log(`Ranked ${Object.keys(records).length} candidate portraits.`);
  if(offset+40<candidates.length)await new Promise(resolve=>setTimeout(resolve,2200));
}
