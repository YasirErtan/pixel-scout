import fs from 'node:fs';
import {normalizeName,ageOn} from '../dist/engine.js';
const json=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const catalogue=json('research/catalogue.json');
const extraFiles=['research/portraits-pl-laliga.json','research/portraits-serie-ligue.json'];
const photos=[...json('research/portraits.json'),...extraFiles.flatMap(file=>fs.existsSync(file)?json(file):[])];
const fields=['id','name','aliases','nationality','nationalityCode','club','league','position','birthDate','shirtNumber','sourceUrls','verifiedAt','snapshotSeason'];
const searchPlayers=catalogue.searchPlayers.map(p=>Object.fromEntries(fields.map(key=>[key,p[key]??null])));
const byId=new Map(searchPlayers.map(p=>[p.id,p]));
const TARGET_COUNT=125;
const excludedNames=['Brian Madjo','Brayan Madjo','Malick Thiaw','Conor Bradley','Dan Burn','Ibrahim Mbaye','Gerónimo Rulli','Mile Svilar'];
const excludedForms=new Set(excludedNames.map(normalizeName));
const excludedIds=new Set(['espn-401451','espn-303444','espn-250183','espn-198138','espn-388522','espn-167192','espn-238798']);
const isExcluded=player=>excludedIds.has(player.id)||[player.name,...(player.aliases||[])].some(name=>excludedForms.has(normalizeName(name)));
const targets=[],skipped=[];
for(const photo of photos){
  if(!/^approved/i.test(photo.review||'')){skipped.push({name:photo.name,reason:'portrait not approved'});continue;}
  const matches=searchPlayers.filter(p=>[p.name,...(p.aliases||[])].some(name=>normalizeName(name)===normalizeName(photo.name)));
  const player=byId.get(photo.catalogueId||photo.id)||(matches.length===1?matches[0]:null);
  if(!player){skipped.push({name:photo.name,reason:'no unique current squad match'});continue;}
  if(isExcluded(player)){skipped.push({name:player.name,reason:'excluded from portrait targets by user request'});continue;}
  if(targets.some(p=>p.id===player.id))continue;
  if(!player.nationalityCode||!player.nationality||!player.position||!ageOn(player.birthDate,catalogue.snapshotDate)||!Number.isInteger(player.shirtNumber)){skipped.push({name:photo.name,reason:'incomplete target facts'});continue;}
  targets.push({...player,photo:{path:photo.image,author:photo.author,sourcePage:photo.sourcePage,license:photo.license,licenseUrl:photo.licenseUrl,date:photo.date,objectPosition:photo.objectPosition,scale:photo.suggestedScale,transformOrigin:photo.suggestedTransformOrigin}});
}
const preview=process.argv.includes('--preview');
if(targets.length<TARGET_COUNT&&!preview)throw Error(`Need ${TARGET_COUNT} approved portrait targets; have ${targets.length}. No production data written.`);
const fame=fs.existsSync('research/fame-ranking.json')?json('research/fame-ranking.json').records:{};
const starters=new Set(json('research/portraits.json').map(p=>p.id));
targets.sort((a,b)=>Number(starters.has(b.id))-Number(starters.has(a.id))||(fame[b.id]?.views||0)-(fame[a.id]?.views||0)||a.name.localeCompare(b.name));
const players=targets.slice(0,TARGET_COUNT);
for(const player of players){const destination='dist/'+player.photo.path;if(!fs.existsSync(destination)){const retained='research/unused-portraits/'+player.photo.path.split('/').at(-1);if(fs.existsSync(retained))fs.copyFileSync(retained,destination);else throw Error('Missing selected photo '+player.photo.path);}}
if(new Set(searchPlayers.map(p=>p.id)).size!==searchPlayers.length)throw Error('Duplicate catalogue IDs');
const coverage={provider:catalogue.provider,scope:catalogue.scope,teamCount:catalogue.teamCount,completedTeamCount:catalogue.completedTeamCount,playerCount:searchPlayers.length,teams:catalogue.coverage.map(t=>({id:t.id,club:t.club,league:t.league,playerCount:t.playerCount,source:t.rosterSource})),failures:catalogue.failures};
fs.writeFileSync('dist/players.json',JSON.stringify({version:2,snapshotDate:catalogue.snapshotDate,snapshotSeason:catalogue.snapshotSeason,players,searchPlayers,coverage}));
fs.writeFileSync('research/target-selection.json',JSON.stringify({approvedAvailable:targets.length,selected:players.length,excludedNames,selectionMethod:'Select125 normal targets: preserve approved starter20 unless excluded by user; rank remaining complete, portrait-approved current squad candidates by EnglishWikipedia30-day pageviews.',selectedPlayers:players.map(p=>({id:p.id,name:p.name,league:p.league,pageviews:fame[p.id]?.views||0})),skipped},null,2));
console.log(`${preview?'PREVIEW: ':''}${players.length} portrait targets; ${searchPlayers.length} searchable squad players; ${coverage.completedTeamCount}/${coverage.teamCount} clubs.`);
