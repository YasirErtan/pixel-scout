// Transfer Arenası: tek satırlık Türkçe maç anlatımı (Model 6).
// Seçim deterministiktir (olay dakikası, tipi, oyuncu kimliği ve takımdan); Math.random kullanılmaz.
import {escapeHTML} from './cards.js';

const VOWELS='aeıioöuü';
const FOLD={á:'a',à:'a',â:'a',ã:'a',ä:'a',å:'a',é:'e',è:'e',ê:'e',ë:'e',í:'i',ì:'i',î:'i',ï:'i',ó:'o',ò:'o',ô:'o',õ:'o',ú:'u',ù:'u',û:'u'};
const lower=s=>String(s).toLocaleLowerCase('tr').replace(/[áàâãäåéèêëíìîïóòôõúùû]/g,c=>FOLD[c]);

// Adın son sözcüğü; anlatıcılar soyadıyla seslenir ("Erling Haaland" → "Haaland").
export function shortName(name){
 const words=String(name??'').trim().split(/\s+/).filter(Boolean);
 return words.at(-1)||'';
}

// Kesme işaretinden sonra gelen ek için ünlü uyumu. kind: 'gen' (-ın), 'dat' (-a).
// Sessiz sondaki e (Kane, Rice) okunuşta ünsüzle bittiği için kaynaştırma almaz: Kane'in.
export function turkishSuffix(name,kind='gen'){
 const orig=shortName(name);
 const word=lower(orig).replace(/[^a-zçğıöşü]/g,'');
 let last='e';for(const c of word)if(VOWELS.includes(c))last=c;
 const endsVowel=VOWELS.includes(word.at(-1));
 // Sessiz e: ünlü + ünsüz + e ile biter (Kane, Rice); vurgulu é okunduğu için kaynaşır (Mbappé'nin).
 const silentE=/[aeıioöuü][^aeıioöuü]e$/.test(word)&&/e$/.test(orig);
 const joined=endsVowel&&!silentE;
 const back='aıou'.includes(last),round='ouöü'.includes(last);
 if(kind==='dat')return (joined?'y':'')+(back?'a':'e');
 return (joined?'n':'')+(back?(round?'u':'ı'):(round?'ü':'i'))+'n';
}

// HTML-güvenli "Haaland'ın" / "Kane'in" / "Mbappé'nin" / "Gvardiol'un".
export function genitive(name){
 const s=shortName(name);if(!s)return 'Oyuncunun';
 return escapeHTML(s)+"'"+turkishSuffix(name,'gen');
}
export function dative(name){
 const s=shortName(name);if(!s)return 'oyuncuya';
 return escapeHTML(s)+"'"+turkishSuffix(name,'dat');
}
const who=name=>shortName(name)?escapeHTML(shortName(name)):'Oyuncu';

function hash(text){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}
 h^=h>>>16;h=Math.imul(h,2246822507);h^=h>>>13;h=Math.imul(h,3266489909);h^=h>>>16; // alt bitleri de karıştır
 return h>>>0;}
const choose=(list,seed)=>list[seed%list.length];

const num=v=>Number.isFinite(v)?v:0;
export const isBigChance=e=>Boolean(e&&(e.big===true||num(e.xg)>=0.25));
// Şut büyük fırsattan ürettiyse ve isabetsizse kıl payı kaçan fırsattır.
export const isNearMiss=e=>Boolean(e&&e.type==='shot'&&isBigChance(e));
export function isKeyMoment(e){
 if(!e)return false;
 if(['goal','red','post','allIn'].includes(e.type))return true;
 if(e.type==='save'||e.type==='shot')return isBigChance(e);
 return false;
}

function sideOf(match,id){return (match?.teams||[]).findIndex(t=>t?.id===id);}
function keeperName(match,shooterTeam){
 const i=sideOf(match,shooterTeam);if(i<0)return 'Kaleci';
 const other=match.teams[1-i];
 const gk=(other?.players||[]).find(p=>p?.position==='GK'&&!p.red)||(other?.players||[]).find(p=>p?.position==='GK');
 return gk?.name?escapeHTML(shortName(gk.name)):'Kaleci';
}

// Gol sonrası skor bağlamı: event.score golden sonraki skordur.
function goalContext(e,match,names){
 const i=sideOf(match,e.team);
 if(i<0||!Array.isArray(e.score)||e.score.length<2)return '';
 const mine=num(e.score[i])-1,theirs=num(e.score[1-i]),total=mine+1+theirs;
 const t=names(e.team);
 if(total===1)return choose(['Skor tabelası açıldı.','Maçta ilk gol geldi.'],hash(e.team+e.minute));
 if(mine<theirs&&mine+1===theirs)return `${t} eşitliği yakaladı!`;
 if(mine===theirs)return `${t} öne geçti!`;
 if(mine<theirs)return `${t} farkı azaltıyor.`;
 if(mine>theirs&&mine-theirs>=2)return 'Fark iyice açıldı.';
 return `${t} farkı açıyor.`;
}

