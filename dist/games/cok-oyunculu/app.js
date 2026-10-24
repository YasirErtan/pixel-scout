import { PLAYERS, getPlayerById } from './players.js';
import {
  calculateRoundScores,
  selectUniqueGamePlayers,
  formatMarketValue
} from './scoring.js';
import {
  MultiplayerRoomClient,
  isValidRoomCode,
  getSavedPlayerName,
  getInitials
} from './room.js';

// ==================== DURUM DEĞİŞKENLERİ ====================
const roomClient = new MultiplayerRoomClient();
let selectedQuestionCount = 10;
let selectedTimerSec = 15;
let currentGuessEuro = 50_000_000;
let isMyGuessLocked = false;
let lastRenderedRound = -1;
let lastRenderedStatus = '';
let countdownInterval = null;
const usedPlayerIdsInSession = new Set();

// ==================== DOM REFERANSLARI ====================
const lobbyScreen = document.getElementById('lobbyScreen');
const gameScreen = document.getElementById('gameScreen');
const podiumScreen = document.getElementById('podiumScreen');

const playerNameInput = document.getElementById('playerNameInput');
const lobbyErrorMsg = document.getElementById('lobbyErrorMsg');
const lobbyActionsGrid = document.getElementById('lobbyActionsGrid');
const waitingRoomPanel = document.getElementById('waitingRoomPanel');

const createRoomBtn = document.getElementById('createRoomBtn');
const quickBotMatchBtn = document.getElementById('quickBotMatchBtn');
const roomCodeInput = document.getElementById('roomCodeInput');
const joinRoomBtn = document.getElementById('joinRoomBtn');

const waitingRoomCodeDisplay = document.getElementById('waitingRoomCodeDisplay');
const copyRoomCodeBtn = document.getElementById('copyRoomCodeBtn');
const waitingSettingsBadge = document.getElementById('waitingSettingsBadge');
const waitingPlayerCount = document.getElementById('waitingPlayerCount');
const waitingPlayersList = document.getElementById('waitingPlayersList');
const addBotBtn = document.getElementById('addBotBtn');
const leaveLobbyRoomBtn = document.getElementById('leaveLobbyRoomBtn');
const startMatchBtn = document.getElementById('startMatchBtn');

// Oyun Ekranı DOM
const exitGameBtn = document.getElementById('exitGameBtn');
const headerRoomCode = document.getElementById('headerRoomCode');
const currentQuestionNum = document.getElementById('currentQuestionNum');
const totalQuestionNum = document.getElementById('totalQuestionNum');
const roundStepDots = document.getElementById('roundStepDots');
const timerBox = document.getElementById('timerBox');
const timerText = document.getElementById('timerText');
const timerProgressBar = document.getElementById('timerProgressBar');

const playerPortraitImg = document.getElementById('playerPortraitImg');
const playerPortraitFallback = document.getElementById('playerPortraitFallback');
const playerFallbackInitials = document.getElementById('playerFallbackInitials');
const playerAgeBadge = document.getElementById('playerAgeBadge');
const playerPositionText = document.getElementById('playerPositionText');
const playerNameHeading = document.getElementById('playerNameHeading');
const playerClubLogo = document.getElementById('playerClubLogo');
const playerClubName = document.getElementById('playerClubName');
const playerCountryFlag = document.getElementById('playerCountryFlag');
const playerCountryEmoji = document.getElementById('playerCountryEmoji');
const playerCountryName = document.getElementById('playerCountryName');

const guessConsoleCard = document.getElementById('guessConsoleCard');
const guessValueDisplay = document.getElementById('guessValueDisplay');
const marketValueSlider = document.getElementById('marketValueSlider');
const lockGuessBtn = document.getElementById('lockGuessBtn');
const lockedStatusNote = document.getElementById('lockedStatusNote');

