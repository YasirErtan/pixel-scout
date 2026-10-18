import { CLUBS, formatMarketValue, formatFullCurrency } from './clubs.js';

// DOM Elemanları
const elCurrentScore = document.getElementById('current-score');
const elBestScore = document.getElementById('best-score');

// Sol Panel Elemanları (Açık Olan Kulüp)
const elLeftSide = document.getElementById('left-side');
const elLeftWatermark = document.getElementById('left-watermark');
const elLeftBgGlow = document.getElementById('left-bg-glow');
const elLeftLogo = document.getElementById('left-logo');
const elLeftName = document.getElementById('left-name');
const elLeftLeague = document.getElementById('left-league');
const elLeftValue = document.getElementById('left-value');
const elLeftFullValue = document.getElementById('left-full-value');

// Sağ Panel Elemanları (Tahmin Edilecek Kulüp)
const elRightSide = document.getElementById('right-side');
const elRightWatermark = document.getElementById('right-watermark');
const elRightBgGlow = document.getElementById('right-bg-glow');
const elRightLogo = document.getElementById('right-logo');
const elRightName = document.getElementById('right-name');
const elRightLeague = document.getElementById('right-league');
const elRightValueBox = document.getElementById('right-value-box');
const elRightValue = document.getElementById('right-value');
const elRightFullValue = document.getElementById('right-full-value');
const elActionButtonsBox = document.getElementById('action-buttons-box');
const elHigherBtn = document.getElementById('higher-btn');
const elLowerBtn = document.getElementById('lower-btn');
const elComparisonCaption = document.getElementById('comparison-caption');

// Geri Bildirim ve Modal Elemanları
const elFeedbackBadge = document.getElementById('feedback-badge');
const elFeedbackIcon = document.getElementById('feedback-icon');
const elGameOverDialog = document.getElementById('game-over-dialog');
const elGameOverReason = document.getElementById('game-over-reason');
const elFinalScore = document.getElementById('final-score');
const elModalBestScore = document.getElementById('modal-best-score');
const elModalComparison = document.getElementById('modal-comparison');
const elRestartBtn = document.getElementById('restart-btn');

// Oyun Durumu
const STORAGE_KEY = 'pixel-scout:piyasa-degeri:best';
let score = 0;
let bestScore = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
if (Number.isNaN(bestScore)) bestScore = 0;

let currentClubA = null;
let currentClubB = null;
let sessionBag = [];
let isTransitioning = false;

// Fisher-Yates Karıştırma
function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Kulüp Çantası (Tekrar etmeden seçim)
function replenishBag(excludeId = null) {
  let clubs = CLUBS.filter(c => c.id !== excludeId);
  sessionBag = shuffle(clubs);
}

function drawNextClub(excludeId = null) {
  if (sessionBag.length === 0) {
    replenishBag(excludeId);
  }
  const nextClub = sessionBag.pop();
  if (nextClub && nextClub.id === excludeId) {
    if (sessionBag.length === 0) replenishBag(excludeId);
    return sessionBag.pop() || CLUBS.find(c => c.id !== excludeId);
  }
  return nextClub;
}

// Kulüp Logosu Hazırlama (Sadece Logo)
function setupLogo(imgEl, club) {
  if (club && club.logo) {
    imgEl.src = club.logo;
    imgEl.alt = `${club.name} Logosu`;
    imgEl.style.display = 'block';
  } else {
    imgEl.style.display = 'none';
  }
}

