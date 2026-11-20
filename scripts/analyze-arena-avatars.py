#!/usr/bin/env python3
"""Local image analyzer that extracts FM-style facial & kit parameters for Transfer Arenasi.

Downloads player portraits strictly into memory (never saved to disk or repo),
analyzes skin tone, hair color/style/volume, facial hair, face geometry, brow/eye
contrast and expression, then writes compact encoded profiles to:
  dist/games/transfer-arenasi/avatar-data.js
"""

from __future__ import annotations

import concurrent.futures
import hashlib
import io
import json
import math
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
INPUT_JSON = ROOT / "dist" / "games" / "transfer-arenasi" / "players.json"
OUTPUT_JS = ROOT / "dist" / "games" / "transfer-arenasi" / "avatar-data.js"

BASE36 = "0123456789abcdefghijklmnopqrstuvwxyz"

# 18 calibrated Football Manager style skin tones: [base, highlight, shadow]
# Paired with reference RGB centroids calibrated to EA portrait lighting.
SKIN_SPEC = [
    (["#f6d7c9", "#fce6dc", "#d9ad99"], (218, 178, 165)),  # 0: very fair porcelain
    (["#f1cab6", "#fadbc9", "#d19d84"], (214, 162, 146)),  # 1: fair cool pink
    (["#ecc0a6", "#f7d4be", "#c99275"], (208, 152, 128)),  # 2: fair warm
    (["#e5b393", "#f2c8ad", "#be8462"], (201, 143, 118)),  # 3: light ivory/peach
    (["#dba37e", "#eab896", "#b37652"], (194, 134, 108)),  # 4: light-medium warm
    (["#d19771", "#e2ad8a", "#a76c48"], (187, 126, 101)),  # 5: golden medium
    (["#c88b65", "#da9f7b", "#9d623f"], (181, 119, 92)),   # 6: olive light
    (["#bd7f59", "#d1936f", "#915836"], (175, 112, 85)),   # 7: mediterranean olive
    (["#b2744f", "#c78965", "#864f2f"], (172, 107, 78)),   # 8: warm tan / bronze
    (["#a56845", "#ba7d5a", "#7a4629"], (166, 101, 75)),   # 9: light caramel
    (["#965c3b", "#ac704f", "#6c3c22"], (158, 95, 71)),    # 10: caramel
    (["#885134", "#9e6547", "#5f331c"], (148, 88, 66)),    # 11: warm brown
    (["#79462b", "#8f593c", "#522b16"], (138, 80, 60)),    # 12: medium brown
    (["#6a3b23", "#804e34", "#462211"], (127, 74, 56)),    # 13: chestnut brown
    (["#5b321d", "#71432c", "#3b1c0e"], (116, 68, 52)),    # 14: deep brown
    (["#4d2918", "#623925", "#31160a"], (105, 62, 48)),    # 15: rich espresso
    (["#3f2114", "#532f1e", "#261108"], (92, 54, 42)),     # 16: dark espresso
    (["#321910", "#452619", "#1d0c05"], (76, 45, 36)),     # 17: deep ebony
]

# 16 calibrated hair tones: [base, highlight, shadow] + reference RGB
HAIR_SPEC = [
    (["#17181c", "#2d3038", "#0c0d10"], (20, 20, 22)),     # 0: jet black
    (["#251e1b", "#3c322d", "#14100e"], (36, 29, 27)),     # 1: off black
    (["#382820", "#523d32", "#211611"], (55, 40, 34)),     # 2: dark brown
    (["#4f3626", "#6b4d39", "#332116"], (77, 54, 41)),     # 3: medium brown
    (["#693c24", "#865236", "#482615"], (102, 60, 40)),    # 4: chestnut
    (["#745439", "#916d4e", "#523824"], (114, 83, 59)),    # 5: light brown
    (["#8a6b48", "#a88760", "#654b2f"], (135, 105, 74)),   # 6: dark blonde / dirty blonde
    (["#a68657", "#c4a372", "#7d623b"], (164, 134, 92)),   # 7: sandy blonde
    (["#c59d52", "#dfb970", "#997534"], (190, 152, 86)),   # 8: golden blonde
    (["#d8ba6c", "#eed48c", "#ae9148"], (208, 178, 110)),  # 9: bright blonde
    (["#e6d39a", "#f7e8bc", "#bba66c"], (225, 206, 154)),  # 10: platinum blonde
    (["#9b4423", "#ba5c37", "#6e2b12"], (148, 69, 39)),    # 11: ginger / copper
    (["#b76b3b", "#d38554", "#884a23"], (178, 106, 62)),   # 12: strawberry blonde
    (["#5f6268", "#7d8188", "#414449"], (96, 99, 104)),    # 13: salt & pepper
    (["#93979f", "#b2b6be", "#6d7179"], (147, 151, 159)),  # 14: silver grey
    (["#cfd3d9", "#eaedf2", "#a2a7af"], (206, 210, 216)),  # 15: white silver
]