const roundRevealCard = document.getElementById('roundRevealCard');
const revealActualValue = document.getElementById('revealActualValue');
const revealMyPoints = document.getElementById('revealMyPoints');
const revealBreakdownRow = document.getElementById('revealBreakdownRow');
const revealPlayersList = document.getElementById('revealPlayersList');
const nextRoundBtn = document.getElementById('nextRoundBtn');
const nextRoundBtnLabel = document.getElementById('nextRoundBtnLabel');

const sidebarPlayerCountBadge = document.getElementById('sidebarPlayerCountBadge');
const liveScoreboardList = document.getElementById('liveScoreboardList');

// Podyum DOM
const podiumWinnerSubtitle = document.getElementById('podiumWinnerSubtitle');
const podiumTopThree = document.getElementById('podiumTopThree');
const podiumFullList = document.getElementById('podiumFullList');
const playAgainBtn = document.getElementById('playAgainBtn');
const backToLobbyBtn = document.getElementById('backToLobbyBtn');

// ==================== YARDIMCI FONKSİYONLAR ====================
function showLobbyError(msg) {
  if (!lobbyErrorMsg) return;
  if (!msg) {
    lobbyErrorMsg.hidden = true;
    lobbyErrorMsg.textContent = '';
    return;
  }
  lobbyErrorMsg.textContent = msg;
  lobbyErrorMsg.hidden = false;
}

function buildNewDeck(questionCount) {
  const selected = selectUniqueGamePlayers(PLAYERS, questionCount, [...usedPlayerIdsInSession]);
  for (const p of selected) {
    usedPlayerIdsInSession.add(p.id);
  }
  return selected.map((p) => p.id);
}

function setGuessValue(euroVal) {
  const clamped = Math.max(500_000, Math.min(250_000_000, Math.round(euroVal / 500_000) * 500_000));
  currentGuessEuro = clamped;
  if (marketValueSlider) marketValueSlider.value = String(clamped);
  if (guessValueDisplay) guessValueDisplay.textContent = formatMarketValue(clamped, true);
}

// ==================== EKRAN GEÇİŞLERİ VE RENDER ====================
function handleRoomStateUpdate(room) {
  if (!room) return;

  if (room.status === 'lobby') {
    lobbyScreen.hidden = false;
    gameScreen.hidden = true;
    podiumScreen.hidden = true;
    lobbyActionsGrid.hidden = true;
    waitingRoomPanel.hidden = false;
    renderWaitingRoom(room);
    stopRoundCountdown();
    lastRenderedRound = -1;
    lastRenderedStatus = 'lobby';
    return;
  }

  if (room.status === 'playing' || room.status === 'reveal') {
    lobbyScreen.hidden = true;
    gameScreen.hidden = false;
    podiumScreen.hidden = true;
    renderGameArena(room);
    return;
  }

  if (room.status === 'finished') {
    stopRoundCountdown();
    lobbyScreen.hidden = true;
    gameScreen.hidden = true;
    podiumScreen.hidden = false;
    renderPodium(room);
    lastRenderedStatus = 'finished';
  }
}