// Sol Paneli Güncelle (Kulüp A)
function renderClubA(club) {
  currentClubA = club;
  elLeftName.textContent = club.name;
  elLeftLeague.textContent = `${club.flag} ${club.league}`;
  elLeftValue.textContent = formatMarketValue(club.marketValue);
  elLeftFullValue.textContent = formatFullCurrency(club.marketValue);

  // Takım Renklerinde Dinamik Arka Plan ve Atmosfer Tasarımı
  if (elLeftSide) {
    elLeftSide.style.background = `radial-gradient(circle at 50% 30%, ${club.color}35 0%, ${club.color}14 50%, #070d09 85%), linear-gradient(180deg, rgba(7, 13, 9, 0.25) 0%, rgba(7, 13, 9, 0.9) 100%)`;
  }
  if (elLeftWatermark) {
    elLeftWatermark.style.backgroundImage = `url("${club.logo}")`;
  }
  if (elLeftBgGlow) {
    elLeftBgGlow.style.background = `radial-gradient(circle at center, ${club.color}45 0%, transparent 68%)`;
  }
  if (elLeftLogo) {
    elLeftLogo.style.filter = `drop-shadow(0 16px 32px rgba(0, 0, 0, 0.8)) drop-shadow(0 0 45px ${club.color}66)`;
  }

  setupLogo(elLeftLogo, club);
}

// Sağ Paneli Güncelle (Kulüp B - Tahmin)
function renderClubB(club) {
  currentClubB = club;
  elRightName.textContent = club.name;
  elRightLeague.textContent = `${club.flag} ${club.league}`;
  
  // Takım Renklerinde Dinamik Arka Plan ve Atmosfer Tasarımı
  if (elRightSide) {
    elRightSide.style.background = `radial-gradient(circle at 50% 30%, ${club.color}35 0%, ${club.color}14 50%, #070d09 85%), linear-gradient(180deg, rgba(7, 13, 9, 0.25) 0%, rgba(7, 13, 9, 0.9) 100%)`;
  }
  if (elRightWatermark) {
    elRightWatermark.style.backgroundImage = `url("${club.logo}")`;
  }
  if (elRightBgGlow) {
    elRightBgGlow.style.background = `radial-gradient(circle at center, ${club.color}45 0%, transparent 68%)`;
  }
  if (elRightLogo) {
    elRightLogo.style.filter = `drop-shadow(0 16px 32px rgba(0, 0, 0, 0.8)) drop-shadow(0 0 45px ${club.color}66)`;
  }

  setupLogo(elRightLogo, club);

  const compName = currentClubA.shortName || currentClubA.name;
  elComparisonCaption.textContent = `${compName}'dan daha mı değerli?`;

  // Butonları aç, sayaç kutusunu gizle
  elActionButtonsBox.hidden = false;
  elHigherBtn.disabled = false;
  elLowerBtn.disabled = false;
  elRightValueBox.hidden = true;
  elRightValue.textContent = '€0 Milyon';
  elRightFullValue.textContent = '€0';
}

// HUD Skor Güncelleme
function updateHUD() {
  elCurrentScore.textContent = score;
  elBestScore.textContent = bestScore;
}

// Sayı Sayma / Count-Up Animasyonu
function animateValue(targetValue, durationMs = 700) {
  return new Promise(resolve => {
    const startTime = performance.now();
    const startVal = Math.max(0, Math.floor(targetValue * 0.15));

    function tick(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(startVal + (targetValue - startVal) * eased);

      elRightValue.textContent = formatMarketValue(current);
      elRightFullValue.textContent = formatFullCurrency(current);

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        elRightValue.textContent = formatMarketValue(targetValue);
        elRightFullValue.textContent = formatFullCurrency(targetValue);
        resolve();
      }
    }

    requestAnimationFrame(tick);
  });
}

