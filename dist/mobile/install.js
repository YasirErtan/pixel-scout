const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const button = document.querySelector('#app-install');
const help = document.querySelector('#app-install-help');
let installPrompt;

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register(new URL('../sw.js', import.meta.url)).catch(console.warn);
}

if (button && !standalone) {
  button.hidden = false;
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
  });
  button.addEventListener('click', async () => {
    if (!installPrompt) {
      help.hidden = !help.hidden;
      button.setAttribute('aria-expanded', String(!help.hidden));
      return;
    }
    const prompt = installPrompt;
    installPrompt = null;
    await prompt.prompt();
  });
  window.addEventListener('appinstalled', () => {
    help.hidden = true;
    button.hidden = true;
  });
}
