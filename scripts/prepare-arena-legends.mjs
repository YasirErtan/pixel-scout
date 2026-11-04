import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
// Overall/position selection: user-requested Red Bull FC 27 icon list.
const selection=[
 [237067,'Pelé',95,'Pelé'],[190042,'Diego Maradona',95,'Diego Maradona'],
 [37576,'Ronaldo',94,'Ronaldo (Brazilian footballer)'],[1397,'Zinedine Zidane',94,'Zinedine Zidane'],
 [190045,'Johan Cruyff',93,'Johan Cruyff'],[238439,'Paolo Maldini',93,'Paolo Maldini'],
 [247553,'Garrincha',93,'Garrincha'],[168473,'Franz Beckenbauer',93,'Franz Beckenbauer'],
 [254642,'Ferenc Puskás',92,'Ferenc Puskás'],[41,'Andrés Iniesta',92,'Andrés Iniesta'],
 [190048,'Gerd Müller',92,'Gerd Müller'],[1179,'Gianluigi Buffon',92,'Gianluigi Buffon'],
 [1625,'Thierry Henry',91,'Thierry Henry'],[10535,'Xavi',91,'Xavi'],[488,'Oliver Kahn',91,'Oliver Kahn']
];
const fields={finishing:'finishing',positioning:'positioning',composure:'composure',shotPower:'shotpower',vision:'vision',shortPassing:'shortpassing',ballControl:'ballcontrol',defensiveAwareness:'defawerness',interceptions:'interceptions',standingTackle:'standingtackle',stamina:'stamina',sprintSpeed:'sprintspeed',gkDiving:'gkdiving',gkHandling:'gkhandling',gkPositioning:'gkpositioning',gkReflexes:'gkreflexes',penalties:'penalties'};
const legends=[],sources=[];
for(const [id,name,overall,wikiTitle]of selection){
 const url=`https://futmind.com/players/${id}/player`,response=await fetch(url);
 if(!response.ok)throw Error(name+' HTTP '+response.status);
 const html=await response.text(),match=html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);
 const data=match&&JSON.parse(match[1]).props.pageProps.playerData;
 if(!data||data.rating!==overall||data.year!==2027||data.rareflag!==12)throw Error('Wrong FC27 base icon: '+name);
 const raw={...data.attributes,...data.attributesGk};
 const attributes=Object.fromEntries(Object.entries(fields).map(([key,field])=>{
  if(!Number.isInteger(raw[field])||raw[field]<0||raw[field]>99)throw Error(name+' missing '+field);
  return [key,raw[field]];
 }));
 const detailPosition=data.position,position=detailPosition==='GK'?'GK':['CB','LB','RB','LWB','RWB'].includes(detailPosition)?'DEF':['ST','CF','LW','RW','LM','RM'].includes(detailPosition)?'ATT':'MID';
 const locales=JSON.parse(match[1]).props.pageProps.locales;
 legends.push({id:'legend-'+id,name,overall,position,detailPosition,club:'Efsaneler',country:locales['search_nationName_nation'+data.nation]||null,legend:true,attributes});
 sources.push({id:'legend-'+id,name,wikiTitle,url:response.url,overall,position:detailPosition,assetId:data.assetId,sha256:createHash('sha256').update(html).digest('hex')});
 console.log(name,overall,position);
}
await fs.writeFile('server/transfer-arena/legends.js','// FC 27 base icon factual snapshot; provenance in research/transfer-arena-legends.json.\nexport const LEGENDS='+JSON.stringify(legends)+';\n');
await fs.writeFile('research/transfer-arena-legends.json',JSON.stringify({retrievedAt:new Date().toISOString(),selectionSource:'https://www.redbull.com/tr-tr/ea-fc-27-tum-efsane-ikonlar',scope:'15 selected familiar male base icons strictly above 90; overall and all 17 subattributes preserved, no campaign boosts.',players:sources},null,2)+'\n');
