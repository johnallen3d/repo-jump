import { SECTIONS } from './lib/commands.js';
import { load, save } from './lib/store.js';
import { DEFAULT_SHORTCUT, fromEvent, label } from './lib/shortcut.js';

const $ = (id) => document.getElementById(id);

for (const s of SECTIONS) $('section').append(new Option(s.label, s.id));

async function showStatus() {
  const { repos, accounts, syncedAt, syncError } = await load(['repos', 'accounts', 'syncedAt', 'syncError']);
  $('accounts').textContent = accounts.length ? accounts.join(', ') : 'none yet';
  $('status').textContent = syncError
    ? `Sync error: ${syncError}`
    : syncedAt
      ? `${repos.length} repos cached, last sync ${new Date(syncedAt).toLocaleString()}`
      : 'Not synced yet.';
}

async function sync() {
  $('status').textContent = 'Syncing…';
  await chrome.runtime.sendMessage({ type: 'sync' });
  showStatus();
}

$('shortcut').addEventListener('keydown', async (e) => {
  if (['Tab', 'Escape'].includes(e.key)) return;
  e.preventDefault();
  if (/^(Meta|Alt|Control|Shift)/.test(e.code)) return; // wait for the real key
  const s = fromEvent(e);
  if (!s.meta && !s.ctrl && !s.alt) return; // require a modifier
  await chrome.storage.local.set({ paletteShortcut: s });
  $('shortcut').value = label(s);
});

async function init() {
  const { defaultSection, syncedAt } = await load(['defaultSection', 'syncedAt']);
  const { paletteShortcut } = await chrome.storage.local.get('paletteShortcut');
  $('shortcut').value = label(paletteShortcut ?? DEFAULT_SHORTCUT);
  $('section').value = defaultSection;
  await showStatus();
  if (!syncedAt) sync();
}

$('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  await save({ defaultSection: $('section').value });
  $('status').textContent = 'Saved.';
});
$('section').addEventListener('change', () => save({ defaultSection: $('section').value }));
$('refresh').addEventListener('click', sync);
$('clear').addEventListener('click', async () => {
  await save({ repos: [], accounts: [], syncedAt: 0, syncError: '', visits: {} });
  showStatus();
});

chrome.storage.onChanged.addListener(() => showStatus());
init();
