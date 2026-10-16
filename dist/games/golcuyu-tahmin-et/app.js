import { MATCHES, MATCH_CATEGORIES } from './matches.js';
import { LEGENDARY_PLAYERS, normalizeName } from './legends.js';
import { generatePixelAvatar } from './avatar.js';

export const STORAGE_KEY = 'pixel-scout:golcuyu-tahmin-et:v1';
const MAX_ATTEMPTS = 4;

// Uygulama durumu
let currentCategory = 'all';
let currentMatchIndex = 0;
let currentMatch = MATCHES[0];
let currentGoalIndex = 0;
let currentGoal = currentMatch.goals[0];
let searchDatabase = [...LEGENDARY_PLAYERS];

// Her gol için tur durumu: { [goalId]: { attempts: [], solved: false, revealedLost: false } }
let roundState = {};

// Genel istatistikler
let stats = {
  matchesCompleted: 0,
  goalsSolved: 0,
  totalGuesses: 0,
  correctGuesses: 0
};

// LocalStorage yükle
function loadStats() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        stats = { ...stats, ...parsed };
      }
    }
  } catch {
    // Depolama okunamıyorsa varsayılan kullanılır
  }
}

function saveStats() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // Sessizce geç
  }
}

// Oyuncu veritabanını dist/players.json ile genişlet
async function initPlayerDatabase() {
  try {
    const res = await fetch('../../players.json');
    if (res.ok) {
      const data = await res.json();
      const allPlayers = [...(data.players || []), ...(data.searchPlayers || [])];
      
      const existingNames = new Set(searchDatabase.map(p => normalizeName(p.name)));
      for (const p of allPlayers) {
        const norm = normalizeName(p.name);
        if (!existingNames.has(norm)) {
          existingNames.add(norm);
          searchDatabase.push({
            id: p.id,
            name: p.name,
            nationality: p.nationality,
            nationalityCode: p.nationalityCode,
            position: p.position || 'MF',
            photoPath: p.photo?.path || null,
            era: p.club ? `${p.club} (${p.league})` : 'Aktif'
          });
        }
      }
    }
  } catch (err) {
    console.warn('players.json yüklenemedi, yerel efsaneler havuzu kullanılıyor.', err);
  }
}