// Tahmin İşleme
async function handleGuess(isHigher) {
  if (isTransitioning || !currentClubA || !currentClubB) return;
  isTransitioning = true;

  // Butonları devre dışı bırak
  elHigherBtn.disabled = true;
  elLowerBtn.disabled = true;
  elActionButtonsBox.hidden = true;
  elRightValueBox.hidden = false;

  // Değeri sayarak aç
  await animateValue(currentClubB.marketValue, 650);

  const valA = currentClubA.marketValue;
  const valB = currentClubB.marketValue;

  // Eşitlik durumunda iki tahmin de doğru kabul edilir
  const isCorrect = (valA === valB) || (isHigher ? valB >= valA : valB <= valA);

  // Geri Bildirim Rozeti Göster
  elFeedbackBadge.hidden = false;
  elFeedbackBadge.className = `feedback-badge ${isCorrect ? 'correct' : 'wrong'}`;
  elFeedbackIcon.textContent = isCorrect ? '✓' : '✕';

  if (isCorrect) {
    score++;
    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem(STORAGE_KEY, bestScore.toString());
    }
    updateHUD();

    // 1 saniye sonra bir sonraki tura geç
    setTimeout(() => {
      elFeedbackBadge.hidden = true;
      elFeedbackBadge.className = 'feedback-badge';

      // Sağdaki kulübü sola aktar ve yeni bir sağ kulüp çek
      const nextA = currentClubB;
      const nextB = drawNextClub(nextA.id);

      renderClubA(nextA);
      renderClubB(nextB);

      isTransitioning = false;
    }, 1100);
  } else {
    // Yanlış tahmin - Game Over
    setTimeout(() => {
      elFeedbackBadge.hidden = true;
      elFeedbackBadge.className = 'feedback-badge';
      showGameOver(isHigher);
      isTransitioning = false;
    }, 1200);
  }
}

// Oyun Bitti Ekranı
function showGameOver(guessedHigher) {
  elFinalScore.textContent = score;
  elModalBestScore.textContent = bestScore;

  const valA = currentClubA.marketValue;
  const valB = currentClubB.marketValue;
  const diff = Math.abs(valB - valA);

  const relation = valB > valA ? 'daha yüksek' : 'daha düşük';
  const guessedWord = guessedHigher ? 'daha yüksek' : 'daha düşük';

  elGameOverReason.textContent = `Yanıldın! Sen "${guessedWord}" dedin ancak ${currentClubB.name} (${formatMarketValue(valB)}), ${currentClubA.name}'dan (${formatMarketValue(valA)}) ${relation} bir değere sahipti.`;

  elModalComparison.innerHTML = `
    <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
      <span><strong>${currentClubA.name}:</strong> ${formatFullCurrency(valA)}</span>
      <span><strong>${currentClubB.name}:</strong> ${formatFullCurrency(valB)}</span>
    </div>
    <div style="color: var(--muted); font-size: 11px;">
      Fark: <strong>${formatMarketValue(diff)}</strong> (${formatFullCurrency(diff)})
    </div>
  `;

  if (elGameOverDialog.showModal) {
    elGameOverDialog.showModal();
  } else {
    elGameOverDialog.setAttribute('open', '');
  }
}

// Oyunu Yeniden Başlat
function restartGame() {
  if (elGameOverDialog.close) {
    elGameOverDialog.close();
  } else {
    elGameOverDialog.removeAttribute('open');
  }

  score = 0;
  updateHUD();

  replenishBag();
  const firstClub = drawNextClub();
  const secondClub = drawNextClub(firstClub.id);

  renderClubA(firstClub);
  renderClubB(secondClub);
  isTransitioning = false;
}

// Olay Dinleyicileri (Event Listeners)
elHigherBtn.addEventListener('click', () => handleGuess(true));
elLowerBtn.addEventListener('click', () => handleGuess(false));
elRestartBtn.addEventListener('click', restartGame);

// Klavye Kısayolları (Higher: Yukarı/W/H/Y, Lower: Aşağı/S/L/D, Yeniden Oyna: Boşluk/Enter)
window.addEventListener('keydown', (e) => {
  if (elGameOverDialog.open) {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      restartGame();
    }
    return;
  }

  if (isTransitioning) return;

  const key = e.key.toLowerCase();
  if (e.key === 'ArrowUp' || key === 'w' || key === 'h' || key === 'y') {
    e.preventDefault();
    handleGuess(true);
  } else if (e.key === 'ArrowDown' || key === 's' || key === 'l' || key === 'd') {
    e.preventDefault();
    handleGuess(false);
  }
});

// Başlatma
function init() {
  updateHUD();
  replenishBag();
  const firstClub = drawNextClub();
  const secondClub = drawNextClub(firstClub.id);
  renderClubA(firstClub);
  renderClubB(secondClub);
}

init();