EYE_PALETTE = [
    "#2c1e16",  # 0: dark brown
    "#5c4228",  # 1: hazel / amber brown
    "#476c84",  # 2: steel blue
    "#4e6c4d",  # 3: green / olive
]

# Club kits: [primary, secondary, trim, pattern]
# Patterns: solid, stripes, hoops, halves, centerStripe, sleeves, sash
CLUB_KITS = {
    # England
    "Arsenal": ["#ef0107", "#ffffff", "#063672", "sleeves"],
    "Aston Villa": ["#670e36", "#95bfe5", "#fee505", "sleeves"],
    "AFC Bournemouth": ["#da291c", "#141414", "#ffffff", "stripes"],
    "Brentford": ["#e30613", "#ffffff", "#141414", "stripes"],
    "Brighton": ["#0057b8", "#ffffff", "#ffcd00", "stripes"],
    "Burnley": ["#6c1d45", "#99d6ea", "#ffffff", "sleeves"],
    "Chelsea": ["#034694", "#ffffff", "#dba111", "solid"],
    "Crystal Palace": ["#1b458f", "#c4122e", "#ffffff", "stripes"],
    "Everton": ["#003399", "#ffffff", "#ffffff", "solid"],
    "Fulham": ["#f4f5f7", "#181818", "#cc0000", "sleeves"],
    "Ipswich": ["#0044a9", "#ffffff", "#ffffff", "solid"],
    "Leeds United": ["#f5f6f7", "#ffcd00", "#1d428a", "solid"],
    "Liverpool": ["#c8102e", "#f6eb61", "#ffffff", "solid"],
    "Manchester City": ["#6cabdd", "#ffffff", "#1c2c5b", "solid"],
    "Man Utd": ["#da291c", "#ffffff", "#161616", "solid"],
    "Newcastle Utd": ["#191a1c", "#f4f5f6", "#ffffff", "stripes"],
    "Nott'm Forest": ["#dd0000", "#ffffff", "#ffffff", "solid"],
    "Southampton": ["#d71920", "#ffffff", "#181818", "stripes"],
    "Spurs": ["#f5f6f8", "#132257", "#132257", "solid"],
    "Sunderland": ["#eb172b", "#ffffff", "#161616", "stripes"],
    "West Ham": ["#7a263a", "#1bb1e7", "#ffffff", "sleeves"],
    "Wolves": ["#fdb913", "#181818", "#181818", "solid"],
    "Birmingham City": ["#0033a0", "#ffffff", "#ffffff", "solid"],
    "Coventry City": ["#6cb4e4", "#ffffff", "#0d2b56", "stripes"],
    "Hull City": ["#f5931e", "#181818", "#ffffff", "stripes"],
    # Spain
    "Real Madrid": ["#f4f5f8", "#d4af37", "#1c2440", "solid"],
    "FC Barcelona": ["#15336e", "#a50034", "#edbb00", "stripes"],
    "Atlético de Madrid": ["#cb3524", "#f5f6f7", "#1b3668", "stripes"],
    "Athletic Club": ["#d92027", "#f5f6f7", "#181818", "stripes"],
    "Real Sociedad": ["#0067b1", "#f5f6f7", "#ffffff", "stripes"],
    "Real Betis": ["#00954c", "#f5f6f7", "#ffffff", "stripes"],
    "Villarreal CF": ["#fbe100", "#005187", "#005187", "solid"],
    "Valencia CF": ["#f5f6f7", "#181818", "#eb7b00", "solid"],
    "Sevilla FC": ["#f4f5f7", "#d71920", "#d71920", "solid"],
    "Girona FC": ["#d82128", "#f5f6f7", "#181818", "stripes"],
    "Celta": ["#7ebee8", "#ffffff", "#c8102e", "solid"],
    "Getafe CF": ["#005999", "#ffffff", "#ffffff", "solid"],
    "CA Osasuna": ["#b6001f", "#0a2240", "#d4af37", "solid"],
    "Rayo Vallecano": ["#f5f6f7", "#d92027", "#d92027", "sash"],
    "RCD Espanyol": ["#007fc8", "#f5f6f7", "#ffffff", "stripes"],
    "RCD Mallorca": ["#d71920", "#181818", "#f4d03f", "solid"],
    "D. Alavés": ["#005ca9", "#f5f6f7", "#181818", "stripes"],
    "Levante UD": ["#123476", "#a8132d", "#f4d03f", "stripes"],
    "UD Almería": ["#d71920", "#f5f6f7", "#ffffff", "stripes"],
    "Elche CF": ["#f5f6f7", "#007a3d", "#007a3d", "hoops"],
    "RC Deportivo": ["#0055a4", "#f5f6f7", "#ffffff", "stripes"],
    # Italy
    "Lombardia FC": ["#00529f", "#14161a", "#ffffff", "stripes"],
    "Milano FC": ["#c8102e", "#151619", "#ffffff", "stripes"],
    "Juventus": ["#f5f6f8", "#16171a", "#d4af37", "stripes"],
    "SSC Napoli": ["#12a0d7", "#ffffff", "#003c71", "solid"],
    "AS Roma": ["#8e1f2f", "#f0bc42", "#ffffff", "solid"],
    "SS Lazio": ["#87d8f7", "#ffffff", "#0c2b59", "solid"],
    "Bergamo Calcio": ["#0067b1", "#14161a", "#ffffff", "stripes"],
    "Fiorentina": ["#482e92", "#ffffff", "#ffffff", "solid"],
    "Bologna": ["#a21c26", "#1a2f4d", "#ffffff", "stripes"],
    "Torino": ["#8a1e2e", "#ffffff", "#ffffff", "solid"],
    "Udinese": ["#f4f5f6", "#16171a", "#d4af37", "stripes"],
    "Como": ["#0055a5", "#ffffff", "#ffffff", "solid"],
    "Sassuolo": ["#009944", "#151619", "#ffffff", "stripes"],
    "Cagliari": ["#8d1b3d", "#182b4d", "#ffffff", "halves"],
    "Genoa": ["#a6192e", "#041e42", "#ffffff", "halves"],
    "Palermo": ["#f19fb5", "#181818", "#181818", "solid"],
    "Venezia": ["#17181b", "#e86c1f", "#007c59", "solid"],
    # Germany
    "FC Bayern München": ["#dc052d", "#ffffff", "#0066b2", "solid"],
    "Borussia Dortmund": ["#fde100", "#181818", "#181818", "solid"],
    "Leverkusen": ["#e32221", "#181818", "#ffffff", "solid"],
    "RB Leipzig": ["#f5f6f7", "#dd0741", "#001f4c", "solid"],
    "VfB Stuttgart": ["#f5f6f8", "#d71920", "#d71920", "hoops"],
    "Frankfurt": ["#e1000f", "#181818", "#ffffff", "stripes"],
    "SC Freiburg": ["#e30613", "#181818", "#ffffff", "stripes"],
    "VfL Wolfsburg": ["#65b32e", "#ffffff", "#183e1f", "solid"],
    "M'gladbach": ["#f4f5f7", "#181818", "#009944", "solid"],
    "TSG Hoffenheim": ["#1961b5", "#ffffff", "#ffffff", "solid"],
    "1. FSV Mainz 05": ["#c3141e", "#ffffff", "#ffffff", "solid"],
    "Union Berlin": ["#d4011d", "#ffffff", "#f0c800", "solid"],
    "1. FC Köln": ["#f5f6f7", "#ed1c24", "#ed1c24", "solid"],
    "FC Augsburg": ["#f5f6f7", "#ba3733", "#007a3d", "solid"],
    "SV Werder Bremen": ["#1d9053", "#ffffff", "#ffffff", "solid"],
    "Hamburger SV": ["#f5f6f7", "#005ca9", "#181818", "solid"],
    "FC Schalke 04": ["#004d9d", "#ffffff", "#ffffff", "solid"],
    # France
    "Paris SG": ["#004170", "#da291c", "#ffffff", "centerStripe"],
    "OM": ["#f5f6f8", "#2faee0", "#d4af37", "solid"],
    "OL": ["#f5f6f8", "#1a3c8b", "#da291c", "centerStripe"],
    "AS Monaco": ["#e31e24", "#f5f6f8", "#d4af37", "sash"],
    "LOSC Lille": ["#e01e2b", "#132247", "#ffffff", "solid"],
    "RC Lens": ["#ffd100", "#d71920", "#181818", "stripes"],
    "OGC Nice": ["#d71920", "#161719", "#ffffff", "stripes"],
    "Stade Rennais FC": ["#d71920", "#161719", "#ffffff", "solid"],
    "Strasbourg": ["#0082ca", "#ffffff", "#ffffff", "solid"],
    "Paris FC": ["#1b2c5c", "#ffffff", "#2ba8e0", "solid"],
    # Turkey
    "Galatasaray": ["#a90432", "#fdb912", "#161214", "halves"],
    "Fenerbahçe": ["#0d2455", "#f5d000", "#ffffff", "stripes"],
    "Beşiktaş": ["#18191b", "#f4f5f6", "#c8102e", "stripes"],
    "Trabzonspor": ["#6e1a30", "#3897d3", "#ffffff", "stripes"],
    "Başakşehir": ["#f26522", "#13294b", "#ffffff", "solid"],
    "Samsunspor": ["#d71920", "#f4f5f6", "#181818", "stripes"],
    "Göztepe": ["#d71920", "#f5c400", "#181818", "halves"],
    "Konyaspor": ["#007a3d", "#f5f6f7", "#ffffff", "stripes"],
    "Kasımpaşa": ["#103978", "#f5f6f7", "#ffffff", "stripes"],
    "Eyüpspor": ["#54246e", "#f4b91a", "#ffffff", "solid"],
    "Alanyaspor": ["#f26522", "#008749", "#ffffff", "solid"],
    "Çaykur Rizespor": ["#0066b2", "#008a45", "#ffffff", "stripes"],
    "Gaziantep": ["#c8102e", "#181818", "#ffffff", "stripes"],
    "Gençlerbirliği": ["#c8102e", "#181818", "#ffffff", "stripes"],
    "Kocaelispor": ["#00843d", "#181818", "#ffffff", "stripes"],
    "Amed Sportif Faaliyetler": ["#007a3d", "#c8102e", "#ffffff", "stripes"],
    "Erzurumspor Futbol Kulübü": ["#005ca9", "#f5f6f7", "#ffffff", "stripes"],
    "Çorum Futbol Kulübü": ["#c8102e", "#181818", "#ffffff", "solid"],
    # Portugal, Netherlands, Belgium, Scotland, Greece, Denmark
    "FC Porto": ["#004d98", "#f5f6f8", "#ffffff", "stripes"],
    "SL Benfica": ["#e1000f", "#ffffff", "#181818", "solid"],
    "Sporting CP": ["#008057", "#f5f6f8", "#ffffff", "hoops"],
    "SC Braga": ["#d71920", "#f5f6f8", "#ffffff", "sleeves"],
    "Ajax": ["#f5f6f8", "#d2122e", "#d2122e", "centerStripe"],
    "PSV": ["#d71920", "#f5f6f8", "#181818", "stripes"],
    "Feyenoord": ["#d71920", "#f5f6f8", "#181818", "halves"],
    "AZ": ["#db0022", "#ffffff", "#181818", "solid"],
    "Club Brugge": ["#005ca9", "#151619", "#ffffff", "stripes"],
    "RSC Anderlecht": ["#542e91", "#ffffff", "#d4af37", "solid"],
    "R. Union St.-G.": ["#f5d000", "#11386e", "#ffffff", "solid"],
    "Celtic": ["#018749", "#f5f6f8", "#ffffff", "hoops"],
    "Rangers": ["#0033a0", "#ffffff", "#d71920", "solid"],
    "Olympiacos FC": ["#d71920", "#f5f6f8", "#ffffff", "stripes"],
    "Panathinaikos": ["#007a3d", "#ffffff", "#ffffff", "solid"],
    "AEK Athens": ["#f5c400", "#181818", "#ffffff", "stripes"],
    "PAOK FC": ["#18191b", "#f5f6f8", "#ffffff", "stripes"],
    "F.C. København": ["#f5f6f8", "#00387b", "#00387b", "solid"],
    # Americas & Saudi Arabia
    "Inter Miami CF": ["#f4a6bd", "#181818", "#181818", "solid"],
    "LAFC": ["#18191b", "#c39e6d", "#c39e6d", "solid"],
    "Orlando City": ["#633492", "#f4d03f", "#ffffff", "solid"],
    "Chicago Fire FC": ["#d71920", "#14274e", "#ffffff", "solid"],
    "Al Hilal": ["#0047a0", "#ffffff", "#6cb4e4", "solid"],
    "Al Nassr": ["#f5d000", "#00338d", "#00338d", "solid"],
    "Al Ittihad": ["#f5c400", "#161719", "#ffffff", "stripes"],
    "Al Ahli": ["#007a45", "#ffffff", "#d4af37", "solid"],
    "River Plate": ["#f5f6f8", "#d71920", "#181818", "sash"],
    "Boca Juniors": ["#003875", "#f5c400", "#ffffff", "hoops"],
    "Flamengo": ["#c8102e", "#161719", "#ffffff", "hoops"],
    "Palmeiras": ["#006437", "#ffffff", "#d4af37", "solid"],
    "Bahia": ["#0055a5", "#d71920", "#ffffff", "stripes"],
    "Estudiantes": ["#d71920", "#f5f6f8", "#181818", "stripes"],
    "Racing Club": ["#6cb4e4", "#f5f6f8", "#ffffff", "stripes"],
    "Rosario Central": ["#003875", "#f5c400", "#ffffff", "stripes"],
    "Toluca FC": ["#c8102e", "#ffffff", "#ffffff", "solid"],
    "Monterrey": ["#0d2b56", "#f5f6f8", "#ffffff", "stripes"],
    "CF Cruz Azul": ["#0055a5", "#ffffff", "#d71920", "solid"],
}