if (typeof document !== 'undefined') {
// Arayüz Elemanları
const categoryTabsEl = document.getElementById('category-tabs');
const matchSelectorEl = document.getElementById('match-selector');
const randomMatchBtn = document.getElementById('random-match-btn');
const matchTournamentEl = document.getElementById('match-tournament');
const matchDateVenueEl = document.getElementById('match-date-venue');
const homeNameEl = document.getElementById('home-name');
const awayNameEl = document.getElementById('away-name');
const matchScoreEl = document.getElementById('match-score');
const goalsProgressEl = document.getElementById('goals-progress');
const goalsListEl = document.getElementById('goals-list');

const portraitGoalLabelEl = document.getElementById('portrait-goal-label');
const portraitTeamLabelEl = document.getElementById('portrait-team-label');
const portraitContainerEl = document.getElementById('portrait-container');
const portraitStatusEl = document.getElementById('portrait-status');

const cluePositionCard = document.getElementById('clue-position-card');
const cluePositionVal = document.getElementById('clue-position-val');
const clueCountryCard = document.getElementById('clue-country-card');
const clueCountryVal = document.getElementById('clue-country-val');
const cluePhotoCard = document.getElementById('clue-photo-card');
const cluePhotoVal = document.getElementById('clue-photo-val');

const searchSectionEl = document.getElementById('search-section');
const playerInputEl = document.getElementById('player-input');
const guessBtnEl = document.getElementById('guess-btn');
const suggestionsEl = document.getElementById('suggestions');
const attemptsTextEl = document.getElementById('attempts-text');
const attemptsDotsEl = document.getElementById('attempts-dots');
const successBannerEl = document.getElementById('success-banner');
const successTitleEl = document.getElementById('success-title');
const successDescEl = document.getElementById('success-desc');
const guessesHistoryEl = document.getElementById('guesses-history');
const matchCompletedEl = document.getElementById('match-completed');
const nextMatchBtnEl = document.getElementById('next-match-btn');

const statsBtnEl = document.getElementById('stats-btn');
const statsModalEl = document.getElementById('stats-modal');
const closeStatsEl = document.getElementById('close-stats');
const statMatchesEl = document.getElementById('stat-matches');
const statGoalsEl = document.getElementById('stat-goals');
const statAccuracyEl = document.getElementById('stat-accuracy');

// Kategori Sekmelerini Çiz
function renderCategories() {
  categoryTabsEl.innerHTML = '';
  for (const cat of MATCH_CATEGORIES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `tab-btn ${cat.id === currentCategory ? 'active' : ''}`;
    btn.textContent = cat.title;
    btn.addEventListener('click', () => {
      currentCategory = cat.id;
      renderCategories();
      populateMatchSelector();
      selectMatch(getFilteredMatches()[0]);
    });
    categoryTabsEl.appendChild(btn);
  }
}

function getFilteredMatches() {
  if (currentCategory === 'all') return MATCHES;
  return MATCHES.filter(m => m.category === currentCategory);
}

// Maç Seçici Dropdown'u Doldur
function populateMatchSelector() {
  matchSelectorEl.innerHTML = '';
  const filtered = getFilteredMatches();
  filtered.forEach((m) => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = `${m.homeTeam.name} ${m.homeTeam.score} - ${m.awayTeam.score} ${m.awayTeam.name} (${m.date.split(' ').pop()})`;
    if (m.id === currentMatch.id) opt.selected = true;
    matchSelectorEl.appendChild(opt);
  });
}

// Maç Seç
function selectMatch(match) {
  if (!match) return;
  currentMatch = match;
  roundState = {};
  for (const g of currentMatch.goals) {
    roundState[g.id] = { attempts: [], solved: false, revealedLost: false };
  }
  currentGoalIndex = 0;
  currentGoal = currentMatch.goals[0];
  matchCompletedEl.hidden = true;

  updateMatchUI();
  selectGoal(0);
}

// Maç Arayüzünü Güncelle
function updateMatchUI() {
  populateMatchSelector();
  matchTournamentEl.textContent = `🏆 ${currentMatch.tournament}`;
  matchDateVenueEl.textContent = `📅 ${currentMatch.date} · 📍 ${currentMatch.stadium}`;
  homeNameEl.textContent = currentMatch.homeTeam.name;
  awayNameEl.textContent = currentMatch.awayTeam.name;
  matchScoreEl.textContent = `${currentMatch.homeTeam.score} - ${currentMatch.awayTeam.score}`;

  renderGoalsList();
}

// Goller Butonlarını Çiz
function renderGoalsList() {
  goalsListEl.innerHTML = '';
  let solvedCount = 0;

  currentMatch.goals.forEach((g, idx) => {
    const state = roundState[g.id] || { attempts: [], solved: false, revealedLost: false };
    if (state.solved) solvedCount++;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `goal-pill ${idx === currentGoalIndex ? 'selected' : ''} ${state.solved ? 'solved' : ''} ${state.revealedLost ? 'revealed-lost' : ''}`;

    let label = `⚽ ${g.minute}' ${g.team}`;
    if (state.solved) {
      label += ` · ${g.scorerName} ✓`;
    } else if (state.revealedLost) {
      label += ` · ${g.scorerName} ✗`;
    } else {
      label += ` · ???`;
    }

    btn.textContent = label;
    btn.addEventListener('click', () => selectGoal(idx));
    goalsListEl.appendChild(btn);
  });

  goalsProgressEl.textContent = `${solvedCount}/${currentMatch.goals.length} Çözüldü`;

  // Tüm goller çözüldüyse
  if (solvedCount === currentMatch.goals.length && currentMatch.goals.length > 0) {
    matchCompletedEl.hidden = false;
    stats.matchesCompleted += 1;
    saveStats();
  }
}