function renderWaitingRoom(room) {
  waitingRoomCodeDisplay.textContent = room.code;
  const qCount = room.settings?.questionCount || 10;
  const tSec = room.settings?.roundDurationSec || 15;
  waitingSettingsBadge.textContent = `${qCount} Soru • ${tSec} Saniye`;

  const playersArr = Object.values(room.players || {}).sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
  waitingPlayerCount.textContent = String(playersArr.length);

  waitingPlayersList.innerHTML = playersArr
    .map((p) => {
      const isMe = p.id === roomClient.clientId;
      return `
        <div class="waiting-player-chip">
          <div class="waiting-avatar" style="background:${p.color || '#10b981'}">${p.avatar || getInitials(p.name)}</div>
          <div style="min-width:0;">
            <div style="font-weight:700;font-size:0.9rem;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${escapeHtml(p.name)} ${isMe ? '<span style="color:#34d399;font-size:0.75rem;">(Sen)</span>' : ''}
            </div>
            <div style="font-size:0.72rem;color:#94a3b8;">
              ${p.isHost ? '👑 Oda Kurucusu' : p.isBot ? '🤖 Bot Rakip' : '⚡ Hazır'}
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  const isHost = room.hostId === roomClient.clientId;
  startMatchBtn.disabled = !isHost;
  startMatchBtn.querySelector('span').textContent = isHost ? '🚀 MAÇI BAŞLAT' : '⏳ Kurucunun Başlatması Bekleniyor...';
  addBotBtn.hidden = !isHost || playersArr.length >= 6;
}

function renderGameArena(room) {
  const roundIdx = room.currentRound || 0;
  const totalQ = room.settings?.questionCount || 10;
  const targetId = room.deckIds?.[roundIdx];
  const footballer = getPlayerById(targetId) || PLAYERS[roundIdx % PLAYERS.length];

  headerRoomCode.textContent = room.code;
  currentQuestionNum.textContent = String(roundIdx + 1);
  totalQuestionNum.textContent = String(totalQ);

  // Adım noktaları
  renderRoundDots(roundIdx, totalQ);

  // Yeni tura geçildiyse futbolcu kartını ve tahmin konsolunu sıfırla
  if (roundIdx !== lastRenderedRound || lastRenderedStatus === 'lobby' || lastRenderedStatus === 'finished') {
    lastRenderedRound = roundIdx;
    isMyGuessLocked = false;
    setGuessValue(45_000_000);
    marketValueSlider.disabled = false;
    lockGuessBtn.disabled = false;
    lockGuessBtn.querySelector('span').textContent = '🔒 TAHMİNİ KİLİTLE';
    lockedStatusNote.hidden = true;
    renderFootballerCard(footballer);
  }

  // Eğer bu turda zaten tahmin kilitlediysek durumu koru
  const mySubmission = room.guesses?.[roundIdx]?.[roomClient.clientId];
  if (mySubmission && !isMyGuessLocked) {
    isMyGuessLocked = true;
    setGuessValue(mySubmission.guess);
    marketValueSlider.disabled = true;
    lockGuessBtn.disabled = true;
    lockGuessBtn.querySelector('span').textContent = '✓ TAHMİN KİLİTLENDİ';
    lockedStatusNote.hidden = false;
  }

  // Sağdaki canlı puan tablosunu her durumda güncelle
  renderLiveScoreboard(room, roundIdx);

  if (room.status === 'playing') {
    guessConsoleCard.hidden = false;
    roundRevealCard.hidden = true;
    startOrSyncCountdown(room, footballer);
    checkIfAllPlayersLocked(room, footballer);
  } else if (room.status === 'reveal') {
    stopRoundCountdown();
    guessConsoleCard.hidden = true;
    roundRevealCard.hidden = false;
    renderRoundReveal(room, roundIdx, footballer);
  }

  lastRenderedStatus = room.status;
}

function renderRoundDots(currentIdx, totalQ) {
  const dots = [];
  for (let i = 0; i < totalQ; i++) {
    const cls = i < currentIdx ? 'round-dot done' : i === currentIdx ? 'round-dot current' : 'round-dot';
    dots.push(`<span class="${cls}"></span>`);
  }
  roundStepDots.innerHTML = dots.join('');
}

function renderFootballerCard(player) {
  if (!player) return;

  playerAgeBadge.textContent = `${player.age} YAŞ`;
  playerPositionText.textContent = (player.position || 'Futbolcu').toUpperCase();
  playerNameHeading.textContent = player.name;
  playerClubName.textContent = player.club;
  playerCountryName.textContent = player.country;

  // Fotoğraf yükleme (kayma ve bozulma önleyici)
  playerPortraitFallback.hidden = true;
  playerPortraitImg.hidden = false;
  playerPortraitImg.style.objectPosition = player.objectPosition || '50% 8%';
  playerPortraitImg.alt = `${player.name} fotoğrafı`;
  playerPortraitImg.onerror = () => {
    playerPortraitImg.hidden = true;
    playerPortraitFallback.hidden = false;
    playerFallbackInitials.textContent = getInitials(player.name);
  };
  playerPortraitImg.src = player.photoUrl;

  // Kulüp logosu
  if (player.clubLogo) {
    playerClubLogo.hidden = false;
    playerClubLogo.src = player.clubLogo;
    playerClubLogo.alt = `${player.club} logosu`;
  } else {
    playerClubLogo.hidden = true;
  }

  // Ülke bayrağı
  if (player.flagUrl) {
    playerCountryFlag.hidden = false;
    playerCountryEmoji.hidden = true;
    playerCountryFlag.src = player.flagUrl;
    playerCountryFlag.alt = `${player.country} bayrağı`;
  } else {
    playerCountryFlag.hidden = true;
    playerCountryEmoji.hidden = false;
  }
}

function renderLiveScoreboard(room, roundIdx) {
  const playersArr = Object.values(room.players || {});
  const roundGuesses = room.guesses?.[roundIdx] || {};
  const now = Date.now();

  sidebarPlayerCountBadge.textContent = `${playersArr.length}/6 Oyuncu`;

  const sorted = [...playersArr].sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));

  liveScoreboardList.innerHTML = sorted
    .map((p, idx) => {
      const rank = idx + 1;
      const rankClass = rank <= 3 ? `rank-${rank}` : '';
      const isMe = p.id === roomClient.clientId;
      const sub = roundGuesses[p.id];
      const hasLocked = Boolean(sub && (!p.isBot || sub.lockedAt <= now || room.status === 'reveal'));

      const statusText = room.status === 'reveal'
        ? (sub ? `Tahmin: ${formatMarketValue(sub.guess)}` : 'Süre Doldu')
        : (hasLocked ? 'Kilitledi ✓' : 'Düşünüyor...');

      const statusClass = hasLocked ? 'locked' : 'thinking';
      const delta = p.lastRoundDelta || 0;

      return `
        <div class="sb-player-card ${isMe ? 'is-me' : ''}">
          <div class="sb-left">
            <div class="sb-rank ${rankClass}">${rank}</div>
            <div class="sb-avatar" style="background:${p.color || '#3b82f6'}">${p.avatar || getInitials(p.name)}</div>
            <div class="sb-user-col">
              <div class="sb-name">${escapeHtml(p.name)} ${isMe ? '(Sen)' : ''}</div>
              <div class="sb-status ${statusClass}">${statusText}</div>
            </div>
          </div>
          <div class="sb-right">
            <div class="sb-total-pts">${(p.totalScore || 0).toLocaleString('tr-TR')}</div>
            ${delta > 0 ? `<div class="sb-delta">+${delta} Puan</div>` : '<div class="sb-delta" style="color:#64748b;">0 Puan</div>'}
          </div>
        </div>
      `;
    })
    .join('');
}

function checkIfAllPlayersLocked(room, footballer) {
  if (room.status !== 'playing') return;
  const roundIdx = room.currentRound || 0;
  const playersArr = Object.values(room.players || {});
  const roundGuesses = room.guesses?.[roundIdx] || {};

  // İnsan oyuncuların tamamı tahminini kilitlediyse hemen sonuçları göster
  const humans = playersArr.filter((p) => !p.isBot);
  const allHumansLocked = humans.length > 0 && humans.every((h) => Boolean(roundGuesses[h.id]));

  if (allHumansLocked) {
    triggerRoundEvaluation(room, footballer);
  }
}

function triggerRoundEvaluation(room, footballer) {
  if (!room || room.status !== 'playing' || !footballer) return;
  const roundIdx = room.currentRound || 0;
  const playersArr = Object.values(room.players || {});
  const roundGuesses = room.guesses?.[roundIdx] || {};

  const submissions = playersArr.map((p) => {
    const g = roundGuesses[p.id];
    return {
      playerId: p.id,
      name: p.name,
      guess: g ? g.guess : null,
      lockedAt: g ? g.lockedAt : Infinity
    };
  });

  const roundScores = calculateRoundScores(submissions, footballer.marketValue);
  roomClient.revealRoundResults(roundScores);
}

function renderRoundReveal(room, roundIdx, footballer) {
  if (!footballer) return;
  const roundScores = room.roundHistory?.[roundIdx] || [];
  revealActualValue.textContent = formatMarketValue(footballer.marketValue, true);

  const myResult = roundScores.find((r) => r.playerId === roomClient.clientId);
  const myPts = myResult ? myResult.totalRoundPoints : 0;
  revealMyPoints.textContent = `+${myPts} Puan`;

  // Puan kırılım rozetleri
  const pills = [];
  if (myResult && myResult.guess !== null) {
    const errPct = (myResult.relativeError * 100).toFixed(1);
    pills.push(`<span class="breakdown-pill">Tahminin: <strong>${formatMarketValue(myResult.guess, true)}</strong> (%${errPct} Sapma)</span>`);
    pills.push(`<span class="breakdown-pill">İsabet Puanı: <strong class="emerald-txt">+${myResult.accuracyPoints}</strong></span>`);
    if (myResult.rankBonus > 0) {
      pills.push(`<span class="breakdown-pill">${myResult.rank}. Sıra Bonusu: <strong class="amber-txt">+${myResult.rankBonus}</strong></span>`);
    }
    if (myResult.bullseyeBonus > 0) {
      pills.push(`<span class="breakdown-pill">🎯 Kâhin Bonusu: <strong class="purple-txt">+${myResult.bullseyeBonus}</strong></span>`);
    }
  } else {
    pills.push('<span class="breakdown-pill">Bu turda tahmin kilitlenmedi (0 Puan)</span>');
  }
  revealBreakdownRow.innerHTML = pills.join('');

  revealPlayersList.innerHTML = roundScores
    .map((item, idx) => {
      const guessTxt = item.guess !== null ? formatMarketValue(item.guess, true) : 'Tahmin Yok';
      const errTxt = item.guess !== null ? `%${(item.relativeError * 100).toFixed(1)} fark` : '-';
      return `
        <div class="reveal-row">
          <div>
            <strong>#${idx + 1} ${escapeHtml(item.name)}</strong>
            <span style="color:#94a3b8;margin-left:8px;">${guessTxt} (${errTxt})</span>
          </div>
          <strong class="emerald-txt">+${item.totalRoundPoints} Puan</strong>
        </div>
      `;
    })
    .join('');

  const totalQ = room.settings?.questionCount || 10;
  const isLastQuestion = roundIdx + 1 >= totalQ;
  nextRoundBtnLabel.textContent = isLastQuestion ? '🏆 FİNAL PODYUMUNU GÖR ➔' : 'SONRAKİ FUTBOLCU ➔';
}

function renderPodium(room) {
  const playersArr = Object.values(room.players || {}).sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));
  const winner = playersArr[0];
  if (winner) {
    podiumWinnerSubtitle.textContent = `🏆 ${winner.name}, toplam ${winner.totalScore.toLocaleString('tr-TR')} puanla Piyasa Değeri Arenası şampiyonu oldu!`;
  }

  const medals = ['🥇', '🥈', '🥉'];
  const top3 = playersArr.slice(0, 3);
  podiumTopThree.innerHTML = top3
    .map((p, idx) => `
      <div class="podium-box place-${idx + 1}">
        <div class="podium-medal">${medals[idx] || '🏅'}</div>
        <div class="waiting-avatar" style="background:${p.color || '#10b981'};width:48px;height:48px;font-size:1rem;">
          ${p.avatar || getInitials(p.name)}
        </div>
        <div class="podium-name">${escapeHtml(p.name)}</div>
        <div class="podium-score">${(p.totalScore || 0).toLocaleString('tr-TR')} Puan</div>
      </div>
    `)
    .join('');

  podiumFullList.innerHTML = playersArr
    .map((p, idx) => `
      <div class="reveal-row">
        <div>
          <strong>#${idx + 1} ${escapeHtml(p.name)}</strong>
        </div>
        <strong class="emerald-txt">${(p.totalScore || 0).toLocaleString('tr-TR')} Puan</strong>
      </div>
    `)
    .join('');
}

// ==================== SÜRE SAYACI ====================
function startOrSyncCountdown(room, footballer) {
  stopRoundCountdown();
  const durationSec = room.settings?.roundDurationSec || 15;
  const startedAt = room.roundStartedAt || Date.now();

  const tick = () => {
    const elapsedSec = (Date.now() - startedAt) / 1000;
    const remaining = Math.max(0, durationSec - elapsedSec);
    const wholeSec = Math.ceil(remaining);

    timerText.textContent = `00:${String(wholeSec).padStart(2, '0')}`;
    const pct = Math.max(0, Math.min(100, (remaining / durationSec) * 100));
    timerProgressBar.style.width = `${pct}%`;

    if (wholeSec <= 5) {
      timerBox.classList.add('urgent');
    } else {
      timerBox.classList.remove('urgent');
    }

    // Botların kilitlenme durumunu canlı tabloya yansıt
    renderLiveScoreboard(room, room.currentRound || 0);

    if (remaining <= 0) {
      stopRoundCountdown();
      triggerRoundEvaluation(room, footballer);
    }
  };

  tick();
  countdownInterval = setInterval(tick, 250);
}

function stopRoundCountdown() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ==================== EVENT LISTENERS ====================
function initEvents() {
  const savedName = getSavedPlayerName();
  if (savedName && playerNameInput) {
    playerNameInput.value = savedName;
  }

  roomClient.onStateChange = handleRoomStateUpdate;

  // Soru sayısı seçimi (10 / 20)
  document.querySelectorAll('[data-qcount]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-qcount]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      selectedQuestionCount = Number(btn.dataset.qcount) || 10;
    });
  });

  // Süre seçimi (10 / 15 / 20 / 25 sn)
  document.querySelectorAll('[data-timer]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-timer]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      selectedTimerSec = Number(btn.dataset.timer) || 15;
    });
  });

  // Yeni 4 haneli oda oluştur
  createRoomBtn?.addEventListener('click', async () => {
    showLobbyError('');
    const hostName = playerNameInput?.value.trim() || 'Scout_10';
    const deckIds = buildNewDeck(selectedQuestionCount);
    await roomClient.createRoom({
      hostName,
      questionCount: selectedQuestionCount,
      roundDurationSec: selectedTimerSec,
      deckIds,
      withBots: 0
    });
  });

  // Hızlı Bot Maçı (3 Bot Rakiple Hemen Başla)
  quickBotMatchBtn?.addEventListener('click', async () => {
    showLobbyError('');
    const hostName = playerNameInput?.value.trim() || 'Scout_10';
    const deckIds = buildNewDeck(selectedQuestionCount);
    await roomClient.createRoom({
      hostName,
      questionCount: selectedQuestionCount,
      roundDurationSec: selectedTimerSec,
      deckIds,
      withBots: 3
    });
    await roomClient.startGame(deckIds, getPlayerById);
  });

  // 4 haneli odaya katıl
  joinRoomBtn?.addEventListener('click', async () => {
    showLobbyError('');
    const code = roomCodeInput?.value.trim() || '';
    if (!isValidRoomCode(code)) {
      showLobbyError('Lütfen 4 haneli sayısal oda kodunu girin (Örn: 4819).');
      return;
    }
    const playerName = playerNameInput?.value.trim() || 'Oyuncu';
    try {
      await roomClient.joinRoom({ roomCode: code, playerName });
    } catch (err) {
      showLobbyError(err.message || 'Odaya katılırken bir hata oluştu.');
    }
  });

  roomCodeInput?.addEventListener('input', () => {
    roomCodeInput.value = roomCodeInput.value.replace(/\D/g, '').slice(0, 4);
  });

  copyRoomCodeBtn?.addEventListener('click', async () => {
    const code = waitingRoomCodeDisplay?.textContent || '';
    try {
      await navigator.clipboard.writeText(code);
      copyRoomCodeBtn.textContent = '✓ Kopyalandı!';
      setTimeout(() => {
        copyRoomCodeBtn.textContent = '📋 Kodu Kopyala';
      }, 1800);
    } catch {
      // ignore
    }
  });

  addBotBtn?.addEventListener('click', async () => {
    await roomClient.addBotToRoom();
  });

  leaveLobbyRoomBtn?.addEventListener('click', () => {
    roomClient.leaveRoom();
    waitingRoomPanel.hidden = true;
    lobbyActionsGrid.hidden = false;
  });

  startMatchBtn?.addEventListener('click', async () => {
    const state = roomClient.localRoomState;
    if (!state) return;
    // Eğer odada tek kişi varsa otomatik 2 bot ekle ki yarış heyecanlı olsun
    const playerCount = Object.keys(state.players || {}).length;
    if (playerCount < 2) {
      await roomClient.addBotToRoom();
      await roomClient.addBotToRoom();
    }
    const qCount = state.settings?.questionCount || 10;
    const deckIds = state.deckIds?.length === qCount ? state.deckIds : buildNewDeck(qCount);
    await roomClient.startGame(deckIds, getPlayerById);
  });

  exitGameBtn?.addEventListener('click', () => {
    stopRoundCountdown();
    roomClient.leaveRoom();
    gameScreen.hidden = true;
    podiumScreen.hidden = true;
    lobbyScreen.hidden = false;
    waitingRoomPanel.hidden = true;
    lobbyActionsGrid.hidden = false;
  });

  // Slider & Hızlı Butonlar
  marketValueSlider?.addEventListener('input', () => {
    if (isMyGuessLocked) return;
    setGuessValue(Number(marketValueSlider.value));
  });

  document.querySelectorAll('.quick-step-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (isMyGuessLocked) return;
      const step = Number(btn.dataset.step) || 0;
      setGuessValue(currentGuessEuro + step);
    });
  });

  // Tahmini Kilitle
  lockGuessBtn?.addEventListener('click', async () => {
    if (isMyGuessLocked) return;
    isMyGuessLocked = true;
    marketValueSlider.disabled = true;
    lockGuessBtn.disabled = true;
    lockGuessBtn.querySelector('span').textContent = '✓ TAHMİN KİLİTLENDİ';
    lockedStatusNote.hidden = false;
    await roomClient.submitGuess(currentGuessEuro);
  });

  // Sonraki Futbolcu
  nextRoundBtn?.addEventListener('click', async () => {
    await roomClient.nextRound(getPlayerById);
  });

  // Tekrar Oyna (Aynı odayla, tekrarsız yeni sorularla)
  playAgainBtn?.addEventListener('click', async () => {
    const state = roomClient.localRoomState;
    if (!state) return;
    const qCount = state.settings?.questionCount || 10;
    const freshDeck = buildNewDeck(qCount);
    await roomClient.startGame(freshDeck, getPlayerById);
  });

  backToLobbyBtn?.addEventListener('click', () => {
    stopRoundCountdown();
    roomClient.leaveRoom();
    podiumScreen.hidden = true;
    gameScreen.hidden = true;
    lobbyScreen.hidden = false;
    waitingRoomPanel.hidden = true;
    lobbyActionsGrid.hidden = false;
  });
}

initEvents();