def b36(n: int) -> str:
    return BASE36[max(0, min(35, int(n)))]


def nearest_index(rgb: tuple[float, float, float], refs: list[tuple[int, int, int]]) -> int:
    r, g, b = rgb
    best_i, best_d = 0, float("inf")
    for i, (rr, gg, bb) in enumerate(refs):
        # Weighted perceptual RGB distance (higher green & red weight for skin/hair)
        d = 2.0 * (r - rr) ** 2 + 3.0 * (g - gg) ** 2 + 1.4 * (b - bb) ** 2
        if d < best_d:
            best_d = d
            best_i = i
    return best_i


def fetch_portrait(player_id: int) -> Image.Image | None:
    urls = (
        f"https://cdn.futbin.com/content/fifa26/img/players/{player_id}.png",
        f"https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p{player_id}.png",
        f"https://cdn.futbin.com/content/fifa25/img/players/{player_id}.png",
    )
    for url in urls:
        for attempt in range(2):
            try:
                req = urllib.request.Request(
                    url,
                    headers={
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                        "Accept": "image/png,image/*;q=0.8",
                    },
                )
                with urllib.request.urlopen(req, timeout=8) as resp:
                    if resp.status == 200:
                        raw = resp.read()
                        if len(raw) > 400:
                            im = Image.open(io.BytesIO(raw)).convert("RGBA")
                            if im.size != (160, 160):
                                im = im.resize((160, 160), Image.Resampling.BILINEAR)
                            return im
            except urllib.error.HTTPError as err:
                if err.code in (403, 404, 410):
                    break
                time.sleep(0.2 * (attempt + 1))
            except Exception:
                time.sleep(0.2 * (attempt + 1))
    return None