// Gol Seç
function selectGoal(index) {
  currentGoalIndex = index;
  currentGoal = currentMatch.goals[index];
  renderGoalsList();
  updateGoalUI();
}

// Aktif Gol UI'ını Güncelle
function updateGoalUI() {
  const state = roundState[currentGoal.id];
  const attemptsCount = state.attempts.length;
  const isDone = state.solved || state.revealedLost;

  portraitGoalLabelEl.textContent = `${currentGoal.minute}. DAKİKA GOLÜ`;
  portraitTeamLabelEl.textContent = currentGoal.team;

  // İpucu Aşamaları
  // 1. Yanlışta Mevki
  const posUnlocked = attemptsCount >= 1 || state.solved || state.revealedLost;
  if (posUnlocked) {
    cluePositionCard.className = 'clue-card unlocked';
    cluePositionVal.textContent = formatPosition(currentGoal.position);
  } else {
    cluePositionCard.className = 'clue-card locked';
    cluePositionVal.textContent = '🔒 1. Yanlışta';
  }

  // 2. Yanlışta Ülke
  const countryUnlocked = attemptsCount >= 2 || state.solved || state.revealedLost;
  if (countryUnlocked) {
    clueCountryCard.className = 'clue-card unlocked';
    clueCountryVal.textContent = `${currentGoal.nationality} (${currentGoal.nationalityCode})`;
  } else {
    clueCountryCard.className = 'clue-card locked';
    clueCountryVal.textContent = '🔒 2. Yanlışta';
  }

  // 3. Yanlışta Portre Netleşmesi
  const photoUnlocked = attemptsCount >= 3 || state.solved || state.revealedLost;
  if (photoUnlocked) {
    cluePhotoCard.className = 'clue-card unlocked';
    cluePhotoVal.textContent = 'Açıldı';
  } else {
    cluePhotoCard.className = 'clue-card locked';
    cluePhotoVal.textContent = '🔒 3. Yanlışta';
  }

  // Portre Çizimi
  renderPortrait(attemptsCount, isDone);

  // Arama Alanı ve Haklar
  if (isDone) {
    searchSectionEl.style.display = 'none';
  } else {
    searchSectionEl.style.display = 'block';
    playerInputEl.value = '';
    playerInputEl.focus();
  }

  const remaining = Math.max(0, MAX_ATTEMPTS - attemptsCount);
  attemptsTextEl.textContent = isDone ? 'Tamamlandı' : `Kalan Hak: ${remaining}/${MAX_ATTEMPTS}`;

  // Hak Noktaları
  attemptsDotsEl.innerHTML = '';
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const dot = document.createElement('span');
    if (i < attemptsCount) {
      dot.className = state.solved && i === attemptsCount - 1 ? 'dot won' : 'dot used';
    } else {
      dot.className = 'dot';
    }
    attemptsDotsEl.appendChild(dot);
  }

  // Başarı / Açıklama Kutusu
  if (state.solved) {
    successBannerEl.hidden = false;
    successBannerEl.style.borderColor = 'var(--lime)';
    successBannerEl.style.background = '#204128';
    successTitleEl.textContent = `✅ BİLDİNİZ: ${currentGoal.scorerName}!`;
    successDescEl.textContent = currentGoal.description;
    portraitStatusEl.className = 'status-badge solved';
    portraitStatusEl.textContent = 'DOĞRU TAHMİN! ✓';
  } else if (state.revealedLost) {
    successBannerEl.hidden = false;
    successBannerEl.style.borderColor = 'var(--red)';
    successBannerEl.style.background = '#4a2420';
    successTitleEl.textContent = `❌ GOLCÜ: ${currentGoal.scorerName}`;
    successDescEl.textContent = currentGoal.description;
    portraitStatusEl.className = 'status-badge lost';
    portraitStatusEl.textContent = 'HAKLAR TÜKENDİ';
  } else {
    successBannerEl.hidden = true;
    portraitStatusEl.className = 'status-badge';
    portraitStatusEl.textContent = attemptsCount > 0 ? `${attemptsCount} YANLIŞ YAPILDI` : 'İPUÇLARI BEKLENİYOR';
  }

  // Tahmin Geçmişi
  guessesHistoryEl.innerHTML = '';
  state.attempts.forEach((att, idx) => {
    const row = document.createElement('div');
    row.className = `guess-row ${att.correct ? 'correct' : ''}`;
    row.innerHTML = `
      <span class="guess-num">#${idx + 1}</span>
      <span class="guess-name">${att.playerName}</span>
      <span class="guess-msg">${att.correct ? '✅ Doğru!' : '❌ Yanlış Oyuncu'}</span>
    `;
    guessesHistoryEl.appendChild(row);
  });
}

