// Scoreboard ve Liderlik Tablosu Mantığı
// Piyasa Değeri Oyunu için yerel depolama ve sıralama yönetimi

export const SCOREBOARD_STORAGE_KEY = 'pixel_scout_piyasa_degeri_scoreboard';
export const PLAYER_NAME_STORAGE_KEY = 'pixel_scout_player_name';

export const DEFAULT_SCOREBOARD = [
  { name: 'Pep', score: 8, date: '18.10.2024' },
  { name: 'Alex', score: 6, date: '18.10.2024' },
  { name: 'Hakan', score: 5, date: '18.10.2024' },
  { name: 'Arda', score: 4, date: '18.10.2024' },
  { name: 'Sergen', score: 3, date: '18.10.2024' }
];

/**
 * Scoreboard listesini depodan okur, yoksa varsayılan listeyi döner.
 */
export function getScoreboard(storage = globalThis.localStorage) {
  if (!storage) return [...DEFAULT_SCOREBOARD];
  try {
    const raw = storage.getItem(SCOREBOARD_STORAGE_KEY);
    if (!raw) return [...DEFAULT_SCOREBOARD];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return [...DEFAULT_SCOREBOARD];
    return parsed.slice(0, 5);
  } catch {
    return [...DEFAULT_SCOREBOARD];
  }
}

/**
 * Kayıtlı oyuncu ismini okur.
 */
export function getStoredPlayerName(storage = globalThis.localStorage) {
  if (!storage) return '';
  try {
    return (storage.getItem(PLAYER_NAME_STORAGE_KEY) || '').trim();
  } catch {
    return '';
  }
}

/**
 * Oyuncu ismini kaydeder.
 */
export function setStoredPlayerName(name, storage = globalThis.localStorage) {
  const cleanName = (name || '').trim();
  if (storage && cleanName) {
    try {
      storage.setItem(PLAYER_NAME_STORAGE_KEY, cleanName);
    } catch {
      // Storage hatası durumunda sessizce devam et
    }
  }
  return cleanName;
}

/**
 * Yeni skoru kaydeder ve sıralama/mesaj analizini döner.
 * Kurallar:
 * 1. Oyuncu ilk 3 cevapta elenirse (skor < 3): "HAYAL KIRIKLIĞI"
 * 2. 1. sıraya yerleşirse: "YENİ REKOR" + konfeti
 * 3. 2. veya 3. olursa: "TEBRİKLER PODYUMDASIN"
 * 4. Diğer: "OYUN BİTTİ"
 */
export function recordScore(score, playerName = 'Oyuncu', storage = globalThis.localStorage) {
  const safeName = (playerName || '').trim() || 'Oyuncu';
  const currentList = getScoreboard(storage);

  const entry = {
    name: safeName,
    score: Number(score) || 0,
    date: new Date().toLocaleDateString('tr-TR'),
    timestamp: Date.now()
  };

  // Listeye ekle ve puana göre çoktan aza sırala
  const merged = [...currentList, entry];
  merged.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (b.timestamp || 0) - (a.timestamp || 0);
  });

  // Oyuncunun listedeki en iyi pozisyonu (1 tabanlı sıra)
  const rank = merged.findIndex(item => item === entry) + 1;
  const top5 = merged.slice(0, 5);

  if (storage) {
    try {
      storage.setItem(SCOREBOARD_STORAGE_KEY, JSON.stringify(top5));
    } catch {
      // Sessizce devam et
    }
  }

  // Durum analizi
  let outcome = 'NORMAL';
  let title = 'OYUN BİTTİ!';
  let subtitle = 'İyi denemeydi!';
  let icon = '❌';

  if (score < 3) {
    // İlk 3 cevapta elendi (0, 1 veya 2 skor)
    outcome = 'DISAPPOINTMENT';
    title = 'HAYAL KIRIKLIĞI';
    subtitle = 'İlk 3 cevapta elendin. Futbol bilgini biraz daha tazelemen gerek!';
    icon = '🥀';
  } else if (rank === 1) {
    // 1. Sıra: Yeni Rekor
    outcome = 'RECORD';
    title = 'YENİ REKOR';
    subtitle = 'Zirvenin yeni sahibi sensin! Muhteşem bir futbol hafızası!';
    icon = '🏆';
  } else if (rank === 2 || rank === 3) {
    // 2. veya 3. Sıra: Podyum
    outcome = 'PODIUM';
    title = 'TEBRİKLER PODYUMDASIN';
    subtitle = `Harika bir performans sergileyerek ${rank}. sıraya yerleştin!`;
    icon = rank === 2 ? '🥈' : '🥉';
  } else if (rank <= 5) {
    outcome = 'TOP5';
    title = 'İLK 5\'TESİN!';
    subtitle = `Tebrikler! ${rank}. sıradan liderlik tablosuna adını yazdırdın.`;
    icon = '⭐';
  }

  return {
    rank,
    outcome,
    title,
    subtitle,
    icon,
    isTop5: rank <= 5,
    top5,
    newEntry: entry
  };
}
