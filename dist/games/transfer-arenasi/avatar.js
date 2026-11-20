import {SKIN_PALETTE,HAIR_PALETTE,EYE_PALETTE,CLUB_KITS,AVATAR_PROFILES} from './avatar-data.js';
import {STAR_AVATARS} from './avatar-stars.js';

const GK_KITS = [
  ['#22a853','#136b32','#d8ff8a','solid'],
  ['#e36414','#9a3412','#fff2d6','solid'],
  ['#5b3296','#331a5e','#e3d1ff','solid'],
  ['#e0b422','#9e7808','#1a1a1a','solid'],
  ['#1f2429','#0f1215','#d4af37','solid'],
  ['#0d8a9c','#075663','#dffcff','solid']
];

const BASE36 = '0123456789abcdefghijklmnopqrstuvwxyz';
let uidSeq = 0;

function hashInt(input) {
  const s = String(input ?? '0');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function b36Index(ch, max) {
  const idx = BASE36.indexOf(ch);
  if (idx < 0) return 0;
  return Math.min(max, idx);
}

function decodeProfile(code, seed) {
  if (typeof code === 'string' && code.length >= 10) {
    return {
      skin: b36Index(code[0], SKIN_PALETTE.length - 1),
      hairStyle: b36Index(code[1], 18),
      hairColor: b36Index(code[2], HAIR_PALETTE.length - 1),
      beard: b36Index(code[3], 6),
      faceShape: b36Index(code[4], 4),
      faceWidth: b36Index(code[5], 4),
      brows: b36Index(code[6], 3),
      eyes: b36Index(code[7], EYE_PALETTE.length - 1),
      hairVol: b36Index(code[8], 3),
      expr: b36Index(code[9], 2)
    };
  }
  return {
    skin: seed % SKIN_PALETTE.length,
    hairStyle: 1 + ((seed >>> 4) % 9),
    hairColor: (seed >>> 8) % 6,
    beard: (seed >>> 12) % 3,
    faceShape: (seed >>> 15) % 5,
    faceWidth: 1 + ((seed >>> 18) % 3),
    brows: (seed >>> 21) % 4,
    eyes: (seed >>> 23) % 2,
    hairVol: 1 + ((seed >>> 25) % 2),
    expr: (seed >>> 27) % 3
  };
}

function resolveKit(player, seed) {
  if (player?.position === 'GK') {
    return GK_KITS[(player.id ? Number(player.id) || seed : seed) % GK_KITS.length];
  }
  const club = player?.club;
  if (club && CLUB_KITS[club]) return CLUB_KITS[club];
  const h = hashInt(player?.clubId || club || seed);
  const primaries = ['#1b4f9c','#b81d24','#1d7a46','#d97706','#5b21b6','#0f766e','#1e293b','#be185d'];
  const secondaries = ['#f4f5f7','#fde047','#18181b','#93c5fd'];
  const patterns = ['solid','stripes','sleeves','centerStripe','hoops'];
  return [
    primaries[h % primaries.length],
    secondaries[(h >>> 3) % secondaries.length],
    '#ffffff',
    patterns[(h >>> 6) % patterns.length]
  ];
}

function kitPatternSVG(kit, clipId) {
  const [p, s, , pattern] = kit;
  let deco = '';
  if (pattern === 'stripes') {
    deco = `<g fill="${s}"><rect x="26" y="106" width="14" height="58"/><rect x="54" y="106" width="14" height="58"/><rect x="92" y="106" width="14" height="58"/><rect x="120" y="106" width="14" height="58"/></g>`;
  } else if (pattern === 'hoops') {
    deco = `<g fill="${s}"><rect x="6" y="118" width="148" height="9"/><rect x="6" y="136" width="148" height="9"/><rect x="6" y="152" width="148" height="9"/></g>`;
  } else if (pattern === 'halves') {
    deco = `<rect x="80" y="106" width="76" height="58" fill="${s}"/>`;
  } else if (pattern === 'centerStripe') {
    deco = `<rect x="67" y="106" width="26" height="58" fill="${s}"/>`;
  } else if (pattern === 'sleeves') {
    deco = `<path d="M8 162 L44 116 L46 162 Z M152 162 L116 116 L114 162 Z" fill="${s}"/>`;
  } else if (pattern === 'sash') {
    deco = `<polygon points="104,108 130,108 42,164 16,164" fill="${s}"/>`;
  }
  return `<g clip-path="url(#${clipId})"><rect x="6" y="106" width="148" height="58" fill="${p}"/>${deco}<path d="M8 162 C14 128 36 116 62 113 L98 113 C124 116 146 128 152 162 Z" fill="url(#${clipId}_sh)"/></g>`;
}

function faceGeometry(shape, widthIdx) {
  const dw = (widthIdx - 2) * 2.6;
  const rx = 31 + dw;
  const cheekX = 80 + rx;
  const cheekL = 80 - rx;
  switch (shape) {
    case 1: // square
      return {
        d: `M ${80 - rx + 2} 66 C ${80 - rx} 40 ${80 + rx} 40 ${80 + rx - 2} 66 L ${cheekX - 2} 86 C ${cheekX - 4} 102 ${104 + dw * 0.5} 112 80 113 C ${56 - dw * 0.5} 112 ${cheekL + 4} 102 ${cheekL + 2} 86 Z`,
        jawY: 112,
        earX: rx - 1
      };
    case 2: // long
      return {
        d: `M ${80 - rx + 3} 66 C ${80 - rx + 1} 37 ${80 + rx - 1} 37 ${80 + rx - 3} 66 C ${cheekX - 1} 84 ${101 + dw * 0.4} 111 80 117 C ${59 - dw * 0.4} 111 ${cheekL + 1} 84 ${80 - rx + 3} 66 Z`,
        jawY: 116,
        earX: rx - 2
      };
    case 3: // round
      return {
        d: `M ${80 - rx - 1} 68 C ${80 - rx} 39 ${80 + rx} 39 ${80 + rx + 1} 68 C ${cheekX + 3} 90 ${105 + dw * 0.6} 111 80 112 C ${55 - dw * 0.6} 111 ${cheekL - 3} 90 ${80 - rx - 1} 68 Z`,
        jawY: 111,
        earX: rx
      };
    case 4: // sharp / diamond
      return {
        d: `M ${80 - rx + 2} 66 C ${80 - rx} 39 ${80 + rx} 39 ${80 + rx - 2} 66 C ${cheekX + 1} 82 ${95 + dw * 0.3} 107 80 115 C ${65 - dw * 0.3} 107 ${cheekL - 1} 82 ${80 - rx + 2} 66 Z`,
        jawY: 114,
        earX: rx - 1
      };
    default: // 0: oval
      return {
        d: `M ${80 - rx + 1} 67 C ${80 - rx} 38 ${80 + rx} 38 ${80 + rx - 1} 67 C ${cheekX} 86 ${101 + dw * 0.4} 109 80 114 C ${59 - dw * 0.4} 109 ${cheekL} 86 ${80 - rx + 1} 67 Z`,
        jawY: 113,
        earX: rx - 1
      };
  }
}

function hairLayers(style, hairPal, tipPal, vol, earX) {
  const [base, hi, sh] = hairPal;
  const [tBase, tHi] = tipPal || hairPal;
  const v = (vol - 1) * 2.2;
  const wL = 80 - earX - 1;
  const wR = 80 + earX + 1;
  let back = '';
  let front = '';

  switch (style) {
    case 0: // bald
      front = `<ellipse cx="73" cy="52" rx="10" ry="3.8" fill="#ffffff1f"/>`;
      break;
    case 1: // buzz cut (tight to skull dome y=45)
      front = `<path d="M ${wL + 1} 68 C ${wL - 1} 40 ${wR + 1} 40 ${wR - 1} 68 C ${wR - 3} 58 ${wR - 10} 54 80 54 C ${wL + 10} 54 ${wL + 3} 58 ${wL + 1} 68 Z" fill="${base}" opacity=".85"/>`;
      break;
    case 2: // shortFade
      front = `<path d="M ${wL + 1} 68 C ${wL - 1} 40 ${wR + 1} 40 ${wR - 1} 68 C ${wR - 4} 58 ${wR - 12} 54 80 54 C ${wL + 12} 54 ${wL + 4} 58 ${wL + 1} 68 Z" fill="${sh}" opacity=".62"/>
        <path d="M ${wL + 4} 60 C ${wL + 5} 40 ${wR - 5} 40 ${wR - 4} 60 C ${wR - 10} 54 96 52 80 53 C 64 52 ${wL + 10} 54 ${wL + 4} 60 Z" fill="${base}"/>
        <path d="M 60 47 Q 80 43 100 47" stroke="${hi}" stroke-width="2.2" stroke-linecap="round" fill="none" opacity=".55"/>`;
      break;
    case 3: // shortPartLeft
      front = `<path d="M ${wL} 68 C ${wL - 2} 38 ${wR + 2} 38 ${wR} 66 C ${wR - 4} 56 96 54 86 55 C 72 57 58 53 ${wL + 4} 62 Z" fill="${base}"/>
        <path d="M 56 49 Q 79 42 103 49" stroke="${hi}" stroke-width="2.4" stroke-linecap="round" fill="none" opacity=".6"/>
        <path d="M 63 53 L 57 46" stroke="${sh}" stroke-width="1.5" opacity=".55"/>`;
      break;
    case 4: // shortPartRight
      front = `<path d="M ${wL} 66 C ${wL - 2} 38 ${wR + 2} 38 ${wR} 68 C ${wR - 4} 53 88 57 74 55 C 64 54 ${wL + 4} 56 ${wL} 66 Z" fill="${base}"/>
        <path d="M 57 49 Q 81 42 104 49" stroke="${hi}" stroke-width="2.4" stroke-linecap="round" fill="none" opacity=".6"/>
        <path d="M 97 53 L 103 46" stroke="${sh}" stroke-width="1.5" opacity=".55"/>`;
      break;
    case 5: // quiff
      front = `<path d="M ${wL + 1} 68 C ${wL - 1} 45 ${wL + 7} 36 80 ${35 - v} C ${wR - 7} 36 ${wR + 1} 45 ${wR - 1} 68 C ${wR - 5} 57 ${wR - 14} 53 80 53 C ${wL + 14} 53 ${wL + 5} 57 ${wL + 1} 68 Z" fill="${base}"/>
        <path d="M 59 ${48 - v * 0.3} Q 80 ${37 - v * 0.7} 101 ${48 - v * 0.3} Q 82 46 59 ${48 - v * 0.3} Z" fill="${hi}" opacity=".58"/>`;
      break;
    case 6: // fringeCrop
      front = `<path d="M ${wL} 67 C ${wL - 2} 39 ${wR + 2} 39 ${wR} 67 L ${wR - 5} 57 L 101 60 L 92 56 L 81 61 L 70 56 L 60 60 L ${wL + 5} 57 Z" fill="${base}"/>
        <path d="M 58 49 Q 80 43 102 49" stroke="${hi}" stroke-width="2.2" stroke-linecap="round" fill="none" opacity=".55"/>`;
      break;
    case 7: // wavyMedium
      back = `<path d="M ${wL - 3} 78 C ${wL - 5} 42 ${wR + 5} 42 ${wR + 3} 78 Z" fill="${sh}"/>`;
      front = `<path d="M ${wL - 1} 69 C ${wL - 3} 37 ${wR + 3} 37 ${wR + 1} 69 C ${wR - 4} 56 96 52 82 57 C 68 51 ${wL + 8} 55 ${wL - 1} 69 Z" fill="${base}"/>
        <path d="M 55 49 Q 68 42 82 46 Q 95 42 105 49" stroke="${hi}" stroke-width="2.2" stroke-linecap="round" fill="none" opacity=".58"/>`;
      break;
    case 8: // curlyShort
      front = `<path d="M ${wL + 1} 68 C ${wL} 41 ${wR} 41 ${wR - 1} 68 C ${wR - 5} 57 ${wL + 5} 57 ${wL + 1} 68 Z" fill="${sh}"/>
        <g fill="${base}">
          <circle cx="55" cy="52" r="7.5"/><circle cx="67" cy="46" r="8.5"/><circle cx="80" cy="44" r="9"/><circle cx="93" cy="46" r="8.5"/><circle cx="105" cy="52" r="7.5"/>
          <circle cx="50" cy="59" r="5.5"/><circle cx="110" cy="59" r="5.5"/>
          <circle cx="72" cy="52" r="5.5"/><circle cx="88" cy="52" r="5.5"/>
        </g>
        <g fill="${hi}" opacity=".45">
          <circle cx="66" cy="44" r="3.6"/><circle cx="80" cy="42" r="4"/><circle cx="94" cy="44" r="3.6"/>
        </g>`;
      break;
    case 9: // curlyFull
      back = `<g fill="${sh}">
          <circle cx="46" cy="61" r="10"/><circle cx="114" cy="61" r="10"/>
          <circle cx="54" cy="47" r="11"/><circle cx="106" cy="47" r="11"/>
        </g>`;
      front = `<path d="M ${wL} 68 C ${wL} 40 ${wR} 40 ${wR} 68 Z" fill="${base}"/>
        <g fill="${base}">
          <circle cx="51" cy="55" r="9"/><circle cx="60" cy="45" r="9.5"/><circle cx="73" cy="41" r="10"/><circle cx="87" cy="41" r="10"/><circle cx="100" cy="45" r="9.5"/><circle cx="109" cy="55" r="9"/>
          <circle cx="66" cy="52" r="6"/><circle cx="80" cy="51" r="6"/><circle cx="94" cy="52" r="6"/>
        </g>
        <g fill="${hi}" opacity=".45">
          <circle cx="72" cy="40" r="4"/><circle cx="88" cy="40" r="4"/><circle cx="60" cy="44" r="3.8"/>
        </g>`;
      break;
    case 10: // curlyBig (Cucurella / David Luiz style)
      back = `<g fill="${sh}">
          <circle cx="38" cy="66" r="13"/><circle cx="37" cy="86" r="13"/><circle cx="41" cy="104" r="12"/>
          <circle cx="122" cy="66" r="13"/><circle cx="123" cy="86" r="13"/><circle cx="119" cy="104" r="12"/>
          <circle cx="50" cy="46" r="14"/><circle cx="110" cy="46" r="14"/><circle cx="80" cy="37" r="15"/>
        </g>
        <g fill="${base}">
          <circle cx="41" cy="76" r="10"/><circle cx="43" cy="96" r="10"/>
          <circle cx="119" cy="76" r="10"/><circle cx="117" cy="96" r="10"/>
        </g>`;
      front = `<g fill="${base}">
          <circle cx="47" cy="54" r="11"/><circle cx="58" cy="42" r="11.5"/><circle cx="73" cy="38" r="12"/><circle cx="88" cy="38" r="12"/><circle cx="102" cy="42" r="11.5"/><circle cx="113" cy="54" r="11"/>
        </g>
        <g fill="${hi}" opacity=".42">
          <circle cx="72" cy="36" r="4.8"/><circle cx="89" cy="36" r="4.8"/><circle cx="58" cy="42" r="4.2"/>
        </g>`;
      break;
    case 11: // afro
      back = `<circle cx="80" cy="58" r="${43 + v}" fill="${sh}"/>`;
      front = `<path d="M ${wL} 68 C 36 28 124 28 ${wR} 68 C ${wR - 7} 53 ${wL + 7} 53 ${wL} 68 Z" fill="${base}"/>
        <circle cx="68" cy="36" r="8.5" fill="${hi}" opacity=".30"/><circle cx="92" cy="38" r="7.5" fill="${hi}" opacity=".24"/>`;
      break;
    case 12: // braids / cornrows
      back = `<g fill="${sh}">
          <rect x="${wL - 3}" y="61" width="6" height="36" rx="3"/><rect x="${wL + 4}" y="65" width="5" height="34" rx="2.5"/>
          <rect x="${wR - 3}" y="61" width="6" height="36" rx="3"/><rect x="${wR - 9}" y="65" width="5" height="34" rx="2.5"/>
        </g>`;
      front = `<path d="M ${wL + 1} 67 C ${wL} 40 ${wR} 40 ${wR - 1} 67 C ${wR - 6} 55 ${wL + 6} 55 ${wL + 1} 67 Z" fill="${base}"/>
        <g stroke="${hi}" stroke-width="2" stroke-linecap="round" opacity=".6">
          <path d="M 60 47 L 55 56"/><path d="M 70 44 L 68 54"/><path d="M 80 43 L 80 54"/><path d="M 90 44 L 92 54"/><path d="M 100 47 L 105 56"/>
        </g>`;
      break;
    case 13: // locs / dreadlocks
      back = `<g fill="${sh}">
          <rect x="${wL - 6}" y="56" width="7" height="52" rx="3.5"/><rect x="${wL}" y="60" width="7" height="52" rx="3.5"/>
          <rect x="${wR - 1}" y="56" width="7" height="52" rx="3.5"/><rect x="${wR - 7}" y="60" width="7" height="52" rx="3.5"/>
        </g>`;
      front = `<g fill="${base}">
          <path d="M ${wL} 67 C ${wL - 1} 39 ${wR + 1} 39 ${wR} 67 C ${wR - 6} 54 ${wL + 6} 54 ${wL} 67 Z"/>
          <rect x="46" y="47" width="8" height="27" rx="4" transform="rotate(14 50 47)"/>
          <rect x="106" y="47" width="8" height="27" rx="4" transform="rotate(-14 110 47)"/>
        </g>
        <g stroke="${hi}" stroke-width="2" stroke-linecap="round" opacity=".52">
          <path d="M 64 46 L 58 55"/><path d="M 80 43 L 80 54"/><path d="M 96 46 L 102 55"/>
        </g>`;
      break;
    case 14: // slickBack
      front = `<path d="M ${wL + 1} 68 C ${wL - 1} 39 ${wR + 1} 39 ${wR - 1} 68 C ${wR - 5} 55 ${wR - 14} 52 80 52 C ${wL + 14} 52 ${wL + 5} 55 ${wL + 1} 68 Z" fill="${base}"/>
        <path d="M 62 47 Q 80 42 98 47" stroke="${hi}" stroke-width="2.3" stroke-linecap="round" fill="none" opacity=".68"/>`;
      break;
    case 15: // longStraight
      back = `<path d="M ${wL - 5} 62 C ${wL - 3} 38 ${wR + 3} 38 ${wR + 5} 62 L ${wR + 9} 118 C ${wR + 2} 122 ${wR - 6} 118 ${wR - 10} 106 L ${wL + 10} 106 C ${wL + 6} 118 ${wL - 2} 122 ${wL - 9} 118 Z" fill="${sh}"/>`;
      front = `<path d="M ${wL - 1} 69 C ${wL - 2} 38 ${wR + 2} 38 ${wR + 1} 69 C ${wR - 4} 55 92 50 80 55 C 68 50 ${wL + 4} 55 ${wL - 1} 69 Z" fill="${base}"/>
        <path d="M 56 49 Q 80 42 104 49" stroke="${hi}" stroke-width="2.2" stroke-linecap="round" fill="none" opacity=".6"/>`;
      break;
    case 16: // longWavy
      back = `<path d="M ${wL - 5} 60 C ${wL - 3} 38 ${wR + 3} 38 ${wR + 5} 60 Q ${wR + 12} 86 ${wR + 6} 116 Q 112 122 104 110 L 56 110 Q 48 122 ${wL - 6} 116 Q ${wL - 12} 86 ${wL - 5} 60 Z" fill="${sh}"/>`;
      front = `<path d="M ${wL - 1} 69 C ${wL - 2} 37 ${wR + 2} 37 ${wR + 1} 69 C ${wR - 5} 54 93 50 80 54 C 67 50 ${wL + 5} 54 ${wL - 1} 69 Z" fill="${base}"/>
        <path d="M 55 49 Q 67 42 80 46 Q 93 42 105 49" stroke="${hi}" stroke-width="2.2" stroke-linecap="round" fill="none" opacity=".6"/>`;
      break;
    case 17: // manBun (slicked back hugging skull dome + compact rear bun)
      back = `<circle cx="80" cy="40" r="8" fill="${sh}"/><circle cx="80" cy="39.5" r="5.5" fill="${base}"/>`;
      front = `<path d="M ${wL + 1} 68 C ${wL - 1} 40 ${wR + 1} 40 ${wR - 1} 68 C ${wR - 5} 56 ${wR - 13} 52 80 53 C ${wL + 13} 52 ${wL + 5} 56 ${wL + 1} 68 Z" fill="${base}"/>
        <path d="M 61 48 Q 80 43 99 48" stroke="${hi}" stroke-width="2.2" stroke-linecap="round" fill="none" opacity=".62"/>`;
      break;
    case 18: // bleachedCurly (dark sides + blonde/highlighted curly top hugging skull)
      front = `<path d="M ${wL + 1} 68 C ${wL} 41 ${wR} 41 ${wR - 1} 68 C ${wR - 5} 57 ${wR - 13} 53 80 54 C ${wL + 13} 53 ${wL + 5} 57 ${wL + 1} 68 Z" fill="${sh}"/>
        <g fill="${tBase}">
          <circle cx="57" cy="51" r="7"/><circle cx="68" cy="45" r="8"/><circle cx="80" cy="43" r="8.5"/><circle cx="92" cy="45" r="8"/><circle cx="103" cy="51" r="7"/>
          <circle cx="74" cy="50" r="5"/><circle cx="86" cy="50" r="5"/>
        </g>
        <g fill="${tHi}" opacity=".55">
          <circle cx="68" cy="43" r="3.2"/><circle cx="80" cy="41" r="3.8"/><circle cx="92" cy="43" r="3.2"/>
        </g>`;
      break;
    default:
      front = '';
  }

  return {back, front};
}

function beardLayer(beard, hairPal, geom, earX) {
  if (!beard) return '';
  const [base, , sh] = hairPal;
  // Slightly darker natural tone for blonde/white beards unless pure grey
  const jawY = geom.jawY;
  const rx = earX;
  const xL = 80 - rx + 2;
  const xR = 80 + rx - 2;
  switch (beard) {
    case 1: // light stubble
      return `<path d="M ${xL + 3} 88 C ${xL + 5} ${jawY - 3} 65 ${jawY} 80 ${jawY} C 95 ${jawY} ${xR - 5} ${jawY - 3} ${xR - 3} 88 L ${xR - 8} 91 C 94 100 66 100 ${xL + 8} 91 Z" fill="${sh}" opacity=".22"/>
        <path d="M 69 92 Q 80 89 91 92" stroke="${sh}" stroke-width="3" stroke-linecap="round" fill="none" opacity=".20"/>`;
    case 2: // heavy stubble
      return `<path d="M ${xL + 1} 82 C ${xL + 2} ${jawY - 2} 63 ${jawY + 1} 80 ${jawY + 1} C 97 ${jawY + 1} ${xR - 2} ${jawY - 2} ${xR - 1} 82 L ${xR - 6} 88 C 96 102 64 102 ${xL + 6} 88 Z" fill="${base}" opacity=".42"/>
        <path d="M 67 92 Q 80 88.5 93 92" stroke="${base}" stroke-width="3.6" stroke-linecap="round" fill="none" opacity=".42"/>`;
    case 3: // goatee
      return `<path d="M 70 97 Q 80 95 90 97 C 90 109 86 ${jawY + 1} 80 ${jawY + 1} C 74 ${jawY + 1} 70 109 70 97 Z" fill="${base}" opacity=".84"/>`;
    case 4: // mustache + goatee
      return `<path d="M 66 92 Q 80 87 94 92 Q 87 94 80 92 Q 73 94 66 92 Z" fill="${base}" opacity=".88"/>
        <path d="M 69 98 Q 80 95 91 98 C 91 110 86 ${jawY + 1} 80 ${jawY + 1} C 74 ${jawY + 1} 69 110 69 98 Z" fill="${base}" opacity=".86"/>`;
    case 5: // short full beard
      return `<path d="M ${xL} 79 C ${xL} ${jawY} 64 ${jawY + 2} 80 ${jawY + 2} C 96 ${jawY + 2} ${xR} ${jawY} ${xR} 79 L ${xR - 4} 84 C ${xR - 6} 97 96 101 90 94 C 84 90 76 90 70 94 C 64 101 ${xL + 6} 97 ${xL + 4} 84 Z" fill="${base}" opacity=".88"/>
        <path d="M 67 92 Q 80 87 93 92" stroke="${sh}" stroke-width="3.4" stroke-linecap="round" fill="none" opacity=".82"/>`;
    case 6: // thick full beard
      return `<path d="M ${xL - 1} 76 C ${xL - 2} ${jawY + 4} 62 ${jawY + 8} 80 ${jawY + 8} C 98 ${jawY + 8} ${xR + 2} ${jawY + 4} ${xR + 1} 76 L ${xR - 3} 82 C ${xR - 6} 96 95 100 89 93 C 83 89 77 89 71 93 C 65 100 ${xL + 6} 96 ${xL + 3} 82 Z" fill="${base}" opacity=".94"/>
        <path d="M 66 92 Q 80 86.5 94 92" stroke="${sh}" stroke-width="4" stroke-linecap="round" fill="none" opacity=".9"/>`;
    default:
      return '';
  }
}

function browSVG(brows, color) {
  const w = brows === 2 ? 3.5 : brows === 0 ? 1.8 : 2.6;
  const curveL = brows === 3 ? 'M 55 69 Q 63 64 72 68' : brows === 2 ? 'M 55 68 Q 64 65.5 72 68.5' : 'M 56 68.5 Q 64 66 72 68.5';
  const curveR = brows === 3 ? 'M 88 68 Q 97 64 105 69' : brows === 2 ? 'M 88 68.5 Q 96 65.5 105 68' : 'M 88 68.5 Q 96 66 104 68.5';
  return `<g fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" opacity=".9"><path d="${curveL}"/><path d="${curveR}"/></g>`;
}

function mouthSVG(expr, skinShadow) {
  if (expr === 2) {
    return `<path d="M 71 94.5 Q 80 98 89 94.5 Q 80 95.5 71 94.5 Z" fill="#ebe5dc" opacity=".88"/>
      <path d="M 70 94.2 Q 80 98.8 90 94.2" fill="none" stroke="${skinShadow}" stroke-width="1.4" stroke-linecap="round"/>
      <path d="M 75 98.8 Q 80 100.3 85 98.8" fill="none" stroke="${skinShadow}" stroke-width="1.1" opacity=".52" stroke-linecap="round"/>`;
  }
  if (expr === 0) {
    return `<path d="M 70 95 L 90 95" fill="none" stroke="${skinShadow}" stroke-width="1.9" stroke-linecap="round"/>
      <path d="M 75 98 Q 80 99.5 85 98" fill="none" stroke="${skinShadow}" stroke-width="1.1" opacity=".52" stroke-linecap="round"/>`;
  }
  return `<path d="M 70 94.5 Q 80 97.5 90 94.5" fill="none" stroke="${skinShadow}" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M 75 98 Q 80 99.8 85 98" fill="none" stroke="${skinShadow}" stroke-width="1.1" opacity=".5" stroke-linecap="round"/>`;
}

function buildProfile(player) {
  const id = player?.id;
  const seed = hashInt(id ?? player?.name ?? 'player');
  const rawCode = id != null ? AVATAR_PROFILES[String(id)] : '';
  const base = decodeProfile(rawCode, seed);
  const star = id != null ? STAR_AVATARS[String(id)] : null;
  return star ? {...base, ...star} : base;
}

export function playerAvatarSVG(player, {compact = false} = {}) {
  const uid = `fm${++uidSeq}`;
  const seed = hashInt(player?.id ?? player?.name ?? uid);
  const p = buildProfile(player);
  const skinPal = SKIN_PALETTE[p.skin] || SKIN_PALETTE[3];
  const hairPal = HAIR_PALETTE[p.hairColor] || HAIR_PALETTE[1];
  const tipPal = p.hairTipColor != null ? HAIR_PALETTE[p.hairTipColor] : null;
  const eyeColor = EYE_PALETTE[p.eyes] || EYE_PALETTE[0];
  const kit = resolveKit(player, seed);
  const geom = faceGeometry(p.faceShape, p.faceWidth);
  const hair = hairLayers(p.hairStyle, hairPal, tipPal, p.hairVol, geom.earX);
  const browColor = p.hairColor >= 8 && p.hairColor <= 10 ? HAIR_PALETTE[6][0] : hairPal[2];
  const beard = beardLayer(p.beard, p.hairColor >= 9 ? HAIR_PALETTE[6] : hairPal, geom, geom.earX);
  const noseOffset = (p.noseW || 0) * 1.3;
  const delay = ((seed % 32) / 10).toFixed(1);
  const vb = compact ? '20 10 120 120' : '0 0 160 160';
  const collarColor = kit[2] || kit[1] || '#ffffff';

  const headbandSVG = p.headband
    ? `<path d="M ${80 - geom.earX + 1} 58 Q 80 51 ${80 + geom.earX - 1} 58 L ${80 + geom.earX} 54.5 Q 80 47.5 ${80 - geom.earX} 54.5 Z" fill="#181b20" stroke="#ffffff26" stroke-width="0.6"/>`
    : '';

  const maskSVG = p.mask
    ? `<g opacity=".95">
        <path d="M ${80 - geom.earX + 2} 69 L 74 68 L 80 71 L 86 68 L ${80 + geom.earX - 2} 69 L ${80 + geom.earX - 3} 82 Q 97 87 84 82 L 80 78 L 76 82 Q 63 87 ${80 - geom.earX + 3} 82 Z" fill="#1b1e23" stroke="#3b4048" stroke-width="1"/>
        <ellipse cx="64" cy="74" rx="7.6" ry="4.9" fill="${skinPal[0]}" stroke="#2d3138" stroke-width="0.9"/>
        <ellipse cx="96" cy="74" rx="7.6" ry="4.9" fill="${skinPal[0]}" stroke="#2d3138" stroke-width="0.9"/>
      </g>`
    : '';

  const eyeDetails = `
    <g class="fm-eyes">
      <ellipse cx="64" cy="74.5" rx="6.2" ry="3.8" fill="#00000018"/>
      <ellipse cx="96" cy="74.5" rx="6.2" ry="3.8" fill="#00000018"/>
      <ellipse cx="64" cy="74" rx="5.4" ry="3.2" fill="#f3f0ec"/>
      <ellipse cx="96" cy="74" rx="5.4" ry="3.2" fill="#f3f0ec"/>
      <circle cx="64.3" cy="74" r="2.7" fill="${eyeColor}"/>
      <circle cx="95.7" cy="74" r="2.7" fill="${eyeColor}"/>
      <circle cx="64.3" cy="74" r="1.35" fill="#101216"/>
      <circle cx="95.7" cy="74" r="1.35" fill="#101216"/>
      <circle cx="65.4" cy="72.9" r="0.85" fill="#ffffff"/>
      <circle cx="96.8" cy="72.9" r="0.85" fill="#ffffff"/>
      <path d="M 58.3 73.3 Q 64 70 69.8 73.3" fill="none" stroke="#1b1512" stroke-width="1.35" stroke-linecap="round"/>
      <path d="M 90.2 73.3 Q 96 70 101.7 73.3" fill="none" stroke="#1b1512" stroke-width="1.35" stroke-linecap="round"/>
      ${compact ? '' : `<ellipse class="fm-blink-lid" cx="64" cy="74" rx="5.8" ry="3.6" fill="${skinPal[0]}"/><ellipse class="fm-blink-lid" cx="96" cy="74" rx="5.8" ry="3.6" fill="${skinPal[0]}"/>`}
    </g>`;

  return `<svg class="fm-avatar${compact ? ' fm-compact' : ''}" viewBox="${vb}" style="--fm-delay:-${delay}s" aria-hidden="true">
    <defs>
      <radialGradient id="${uid}_bg" cx="50%" cy="34%" r="72%">
        <stop offset="0%" stop-color="#2c4e3c" stop-opacity=".42"/>
        <stop offset="100%" stop-color="#07120d" stop-opacity=".68"/>
      </radialGradient>
      <radialGradient id="${uid}_skin" cx="50%" cy="38%" r="62%">
        <stop offset="0%" stop-color="${skinPal[1]}"/>
        <stop offset="62%" stop-color="${skinPal[0]}"/>
        <stop offset="100%" stop-color="${skinPal[2]}"/>
      </radialGradient>
      <linearGradient id="${uid}_neck" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${skinPal[2]}"/>
        <stop offset="55%" stop-color="${skinPal[0]}"/>
        <stop offset="100%" stop-color="${skinPal[2]}"/>
      </linearGradient>
      <linearGradient id="${uid}_kit_sh" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#000000" stop-opacity=".14"/>
        <stop offset="100%" stop-color="#000000" stop-opacity=".02"/>
      </linearGradient>
      <clipPath id="${uid}_kit">
        <path d="M 10 162 C 16 124 38 116 62 113 L 80 124 L 98 113 C 122 116 144 124 150 162 Z"/>
      </clipPath>
    </defs>
    <rect x="0" y="0" width="160" height="160" fill="url(#${uid}_bg)"/>
    <g class="fm-torso">
      ${kitPatternSVG(kit, `${uid}_kit`)}
      <path d="M 59 113 L 80 129 L 101 113" fill="none" stroke="${collarColor}" stroke-width="3.2" stroke-linejoin="round"/>
      <rect x="65" y="102" width="30" height="24" rx="9" fill="url(#${uid}_neck)"/>
      <path d="M 65 104 Q 80 118 95 104 L 95 113 Q 80 120 65 113 Z" fill="#00000038"/>
    </g>
    <g class="fm-head">
      ${hair.back}
      <ellipse cx="${80 - geom.earX}" cy="76" rx="4.5" ry="8.5" fill="${skinPal[2]}"/>
      <ellipse cx="${80 - geom.earX + 0.8}" cy="76" rx="2.6" ry="5.5" fill="${skinPal[0]}"/>
      <ellipse cx="${80 + geom.earX}" cy="76" rx="4.5" ry="8.5" fill="${skinPal[2]}"/>
      <ellipse cx="${80 + geom.earX - 0.8}" cy="76" rx="2.6" ry="5.5" fill="${skinPal[0]}"/>
      <path d="${geom.d}" fill="url(#${uid}_skin)"/>
      ${p.cheekShade ? `<ellipse cx="59" cy="84" rx="5.5" ry="3.5" fill="${skinPal[2]}" opacity=".28"/><ellipse cx="101" cy="84" rx="5.5" ry="3.5" fill="${skinPal[2]}" opacity=".28"/>` : ''}
      ${p.jawSharp ? `<path d="M ${80 - geom.earX + 4} 91 L 67 ${geom.jawY - 3} M ${80 + geom.earX - 4} 91 L 93 ${geom.jawY - 3}" stroke="${skinPal[2]}" stroke-width="1.2" opacity=".45" fill="none"/>` : ''}
      ${beard}
      <path d="M 78.5 72 L 77.5 85 Q 80 87.5 82.5 85 L 81.5 72" fill="${skinPal[1]}" opacity=".35"/>
      <path d="M ${74 - noseOffset} 85.5 Q 80 89 ${86 + noseOffset} 85.5" fill="none" stroke="${skinPal[2]}" stroke-width="1.7" stroke-linecap="round"/>
      ${mouthSVG(p.expr, skinPal[2])}
      ${maskSVG}
      ${eyeDetails}
      ${browSVG(p.brows, browColor)}
      ${headbandSVG}
      ${hair.front}
    </g>
  </svg>`;
}