function formatPosition(pos) {
  if (pos === 'FW') return 'Forvet (FW)';
  if (pos === 'MF') return 'Orta Saha (MF)';
  if (pos === 'DF') return 'Defans (DF)';
  if (pos === 'GK') return 'Kaleci (GK)';
  return pos;
}

// Portre Çizimi
function renderPortrait(attemptsCount, isDone) {
  portraitContainerEl.innerHTML = '';
  let levelClass = 'level-0';
  if (isDone || attemptsCount >= 3) {
    levelClass = 'unlocked';
  } else if (attemptsCount === 2) {
    levelClass = 'level-2';
  } else if (attemptsCount === 1) {
    levelClass = 'level-1';
  }

  if (currentGoal.photoPath) {
    const img = document.createElement('img');
    img.src = `../../${currentGoal.photoPath}`;
    img.alt = currentGoal.scorerName;
    img.className = `portrait-img ${levelClass}`;
    portraitContainerEl.appendChild(img);
  } else {
    // Özel SVG Pixel Avatar
    const svgWrap = document.createElement('div');
    svgWrap.className = `portrait-img ${levelClass}`;
    svgWrap.innerHTML = generatePixelAvatar(currentGoal, currentGoal.team);
    portraitContainerEl.appendChild(svgWrap);
  }
}

// Tahmin Yapma Mantığı
function handleGuess(guessedPlayerName) {
  const query = (guessedPlayerName || playerInputEl.value).trim();
  if (!query) return;

  const state = roundState[currentGoal.id];
  if (state.solved || state.revealedLost) return;

  stats.totalGuesses += 1;

  const targetNorm = normalizeName(currentGoal.scorerName);
  const guessedNorm = normalizeName(query);

  // Hedefin alternatif isimleri veya ana ismi ile eşleşme kontrolü
  const isMatch = targetNorm === guessedNorm ||
    currentGoal.aliases.some(a => normalizeName(a) === guessedNorm) ||
    (guessedNorm.length >= 4 && targetNorm.includes(guessedNorm));

  if (isMatch) {
    state.solved = true;
    state.attempts.push({ playerName: currentGoal.scorerName, correct: true });
    stats.correctGuesses += 1;
    stats.goalsSolved += 1;
  } else {
    state.attempts.push({ playerName: query, correct: false });
    if (state.attempts.length >= MAX_ATTEMPTS) {
      state.revealedLost = true;
    }
  }

  saveStats();
  renderGoalsList();
  updateGoalUI();
}

// Otomatik Tamamlama / Öneriler
let selectedSuggestionIndex = -1;

