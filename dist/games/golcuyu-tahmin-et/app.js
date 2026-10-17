import { MATCHES } from './matches.js';
import { NATIONAL_MATCHES } from './national-matches.js';
import { LEGENDARY_PLAYERS, normalizeName } from './legends.js';
import { generatePixelAvatar } from './avatar.js';

export const STORAGE_KEY = 'pixel-scout:golcuyu-tahmin-et:v1';
const MAX_ATTEMPTS = 4;

// Oyun Modu: 'national' (varsayılan) | 'classic'
let currentMode = 'national';

// Uygulama durumu
let currentMatch = NATIONAL_MATCHES[0];
let currentGoalIndex = 0;
let currentGoal = currentMatch.goals[0];
let searchDatabase = [...LEGENDARY_PLAYERS];

// Her gol için tur durumu: { [goalId]: { attempts: [], solved: false, passed: false, opponent: false } }
let roundState = {};

// Modlara göre oturum havuzları (Sayfayı yenileyene kadar maçlar asla tekrarlanmaz)
let classicMatchBag = [];
let nationalMatchBag = [];

// İstatistikler
let stats = {
  matchesCompleted: 0,
  goalsSolved: 0,
  totalGuesses: 0,
  correctGuesses: 0
};

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
    // Depolama okunamıyorsa varsayılan
  }
}

function saveStats() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // Sessizce geç
  }
}

// Oyuncu veritabanını dist/players.json ile genişlet (Yüz tanıma oyunundaki tüm 2400+ futbolcu)
async function initPlayerDatabase() {
  const candidateUrls = [
    '../../players.json',
    '../players.json',
    './players.json',
    '/players.json'
  ];

  for (const url of candidateUrls) {
    try {
      const res = await fetch(url);
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
              aliases: p.aliases || [],
              nationality: p.nationality || '',
              nationalityCode: p.nationalityCode || '',
              position: p.position || 'MF',
              photoUrl: p.photo?.path ? `../../${p.photo.path}` : null,
              era: p.club ? `${p.club} (${p.league})` : 'Aktif'
            });
          }
        }
        break;
      }
    } catch {
      // Bir sonraki URL'yi dene
    }
  }
}

// Fisher-Yates Dizi Karıştırma
function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

