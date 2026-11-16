// Opens the Repo Jump palette as an overlay on any web page, from a keyboard
// shortcut. Needed in browsers (like Cra) that don't route extension commands.
(() => {
  const isMac = /Mac/.test(navigator.platform);
  let shortcut = isMac
    ? { code: 'KeyK', meta: true, alt: true, ctrl: false, shift: false }
    : { code: 'KeyK', meta: false, alt: true, ctrl: true, shift: false };
  const ORIGIN = new URL(chrome.runtime.getURL('')).origin;
  let host = null;

  chrome.storage.local.get('paletteShortcut').then(({ paletteShortcut }) => {
    if (paletteShortcut) shortcut = paletteShortcut;
  });
  chrome.storage.onChanged.addListener((c, area) => {
    if (area === 'local' && c.paletteShortcut?.newValue) shortcut = c.paletteShortcut.newValue;
  });

  const hit = (e) =>
    e.code === shortcut.code && e.metaKey === shortcut.meta && e.altKey === shortcut.alt && e.ctrlKey === shortcut.ctrl && e.shiftKey === shortcut.shift;

  function close() {
    host?.remove();
    host = null;
  }

  function open() {
    if (host) return;
    host = document.createElement('repo-jump-overlay');
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>
      .backdrop { position: fixed; inset: 0; z-index: 2147483647; background: rgba(0,0,0,.25); display: flex; justify-content: center; align-items: flex-start; }
      iframe { margin-top: 12vh; width: 560px; height: 470px; border: 0; border-radius: 10px; box-shadow: 0 12px 40px rgba(0,0,0,.35); color-scheme: normal; }
    </style><div class="backdrop"><iframe allow="" src="${chrome.runtime.getURL('popup.html?overlay=1')}"></iframe></div>`;
    const frame = root.querySelector('iframe');
    root.querySelector('.backdrop').addEventListener('mousedown', (e) => {
      if (e.target !== frame) close();
    });
    frame.addEventListener('load', () => frame.focus());
    (document.body ?? document.documentElement).append(host);
  }

  window.addEventListener(
    'keydown',
    (e) => {
      if (!hit(e)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      host ? close() : open();
    },
    true,
  );

  window.addEventListener('message', (e) => {
    if (e.origin !== ORIGIN) return;
    if (e.data?.type === 'repo-jump:close') close();
    if (e.data?.type === 'repo-jump:open' && /^https:\/\/github\.com\//.test(e.data.url)) {
      close();
      if (e.data.newTab) window.open(e.data.url, '_blank', 'noopener');
      else location.assign(e.data.url);
    }
  });
})();