export function commentaryLine(event,match,names=id=>escapeHTML(id)){
 try{
  const e=event&&typeof event==='object'?event:{};
  const nm=typeof names==='function'?names:id=>escapeHTML(id);
  const minute=num(e.minute);
  const seed=hash(`${e.type}|${Math.round(minute*100)}|${e.playerId??e.playerName??''}|${e.team??''}|${e.setPiece??''}`);
  const p=who(e.playerName),pg=genitive(e.playerName);
  const team=()=>e.team!=null?nm(e.team):'Takım';
  switch(e.type){
   case 'goal':{
    const ctx=goalContext(e,match,nm);
    const a=e.assisterName?who(e.assisterName):null,ag=e.assisterName?genitive(e.assisterName):null;
    let line;
    if(e.setPiece==='penalty'||e.penalty===true)line=choose([`⚽ Penaltı golü! ${p} kaleciyi ters köşeye yatırdı.`,`⚽ ${p} beyaz noktada soğukkanlı kaldı: gol!`,`⚽ Penaltıyı ${p} ağlara gönderdi!`],seed);
    else if(e.setPiece==='freeKick')line=choose([`⚽ ${pg} serbest vuruşu ağlarda! Muhteşem bir gol.`,`⚽ Serbest vuruşta ${p} barajı aştı, top ağlarda!`,`⚽ ${p} duran topta şov yaptı: gol!`],seed);
    else if(e.setPiece==='corner')line=a?choose([`⚽ Kornerde ${ag} ortasında ${p} yükseldi, gol!`,`⚽ Korner sonrası ${p} ağları buldu, asist ${a}.`],seed):choose([`⚽ Korner sonrası karambolde ${p} topu ağlara yolladı!`,`⚽ Köşe vuruşunda ${p} gerekeni yaptı: gol!`],seed);
    else if(a)line=choose([`⚽ GOL! ${ag} pasında ${p} affetmedi.`,`⚽ ${p} ağları havalandırdı, asist ${a}!`,`⚽ ${a} hazırladı, ${p} tamamladı: gol!`,`⚽ ${ag} ortasını ${p} ağlara gönderdi!`],seed);
    else if(isBigChance(e))line=choose([`⚽ GOL! ${p} kaçmaz denilen pozisyonu kaçırmadı!`,`⚽ Net pozisyon, net gol! ${p} kaleciyi geçti.`],seed);
    else line=choose([`⚽ GOL! ${p} topu ağlara gönderdi!`,`⚽ ${p} affetmedi, top ağlarda!`,`⚽ Tribünler ayakta! ${pg} golü geldi.`,`⚽ ${p} sol köşeyi buldu, gol!`],seed);
    const late=minute>=85?' Son dakikalarda gelen gol!':'';
    return `${line}${ctx?' '+ctx:''}${late}`;
   }
   case 'post':
    return choose([`${pg} şutu direkten döndü!`,`Direk! ${p} bu kez şanssızdı.`,`Tahtalar titredi! ${pg} vuruşu direkten geri geldi.`,`${p} vurdu, top direğe çarpıp oyun alanına döndü!`],seed);
   case 'save':{
    const k=keeperName(match,e.team);
    if(isBigChance(e))return choose([`${k} son anda çeldi! ${pg} net pozisyonu gole dönüşmedi.`,`Kaleci son anda çeldi! ${pg} şutu ağlara gitmedi.`,`${k} devleşti! ${pg} kesin golü önledi.`,`İnanılmaz kurtarış! ${k} ${dative(e.playerName)} gol izni vermedi.`],seed);
    return choose([`${k} ${pg} şutunu çıkardı.`,`${p} şut çekti, ${k} sağlam yerleşti.`,`${k} ${pg} denemesinde yerini iyi aldı.`],seed);
   }
   case 'shot':
    if(isNearMiss(e))return choose([`${p} kıl payı dışarı attı!`,`Auta gitti, tribünler ellerini başına götürdü.`,`İnanılmaz kaçan fırsat! ${p} topu dışarı gönderdi.`,`${pg} şutu direğin yanından auta gitti, çok yakındı!`],seed);
    return choose([`${p} denedi ama top auta gitti.`,`${pg} vuruşu kaleyi bulmadı.`,`${p} uzaktan şansını denedi, top dışarıda.`,`${pg} şutu üstten auta çıktı.`],seed);
   case 'yellow':
    return choose([`🟨 Sarı kart! Hakem ${p} için kartı cebinden çıkardı.`,`🟨 ${p} sarı kart gördü, artık dikkatli olmalı.`,`🟨 ${pg} sert girişi sarıyla cezalandırıldı.`],seed);
   case 'red':
    return choose([`🟥 Kırmızı kart! ${p} oyundan atıldı.`,`🟥 ${p} için maç bitti, hakem kırmızı kartı gösterdi!`,`🟥 Hakem tereddüt etmedi: ${p} kırmızı kart gördü, ${team()} eksik kaldı.`],seed);
   case 'foul':
    return choose([`${p} faul yaptı, hakem düdüğü çaldı.`,`Hakem ${pg} müdahalesinde oyunu durdurdu.`,`${pg} girişi faul, oyun duruyor.`],seed);
   case 'allIn':
    return choose([`🔥 ${team()} tüm riskleri aldı!`,`🔥 ${team()} tüm riskleri aldı, defans hattı da hücuma çıktı!`,`🔥 Tüm riskleri aldı ${team()}: ya hep ya hiç!`],seed);
   case 'extraTime':
    return choose(['90 dakika sona erdi, skor eşit: maç uzatmalara gidiyor!','Normal süre bitti, kazanan çıkmadı; uzatmalar başlıyor!'],seed);
   case 'shootout':
    return e.scored?choose([`Penaltı: ${p} kaleciyi yendi!`,`${p} penaltıyı ağlara gönderdi, gol.`],seed):choose([`Penaltı kaçtı! ${p} beyaz noktada başarılı olamadı.`,`${p} kaçırdı, kaleci kazandı bu düelloyu!`],seed);
   case 'forfeit':
    return e.team!=null?`Hakem maçı hükmen sonuçlandırdı; ${team()} için maç bitti.`:'Hakem maçı hükmen sonuçlandırdı.';
   default:
    return 'Maçta yeni bir gelişme var.';
  }
 }catch{
  return 'Maçta yeni bir gelişme var.';
 }
}
