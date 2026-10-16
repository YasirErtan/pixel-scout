// Add your rules in this folder. Keep storage separate from other games.
export const STORAGE_KEY = 'pixel-scout:__GAME_SLUG__:v1';
document.getElementById('start').addEventListener('click', () => {
  document.getElementById('status').textContent = 'Şablon hazır. Şimdi kendi oyun mantığını ekle.';
});