function showSuggestions(val) {
  const term = normalizeName(val);
  if (!term || term.length < 2) {
    suggestionsEl.hidden = true;
    suggestionsEl.innerHTML = '';
    return;
  }

  const matches = [];
  for (const p of searchDatabase) {
    const pNorm = normalizeName(p.name);
    if (pNorm.includes(term)) {
      matches.push(p);
      if (matches.length >= 10) break;
    }
  }

  if (matches.length === 0) {
    suggestionsEl.hidden = true;
    return;
  }

  suggestionsEl.innerHTML = '';
  selectedSuggestionIndex = -1;

  matches.forEach((p, idx) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="sugg-name">${p.name}</span>
      <span class="sugg-details">
        <span>${p.nationality || ''}</span>
        <span class="sugg-pos">${p.position || 'MF'}</span>
      </span>
    `;
    li.addEventListener('click', () => {
      playerInputEl.value = p.name;
      suggestionsEl.hidden = true;
      handleGuess(p.name);
    });
    suggestionsEl.appendChild(li);
  });

  suggestionsEl.hidden = false;
}

// Olay Dinleyicileri
playerInputEl.addEventListener('input', (e) => {
  showSuggestions(e.target.value);
});

playerInputEl.addEventListener('keydown', (e) => {
  const items = suggestionsEl.querySelectorAll('li');
  if (!suggestionsEl.hidden && items.length > 0) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedSuggestionIndex = (selectedSuggestionIndex + 1) % items.length;
      items.forEach((item, idx) => item.classList.toggle('active', idx === selectedSuggestionIndex));
      if (items[selectedSuggestionIndex]) {
        playerInputEl.value = items[selectedSuggestionIndex].querySelector('.sugg-name').textContent;
      }
      return;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedSuggestionIndex = (selectedSuggestionIndex - 1 + items.length) % items.length;
      items.forEach((item, idx) => item.classList.toggle('active', idx === selectedSuggestionIndex));
      if (items[selectedSuggestionIndex]) {
        playerInputEl.value = items[selectedSuggestionIndex].querySelector('.sugg-name').textContent;
      }
      return;
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedSuggestionIndex >= 0 && items[selectedSuggestionIndex]) {
        const chosen = items[selectedSuggestionIndex].querySelector('.sugg-name').textContent;
        playerInputEl.value = chosen;
      }
      suggestionsEl.hidden = true;
      handleGuess();
      return;
    } else if (e.key === 'Escape') {
      suggestionsEl.hidden = true;
      return;
    }
  }

  if (e.key === 'Enter') {
    e.preventDefault();
    suggestionsEl.hidden = true;
    handleGuess();
  }
});

document.addEventListener('click', (e) => {
  if (!searchSectionEl.contains(e.target)) {
    suggestionsEl.hidden = true;
  }
});

guessBtnEl.addEventListener('click', () => {
  suggestionsEl.hidden = true;
  handleGuess();
});

matchSelectorEl.addEventListener('change', (e) => {
  const chosen = MATCHES.find(m => m.id === e.target.value);
  if (chosen) selectMatch(chosen);
});

randomMatchBtn.addEventListener('click', () => {
  const filtered = getFilteredMatches();
  const next = filtered[Math.floor(Math.random() * filtered.length)];
  selectMatch(next);
});

nextMatchBtnEl.addEventListener('click', () => {
  const filtered = getFilteredMatches();
  const currentIdx = filtered.findIndex(m => m.id === currentMatch.id);
  const next = filtered[(currentIdx + 1) % filtered.length];
  selectMatch(next);
});

// İstatistikler Modalı
statsBtnEl.addEventListener('click', () => {
  statMatchesEl.textContent = stats.matchesCompleted;
  statGoalsEl.textContent = stats.goalsSolved;
  const acc = stats.totalGuesses > 0 ? Math.round((stats.correctGuesses / stats.totalGuesses) * 100) : 0;
  statAccuracyEl.textContent = `%${acc}`;
  statsModalEl.showModal();
});

closeStatsEl.addEventListener('click', () => {
  statsModalEl.close();
});

// Başlangıç
loadStats();
renderCategories();
populateMatchSelector();
selectMatch(MATCHES[0]);
initPlayerDatabase();
}