def analyze_image(im: Image.Image) -> str:
    arr = np.array(im, dtype=np.float32)
    alpha = arr[:, :, 3]
    mask = alpha > 50
    ys, xs = np.where(mask)
    if len(ys) < 200:
        return ""

    y0, y1 = int(ys.min()), int(ys.max())
    h = max(20, y1 - y0 + 1)

    # Head-only bounding box (exclude wide shoulders in bottom 25%)
    head_r0 = max(0, int(y0 + h * 0.08))
    head_r1 = min(160, int(y0 + h * 0.72))
    hys, hxs = np.where(mask[head_r0:head_r1, :])
    if len(hxs) < 100:
        hx0, hx1 = 42, 118
    else:
        hx0, hx1 = int(np.percentile(hxs, 2)), int(np.percentile(hxs, 98))
    hw = max(24, hx1 - hx0 + 1)

    def crop_head(ry0: float, ry1: float, rx0: float, rx1: float, min_alpha: int = 128) -> np.ndarray:
        r0 = max(0, min(159, int(y0 + h * ry0)))
        r1 = max(r0 + 1, min(160, int(y0 + h * ry1)))
        c0 = max(0, min(159, int(hx0 + hw * rx0)))
        c1 = max(c0 + 1, min(160, int(hx0 + hw * rx1)))
        patch = arr[r0:r1, c0:c1]
        pm = patch[:, :, 3] >= min_alpha
        return patch[pm][:, :3] if pm.any() else np.empty((0, 3), dtype=np.float32)

    # 1. Skin detection from forehead + upper cheeks
    fore = crop_head(0.22, 0.34, 0.32, 0.68)
    cheek_l = crop_head(0.45, 0.56, 0.18, 0.34)
    cheek_r = crop_head(0.45, 0.56, 0.66, 0.82)
    skin_samples = [p for p in (fore, cheek_l, cheek_r) if len(p) > 0]
    if skin_samples:
        cand = np.vstack(skin_samples)
        lum = cand.mean(axis=1)
        q20, q85 = np.percentile(lum, [20, 85])
        filtered = cand[(lum >= q20) & (lum <= q85)]
        if len(filtered) == 0:
            filtered = cand
        skin_rgb = np.median(filtered, axis=0)
    else:
        skin_rgb = np.array([185.0, 128.0, 100.0])

    skin_idx = nearest_index(tuple(skin_rgb), [s[1] for s in SKIN_SPEC])
    skin_lum = float(0.299 * skin_rgb[0] + 0.587 * skin_rgb[1] + 0.114 * skin_rgb[2])

    # 2. Hair pixels around crown & upper temples (strictly above shoulders)
    crown = crop_head(0.01, 0.18, 0.20, 0.80)
    side_l = crop_head(0.16, 0.42, 0.02, 0.20)
    side_r = crop_head(0.16, 0.42, 0.80, 0.98)
    # Ear/neck corridor just beside jaw (between cheek and top of collar)
    ear_l = crop_head(0.46, 0.74, -0.20, 0.12)
    ear_r = crop_head(0.46, 0.74, 0.88, 1.20)

    def non_skin_pixels(px: np.ndarray, thresh: float = 26.0) -> np.ndarray:
        if len(px) == 0:
            return px
        dist = np.linalg.norm(px - skin_rgb[None, :], axis=1)
        return px[dist > thresh]

    crown_hair = non_skin_pixels(crown, 24.0)
    side_all = np.vstack([p for p in (side_l, side_r) if len(p) > 0]) if (len(side_l) or len(side_r)) else np.empty((0, 3))
    side_hair = non_skin_pixels(side_all, 26.0)
    ear_all = np.vstack([p for p in (ear_l, ear_r) if len(p) > 0]) if (len(ear_l) or len(ear_r)) else np.empty((0, 3))
    ear_hair_raw = non_skin_pixels(ear_all, 30.0)

    all_hair = (
        np.vstack([p for p in (crown_hair, side_hair) if len(p) > 0])
        if (len(crown_hair) or len(side_hair))
        else np.empty((0, 3), dtype=np.float32)
    )
    if len(all_hair) >= 12:
        hair_rgb = np.median(all_hair, axis=0)
        hair_color_idx = nearest_index(tuple(hair_rgb), [h_[1] for h_ in HAIR_SPEC])
    else:
        hair_rgb = np.array([36.0, 29.0, 27.0])
        if len(crown) >= 5:
            darkest = crown[np.argsort(crown.mean(axis=1))[: max(3, len(crown) // 4)]]
            hair_rgb = np.median(darkest, axis=0)
            hair_color_idx = nearest_index(tuple(hair_rgb), [h_[1] for h_ in HAIR_SPEC])
        else:
            hair_color_idx = 1

    # Filter ear-corridor hair so only hair-colored pixels count (not collar/background edges)
    if len(ear_hair_raw) > 0:
        hair_dist = np.linalg.norm(ear_hair_raw - hair_rgb[None, :], axis=1)
        neck_hair = ear_hair_raw[hair_dist < 58.0]
    else:
        neck_hair = np.empty((0, 3), dtype=np.float32)

    # 3. Contour & hair geometry metrics within head width
    top_slice = mask[y0 : min(160, y0 + int(h * 0.25)), hx0 : hx1 + 1]
    col_tops = []
    for c in range(top_slice.shape[1]):
        col = np.where(top_slice[:, c])[0]
        if len(col):
            col_tops.append(int(col[0]))
    if len(col_tops) > 8:
        diffs = np.abs(np.diff(col_tops))
        roughness = float(np.mean(diffs > 1.6))
        top_arch = float(np.std(col_tops)) / max(1.0, h * 0.1)
    else:
        roughness = 0.0
        top_arch = 0.2

    def band_width_ratio(ry0: float, ry1: float) -> float:
        r0 = max(0, min(159, int(y0 + h * ry0)))
        r1 = max(r0 + 1, min(160, int(y0 + h * ry1)))
        cols = np.where(mask[r0:r1, :].any(axis=0))[0]
        return float(cols.max() - cols.min()) / 160.0 if len(cols) else 0.4

    top_w = band_width_ratio(0.03, 0.14)
    cheek_w = band_width_ratio(0.45, 0.56)
    jaw_w = band_width_ratio(0.64, 0.72)

    crown_hair_ratio = len(crown_hair) / max(1, len(crown))
    side_hair_ratio = len(side_hair) / max(1, len(side_all))

    # Left vs right asymmetry at top-front hairline (parting direction)
    crown_l = crop_head(0.04, 0.22, 0.15, 0.47)
    crown_r = crop_head(0.04, 0.22, 0.53, 0.85)
    hair_bias = len(non_skin_pixels(crown_l, 25)) - len(non_skin_pixels(crown_r, 25))

    # Classify hairStyle (0..17)
    hair_vol = 1
    if crown_hair_ratio < 0.14 and side_hair_ratio < 0.15:
        if len(crown) > 0 and float(np.mean(np.linalg.norm(crown - skin_rgb[None, :], axis=1))) < 18.0:
            hair_style = 0  # bald
            hair_vol = 0
        else:
            hair_style = 1  # buzz
            hair_vol = 0
    elif len(neck_hair) > 380 and len(neck_hair) / max(1, len(ear_all)) > 0.34:
        if roughness > 0.22:
            hair_style = 10 if top_w > 0.44 else 13  # curlyBig or locs
            hair_vol = 3
        else:
            hair_style = 16 if top_arch > 0.42 else 15  # longWavy or longStraight
            hair_vol = 2
    elif roughness > 0.30 and top_w > 0.46:
        hair_style = 11 if side_hair_ratio > 0.46 else 12  # afro or braids
        hair_vol = 3
    elif roughness > 0.20:
        if top_w > 0.44 or side_hair_ratio > 0.42:
            hair_style = 9  # curlyFull
            hair_vol = 3
        else:
            hair_style = 8  # curlyShort
            hair_vol = 2
    elif crown_hair_ratio > 0.72 and top_w > 0.43:
        if abs(hair_bias) > 16:
            hair_style = 3 if hair_bias > 0 else 4  # parted left/right
        elif top_arch > 0.55:
            hair_style = 5  # quiff
        else:
            hair_style = 7  # wavyMedium
        hair_vol = 2
    elif crown_hair_ratio > 0.45:
        if abs(hair_bias) > 15:
            hair_style = 3 if hair_bias > 0 else 4
        elif top_w < 0.39:
            hair_style = 14  # slickBack
        else:
            fringe = crop_head(0.18, 0.26, 0.26, 0.74)
            hair_style = 6 if len(non_skin_pixels(fringe, 28)) > 15 else 2
        hair_vol = 1
    else:
        hair_style = 2  # shortFade
        hair_vol = 1

    # 4. Beard detection from chin & mustache vs forehead skin reference
    chin = crop_head(0.66, 0.78, 0.36, 0.64)
    stache = crop_head(0.58, 0.64, 0.38, 0.62)
    jaw_l = crop_head(0.58, 0.72, 0.18, 0.34)
    jaw_r = crop_head(0.58, 0.72, 0.66, 0.82)

    def dark_diff(px: np.ndarray) -> float:
        if len(px) < 6:
            return 0.0
        lum = 0.299 * px[:, 0] + 0.587 * px[:, 1] + 0.114 * px[:, 2]
        return max(0.0, skin_lum - float(np.median(lum)))

    d_chin = dark_diff(chin)
    d_stache = dark_diff(stache)
    d_jaw = (dark_diff(jaw_l) + dark_diff(jaw_r)) / 2.0

    scale = max(0.55, skin_lum / 155.0)
    c_score = d_chin / scale
    s_score = d_stache / scale
    j_score = d_jaw / scale

    if c_score > 58 and j_score > 34:
        beard = 6
    elif c_score > 40 and j_score > 22:
        beard = 5
    elif c_score > 38 and s_score > 22 and j_score <= 22:
        beard = 4
    elif c_score > 28 and j_score <= 18:
        beard = 3
    elif c_score > 22 and j_score > 14:
        beard = 2
    elif c_score > 13 or (s_score > 15 and j_score > 9):
        beard = 1
    else:
        beard = 0

    # 5. Face shape (0: oval, 1: square, 2: long, 3: round, 4: sharp) & width (0..4)
    jaw_ratio = jaw_w / max(0.2, cheek_w)
    aspect = cheek_w / max(0.25, h / 160.0)
    if jaw_ratio > 0.90:
        face_shape = 1
    elif aspect > 0.66:
        face_shape = 3
    elif aspect < 0.53:
        face_shape = 2
    elif jaw_ratio < 0.75:
        face_shape = 4
    else:
        face_shape = 0

    if cheek_w < 0.50:
        face_width = 0
    elif cheek_w < 0.54:
        face_width = 1
    elif cheek_w < 0.58:
        face_width = 2
    elif cheek_w < 0.62:
        face_width = 3
    else:
        face_width = 4

    # 6. Eyebrows
    brow_patch = crop_head(0.34, 0.40, 0.28, 0.72)
    brow_dark = dark_diff(brow_patch) / scale
    if brow_dark > 38:
        brows = 2
    elif brow_dark > 24:
        brows = 1
    elif brow_dark > 14:
        brows = 3
    else:
        brows = 0

    # 7. Eye color
    eye_l = crop_head(0.41, 0.46, 0.30, 0.43)
    eye_r = crop_head(0.41, 0.46, 0.57, 0.70)
    eyes_px = np.vstack([p for p in (eye_l, eye_r) if len(p) > 0]) if (len(eye_l) or len(eye_r)) else np.empty((0, 3))
    if len(eyes_px) > 4:
        em = eyes_px.mean(axis=1)
        iris = eyes_px[(em > 35) & (em < 145)]
        if len(iris) > 2:
            ir = np.median(iris, axis=0)
            if ir[2] > ir[0] + 6:
                eyes = 2
            elif ir[1] > ir[0] * 0.88 and ir[1] > ir[2] + 5 and skin_idx <= 7:
                eyes = 3
            elif ir.mean() > 75 and skin_idx <= 8:
                eyes = 1
            else:
                eyes = 0
        else:
            eyes = 0
    else:
        eyes = 0

    # 8. Expression
    mouth = crop_head(0.60, 0.67, 0.40, 0.60)
    if len(mouth) > 5:
        bright_teeth = np.sum((mouth[:, 0] > 185) & (mouth[:, 1] > 175) & (mouth[:, 2] > 170))
        if bright_teeth >= 3:
            expr = 2
        else:
            expr = 1 if (skin_lum > 120 and jaw_ratio < 0.88) else 0
    else:
        expr = 1

    return "".join(
        [
            b36(skin_idx),
            b36(hair_style),
            b36(hair_color_idx),
            b36(beard),
            b36(face_shape),
            b36(face_width),
            b36(brows),
            b36(eyes),
            b36(hair_vol),
            b36(expr),
        ]
    )


def fallback_profile(player: dict) -> str:
    seed = hashlib.sha256(f"{player['id']}:{player['name']}".encode("utf-8")).digest()
    country = (player.get("country") or "").lower()
    northern = {"norway", "sweden", "denmark", "finland", "iceland", "england", "scotland", "ireland", "germany", "holland", "belgium", "poland", "austria", "switzerland"}
    african = {"nigeria", "ghana", "senegal", "cameroon", "ivory coast", "côte d'ivoire", "mali", "guinea", "congo", "dr congo", "kenya", "gambia", "burkina faso", "angola", "cape verde"}
    south_am = {"brazil", "colombia", "ecuador", "argentina", "uruguay", "chile", "peru", "paraguay", "venezuela", "mexico"}

    if country in african:
        skin = 10 + (seed[0] % 7)
        hair_c = seed[2] % 2
        hair_s = [1, 8, 9, 11, 12, 13][seed[1] % 6]
    elif country in northern:
        skin = seed[0] % 5
        hair_c = [2, 3, 5, 6, 7, 8, 9, 11][seed[2] % 8]
        hair_s = [2, 3, 4, 5, 6, 7, 14, 15, 16][seed[1] % 9]
    elif country in south_am:
        skin = 4 + (seed[0] % 7)
        hair_c = seed[2] % 4
        hair_s = [2, 3, 5, 6, 7, 8, 9, 12][seed[1] % 8]
    else:
        skin = 2 + (seed[0] % 6)
        hair_c = seed[2] % 5
        hair_s = [1, 2, 3, 4, 5, 6, 7, 8][seed[1] % 8]

    beard = [0, 0, 1, 1, 2, 3, 5][seed[3] % 7]
    shape = seed[4] % 5
    width = 1 + (seed[5] % 3)
    brows = seed[6] % 4
    eyes = 2 if (skin <= 4 and seed[7] % 3 == 0) else (seed[7] % 2)
    vol = 1 + (seed[8] % 2)
    expr = seed[9] % 3
    return "".join(b36(x) for x in (skin, hair_s, hair_c, beard, shape, width, brows, eyes, vol, expr))


def process_player(player: dict) -> tuple[int, str, bool]:
    im = fetch_portrait(player["id"])
    if im is not None:
        code = analyze_image(im)
        if code:
            return player["id"], code, True
    return player["id"], fallback_profile(player), False


def main() -> int:
    data = json.loads(INPUT_JSON.read_text(encoding="utf-8"))
    players = data["players"]
    total = len(players)
    t0 = time.time()
    print(f"Analyzing {total} players in memory...", flush=True)

    profiles: dict[int, str] = {}
    analyzed_count = 0
    fallback_count = 0

    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as pool:
        futures = [pool.submit(process_player, p) for p in players]
        for idx, fut in enumerate(concurrent.futures.as_completed(futures), 1):
            pid, code, ok = fut.result()
            profiles[pid] = code
            if ok:
                analyzed_count += 1
            else:
                fallback_count += 1
            if idx % 500 == 0 or idx == total:
                elapsed = time.time() - t0
                print(
                    f"  Progress: {idx}/{total} ({analyzed_count} analyzed, {fallback_count} fallback) in {elapsed:.1f}s",
                    flush=True,
                )

    ordered = {str(p["id"]): profiles[p["id"]] for p in players}

    skin_palette = [s[0] for s in SKIN_SPEC]
    hair_palette = [h_[0] for h_ in HAIR_SPEC]

    js_lines = [
        "// Generated by scripts/analyze-arena-avatars.py — Transfer Arenasi FM-style avatar data",
        f"export const SKIN_PALETTE = {json.dumps(skin_palette, separators=(',', ':'))};",
        f"export const HAIR_PALETTE = {json.dumps(hair_palette, separators=(',', ':'))};",
        f"export const EYE_PALETTE = {json.dumps(EYE_PALETTE, separators=(',', ':'))};",
        f"export const CLUB_KITS = {json.dumps(CLUB_KITS, ensure_ascii=False, separators=(',', ':'))};",
        f"export const AVATAR_PROFILES = {json.dumps(ordered, separators=(',', ':'))};",
        "",
    ]
    OUTPUT_JS.write_text("\n".join(js_lines), encoding="utf-8")
    size_kb = OUTPUT_JS.stat().st_size / 1024.0
    print(
        f"Done in {time.time() - t0:.1f}s -> {OUTPUT_JS.relative_to(ROOT)} ({size_kb:.1f} KB, "
        f"analyzed={analyzed_count}/{total} [{analyzed_count*100/total:.1f}%], fallback={fallback_count})",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