if (typeof document !== 'undefined') {
  // Arayüz Elemanları
  const modeNationalBtn = document.getElementById('mode-national-btn');
  const modeClassicBtn = document.getElementById('mode-classic-btn');
  const modeNoticeBanner = document.getElementById('mode-notice-banner');

  const randomMatchBtn = document.getElementById('random-match-btn');
  const skipMatchActionBtn = document.getElementById('skip-match-action');
  const matchTournamentEl = document.getElementById('match-tournament');
  const matchDateVenueEl = document.getElementById('match-date-venue');
  const homeNameEl = document.getElementById('home-name');
  const awayNameEl = document.getElementById('away-name');
  const matchScoreEl = document.getElementById('match-score');
  const goalsProgressEl = document.getElementById('goals-progress');
  const homeGoalsListEl = document.getElementById('home-goals-list');
  const awayGoalsListEl = document.getElementById('away-goals-list');

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
  const passGoalBtnEl = document.getElementById('pass-goal-btn');
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

  // Tekrarsız Oturum Havuzu: Sayfa yenilenene kadar aynı maç tekrar gelmez!
  function pickNextMatch() {
    const pool = currentMode === 'national' ? NATIONAL_MATCHES : MATCHES;
    let bag = currentMode === 'national' ? nationalMatchBag : classicMatchBag;

    // Havuz boşaldıysa (tüm maçlar oynandıysa), havuzu baştan karıştır
    if (bag.length === 0) {
      bag = shuffle(pool.map(m => m.id));
      // Son oynanan maç hemen ilk maç olarak gelmesin
      if (currentMatch && bag.length > 1 && bag[bag.length - 1] === currentMatch.id) {
        [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
      }
      if (currentMode === 'national') {
        nationalMatchBag = bag;
      } else {
        classicMatchBag = bag;
      }
    }

    const nextId = bag.pop();
    const chosen = pool.find(m => m.id === nextId) || pool[0];
    startMatch(chosen);
  }

  // Mod Değiştirme
  function setMode(mode) {
    if (currentMode === mode && currentMatch) return;
    currentMode = mode;

    if (mode === 'national') {
      modeNationalBtn?.classList.add('active', 'national');
      modeClassicBtn?.classList.remove('active');
      if (modeNoticeBanner) {
        modeNoticeBanner.hidden = false;
        modeNoticeBanner.innerHTML = '🇹🇷 <strong>MİLLİ TAKIM MODU:</strong> Sadece Türkiye\'nin attığı goller tahmin edilir. Rakip takımın golleri otomatik olarak açıktır.';
      }
    } else {
      modeClassicBtn?.classList.add('active');
      modeNationalBtn?.classList.remove('active', 'national');
      if (modeNoticeBanner) {
        modeNoticeBanner.hidden = false;
        modeNoticeBanner.innerHTML = '🌍 <strong>KULÜP & DÜNYA KUPASI MODU:</strong> Şampiyonlar Ligi finalleri, Süper Lig derbileri ve Dünya Kupası efsane maçları.';
      }
    }

    pickNextMatch();
  }

  // Maçı Başlat
  function startMatch(match) {
    currentMatch = match;
    roundState = {};

    for (const g of currentMatch.goals) {
      // Milli Takım modunda rakip golleri baştan açık
      if (g.guessable === false) {
        roundState[g.id] = { attempts: [], solved: true, passed: false, opponent: true };
      } else {
        roundState[g.id] = { attempts: [], solved: false, passed: false, opponent: false };
      }
    }

    matchCompletedEl.hidden = true;
    updateMatchUI();

    // İlk tahmin edilecek gole odaklan
    const firstGuessableIdx = currentMatch.goals.findIndex(g => g.guessable !== false);
    selectGoal(firstGuessableIdx !== -1 ? firstGuessableIdx : 0);
  }

  // Maç Arayüzünü Güncelle
  function updateMatchUI() {
    matchTournamentEl.textContent = `🏆 ${currentMatch.tournament}`;
    matchDateVenueEl.textContent = `📅 ${currentMatch.date} · 📍 ${currentMatch.stadium}`;
    homeNameEl.textContent = currentMatch.homeTeam.name;
    awayNameEl.textContent = currentMatch.awayTeam.name;
    matchScoreEl.textContent = `${currentMatch.homeTeam.score} - ${currentMatch.awayTeam.score}`;

    renderVerticalGoals();
  }

  // Takımların Altındaki Golleri Çiz
  function renderVerticalGoals() {
    homeGoalsListEl.innerHTML = '';
    awayGoalsListEl.innerHTML = '';

    const guessableGoals = currentMatch.goals.filter(g => g.guessable !== false);
    let solvedOrPassedTurkeyCount = 0;

    currentMatch.goals.forEach((g, idx) => {
      const state = roundState[g.id] || { attempts: [], solved: false, passed: false };
      const isSelected = idx === currentGoalIndex;
      const isDone = state.solved || state.passed;

      // Rakip Golü ise: Açık ve tahmin edilmez
      if (g.guessable === false) {
        const item = document.createElement('div');
        item.className = 'goal-pill opponent-goal';
        item.innerHTML = `⚽ ${g.minute}' ${g.scorerName} <span class="opponent-tag">Rakip Golü</span>`;
        if (g.isHome) homeGoalsListEl.appendChild(item);
        else awayGoalsListEl.appendChild(item);
        return;
      }

      // Türkiye Golü (veya klasik moddaki tüm goller)
      if (isDone) solvedOrPassedTurkeyCount++;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `goal-pill ${isSelected ? 'selected' : ''} ${state.solved ? 'solved' : ''} ${state.passed ? 'passed' : ''}`;

      let text = `⚽ ${g.minute}' `;
      if (state.solved) {
        text += `${g.scorerName} ✓`;
      } else if (state.passed) {
        text += `${g.scorerName} ↷`;
      } else {
        text += `???`;
      }

      btn.textContent = text;
      btn.addEventListener('click', () => selectGoal(idx));

      if (g.isHome) {
        homeGoalsListEl.appendChild(btn);
      } else {
        awayGoalsListEl.appendChild(btn);
      }
    });

    // İlerleme Rozeti
    const totalToGuess = guessableGoals.length;
    goalsProgressEl.textContent = currentMode === 'national'
      ? `${solvedOrPassedTurkeyCount}/${totalToGuess} Milli Gol Çözüldü`
      : `${solvedOrPassedTurkeyCount}/${totalToGuess} Gol Çözüldü`;

    // Maçtaki tüm tahmin edilecek goller bittiyse
    if (solvedOrPassedTurkeyCount === totalToGuess && totalToGuess > 0) {
      matchCompletedEl.hidden = false;
      stats.matchesCompleted += 1;
      saveStats();
    }
  }

  // Gol Seçimi
  function selectGoal(index) {
    currentGoalIndex = index;
    currentGoal = currentMatch.goals[index];

    // Eğer rakip golü ise, en yakın tahmin edilecek gole geç
    if (currentGoal && currentGoal.guessable === false) {
      const firstGuessable = currentMatch.goals.findIndex(g => g.guessable !== false);
      if (firstGuessable !== -1) {
        currentGoalIndex = firstGuessable;
        currentGoal = currentMatch.goals[firstGuessable];
      }
    }

    renderVerticalGoals();
    updateGoalUI();
  }

  // Aktif Gol UI'ı
  function updateGoalUI() {
    if (!currentGoal) return;
    const state = roundState[currentGoal.id] || { attempts: [], solved: false, passed: false };
    const attemptsCount = state.attempts.length;
    const isDone = state.solved || state.passed;

    portraitGoalLabelEl.textContent = `${currentGoal.minute}. DAKİKA GOLÜ`;
    portraitTeamLabelEl.textContent = currentGoal.team;

    // 1. İpucu: Mevki
    const posUnlocked = attemptsCount >= 1 || isDone;
    if (posUnlocked) {
      cluePositionCard.className = 'clue-card unlocked';
      cluePositionVal.textContent = formatPosition(currentGoal.position);
    } else {
      cluePositionCard.className = 'clue-card locked';
      cluePositionVal.textContent = '🔒 1. Yanlışta';
    }

    // 2. İpucu: Ülke
    const countryUnlocked = attemptsCount >= 2 || isDone;
    if (countryUnlocked) {
      clueCountryCard.className = 'clue-card unlocked';
      clueCountryVal.textContent = `${currentGoal.nationality} (${currentGoal.nationalityCode})`;
    } else {
      clueCountryCard.className = 'clue-card locked';
      clueCountryVal.textContent = '🔒 2. Yanlışta';
    }

    // 3. İpucu: Fotoğraf Netleşmesi
    const photoUnlocked = attemptsCount >= 3 || isDone;
    if (photoUnlocked) {
      cluePhotoCard.className = 'clue-card unlocked';
      cluePhotoVal.textContent = 'Netleşti';
    } else {
      cluePhotoCard.className = 'clue-card locked';
      cluePhotoVal.textContent = '🔒 3. Yanlışta';
    }

    // Portre Çizimi
    renderPortrait(attemptsCount, isDone);

    // Arama Kutusu ve Butonlar
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
      if (state.passed) {
        dot.className = 'dot passed';
      } else if (i < attemptsCount) {
        dot.className = state.solved && i === attemptsCount - 1 ? 'dot won' : 'dot used';
      } else {
        dot.className = 'dot';
      }
      attemptsDotsEl.appendChild(dot);
    }

    // Başarı / Sonuç / Pas Kutusu
    if (state.solved) {
      successBannerEl.hidden = false;
      successBannerEl.style.borderColor = 'var(--lime)';
      successBannerEl.style.background = '#204128';
      successTitleEl.textContent = `✅ BİLDİNİZ: ${currentGoal.scorerName}!`;
      successDescEl.textContent = currentGoal.description;
      portraitStatusEl.className = 'status-badge solved';
      portraitStatusEl.textContent = 'DOĞRU TAHMİN! ✓';
    } else if (state.passed) {
      successBannerEl.hidden = false;
      successBannerEl.style.borderColor = 'var(--orange)';
      successBannerEl.style.background = '#3f2c1b';
      successTitleEl.textContent = `↷ PAS GEÇİLDİ: ${currentGoal.scorerName}`;
      successDescEl.textContent = currentGoal.description;
      portraitStatusEl.className = 'status-badge passed';
      portraitStatusEl.textContent = 'PAS GEÇİLDİ (CEVAP AÇILDI)';
    } else {
      successBannerEl.hidden = true;
      portraitStatusEl.className = 'status-badge';
      portraitStatusEl.textContent = attemptsCount > 0 ? `${attemptsCount} YANLIŞ YAPILDI` : 'İPUÇLARI BEKLENİYOR';
    }

    // Tahmin Geçmişi
    guessesHistoryEl.innerHTML = '';
    state.attempts.forEach((att, idx) => {
      const row = document.createElement('div');
      row.className = `guess-row ${att.correct ? 'correct' : att.passed ? 'passed' : ''}`;
      row.innerHTML = `
        <span class="guess-num">#${idx + 1}</span>
        <span class="guess-name">${att.playerName}</span>
        <span class="guess-msg">${att.correct ? '✅ Doğru!' : att.passed ? '↷ Pas Geçildi' : '❌ Yanlış Oyuncu'}</span>
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

  // Portre Çizimi (Futbolculuk Dönemi Fotoğrafı + SVG Fallback)
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

    if (currentGoal.photoUrl) {
      const img = document.createElement('img');
      img.alt = currentGoal.scorerName;
      img.className = `portrait-img ${levelClass}`;
      img.referrerPolicy = 'no-referrer';

      const srcUrl = currentGoal.photoUrl.startsWith('http')
        ? `https://images.weserv.nl/?url=${encodeURIComponent(currentGoal.photoUrl)}&w=360&output=jpg`
        : currentGoal.photoUrl;

      img.src = srcUrl;
      img.onerror = () => {
        if (img.src !== currentGoal.photoUrl && currentGoal.photoUrl.startsWith('http')) {
          img.src = currentGoal.photoUrl;
          return;
        }
        portraitContainerEl.innerHTML = '';
        const svgWrap = document.createElement('div');
        svgWrap.className = `portrait-img ${levelClass}`;
        svgWrap.innerHTML = generatePixelAvatar(currentGoal, currentGoal.team);
        portraitContainerEl.appendChild(svgWrap);
      };
      portraitContainerEl.appendChild(img);
    } else {
      const svgWrap = document.createElement('div');
      svgWrap.className = `portrait-img ${levelClass}`;
      svgWrap.innerHTML = generatePixelAvatar(currentGoal, currentGoal.team);
      portraitContainerEl.appendChild(svgWrap);
    }
  }

  // Tahmin Mantığı
  function handleGuess(guessedPlayerName) {
    const query = (guessedPlayerName || playerInputEl.value).trim();
    if (!query) return;

    const state = roundState[currentGoal.id];
    if (!state || state.solved || state.passed) return;

    stats.totalGuesses += 1;

    const targetNorm = normalizeName(currentGoal.scorerName);
    const guessedNorm = normalizeName(query);

    const isMatch = targetNorm === guessedNorm ||
      currentGoal.aliases.some(a => normalizeName(a) === guessedNorm) ||
      (guessedNorm.length >= 4 && targetNorm.includes(guessedNorm));

    if (isMatch) {
      state.solved = true;
      state.attempts.push({ playerName: currentGoal.scorerName, correct: true });
      stats.correctGuesses += 1;
      stats.goalsSolved += 1;
      setTimeout(autoAdvanceGoal, 1400);
    } else {
      state.attempts.push({ playerName: query, correct: false });
      if (state.attempts.length >= MAX_ATTEMPTS) {
        state.passed = true;
        setTimeout(autoAdvanceGoal, 1800);
      }
    }

    saveStats();
    renderVerticalGoals();
    updateGoalUI();
  }

  // Pas Geçme
  function handlePass() {
    const state = roundState[currentGoal.id];
    if (!state || state.solved || state.passed) return;

    state.passed = true;
    state.attempts.push({ playerName: `${currentGoal.scorerName} (Cevap Açıldı)`, correct: false, passed: true });

    saveStats();
    renderVerticalGoals();
    updateGoalUI();

    setTimeout(autoAdvanceGoal, 1800);
  }

  // Sıradaki çözülmemiş tahmin edilecek gole geç
  function autoAdvanceGoal() {
    const nextUnsolvedIdx = currentMatch.goals.findIndex(g =>
      g.guessable !== false && !roundState[g.id]?.solved && !roundState[g.id]?.passed
    );
    if (nextUnsolvedIdx !== -1) {
      selectGoal(nextUnsolvedIdx);
    }
  }

  // Gelişmiş ve Kapsamlı Otomatik Tamamlama (Yüz tanıma oyunundaki 2400+ oyuncu + takma isimler)
  let selectedSuggestionIndex = -1;

  function showSuggestions(val) {
    const term = normalizeName(val);
    if (!term || term.length < 2) {
      suggestionsEl.hidden = true;
      suggestionsEl.innerHTML = '';
      return;
    }

    const exactMatches = [];
    const prefixMatches = [];
    const containsMatches = [];

    for (const p of searchDatabase) {
      const pNorm = normalizeName(p.name);
      const isExact = pNorm === term;
      const isPrefix = pNorm.startsWith(term);
      const isContains = pNorm.includes(term);
      const aliasMatch = p.aliases?.some(a => normalizeName(a).includes(term));

      if (isExact) {
        exactMatches.push(p);
      } else if (isPrefix) {
        prefixMatches.push(p);
      } else if (isContains || aliasMatch) {
        containsMatches.push(p);
      }

      if (exactMatches.length + prefixMatches.length + containsMatches.length >= 30) {
        break;
      }
    }

    const matches = [...exactMatches, ...prefixMatches, ...containsMatches].slice(0, 20);

    if (matches.length === 0) {
      suggestionsEl.hidden = true;
      return;
    }

    suggestionsEl.innerHTML = '';
    selectedSuggestionIndex = -1;

    matches.forEach((p) => {
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

  passGoalBtnEl.addEventListener('click', () => {
    suggestionsEl.hidden = true;
    handlePass();
  });

  randomMatchBtn.addEventListener('click', () => {
    pickNextMatch();
  });

  skipMatchActionBtn.addEventListener('click', () => {
    pickNextMatch();
  });

  nextMatchBtnEl.addEventListener('click', () => {
    pickNextMatch();
  });

  modeNationalBtn?.addEventListener('click', () => {
    setMode('national');
  });

  modeClassicBtn?.addEventListener('click', () => {
    setMode('classic');
  });

  // İstatistik Modalı
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

  // Başlangıç: Milli Takım Modu ile başla
  loadStats();
  setMode('national');
  initPlayerDatabase();
}
