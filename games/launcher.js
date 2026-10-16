async function loadGames() {
  try {
    const response = await fetch('./registry.json');
    if (!response.ok) throw new Error('Registry unavailable');
    const games = await response.json();
    const container = document.getElementById('games');
    for (const game of games) {
      const url = new URL(game.href, location.href);
      if (url.origin !== location.origin || !['http:', 'https:'].includes(url.protocol)) continue;
      const card = document.createElement('a');
      card.className = 'game';
      card.href = game.href;
      const title = document.createElement('h2');
      title.textContent = game.title;
      const description = document.createElement('p');
      description.textContent = game.description;
      const action = document.createElement('span');
      action.textContent = 'Oyna →';
      card.append(title, description, action);
      container.append(card);
    }
  } catch {
    document.getElementById('message').textContent = 'Oyun listesi yüklenemedi. Sayfayı yenileyebilirsin.';
  }
}
loadGames();
