import { SECTIONS, buildUrl, parseInput, sectionById } from './lib/commands.js';
import { search } from './lib/search.js';
import { load, recordVisit } from './lib/store.js';
import { openUrl } from './lib/navigate.js';
import { DEFAULT_SHORTCUT, matches } from './lib/shortcut.js';

// ?overlay=1: running in an iframe the content script put over a web page.
const OVERLAY = new URLSearchParams(location.search).has('overlay');
if (OVERLAY) document.documentElement.classList.add('overlay');
let shortcut = DEFAULT_SHORTCUT;

function closePalette() {
  if (OVERLAY) parent.postMessage({ type: 'repo-jump:close' }, '*');
  else window.close();
}

const $ = (id) => document.getElementById(id);
const q = $('q');
const list = $('results');
const empty = $('empty');
const status = $('status');
const sectionsEl = $('sections');

const state = { repos: [], visits: {}, results: [], sel: 0, section: 'code', sectionLocked: false, syncedAt: 0, syncError: '' };

function ago(ts) {
  if (!ts) return 'never synced';
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return 'synced just now';
  if (m < 60) return `synced ${m}m ago`;
  return `synced ${Math.round(m / 60)}h ago`;
}

function renderSections(active) {
  sectionsEl.replaceChildren(
    ...SECTIONS.map((s) => {
      const el = document.createElement('span');
      el.textContent = s.label;
      el.dataset.section = s.id;
      if (s.id === active) el.className = 'on';
      return el;
    }),
  );
}

function target() {
  const parsed = parseInput(q.value);
  return { parsed, section: parsed.section ?? state.section };
}

function render() {
  const { parsed, section } = target();
  renderSections(parsed.number != null || parsed.branch ? null : section);
  state.results = search(parsed.query, state.repos, { visits: state.visits, limit: 50 });
  state.sel = Math.min(state.sel, Math.max(0, state.results.length - 1));
  list.replaceChildren(
    ...state.results.map((repo, i) => {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.dataset.fullName = repo.full_name;
      if (i === state.sel) li.className = 'sel';
      const name = document.createElement('div');
      name.className = 'name';
      const owner = document.createElement('span');
      owner.className = 'owner';
      owner.textContent = `${repo.owner}/`;
      name.append(owner, repo.name);
      for (const [flag, label] of [[repo.private, 'private'], [repo.fork, 'fork'], [repo.archived, 'archived']]) {
        if (!flag) continue;
        const b = document.createElement('span');
        b.className = 'badge';
        b.textContent = label;
        name.append(b);
      }
      li.append(name);
      if (repo.description) {
        const d = document.createElement('div');
        d.className = 'desc';
        d.textContent = repo.description;
        li.append(d);
      }
      li.addEventListener('mousedown', (e) => {
        e.preventDefault();
        state.sel = i;
        go(e.metaKey || e.ctrlKey ? 'newForegroundTab' : 'currentTab');
      });
      return li;
    }),
  );
  list.querySelector('.sel')?.scrollIntoView({ block: 'nearest' });

  if (!state.results.length) {
    empty.hidden = false;
    empty.textContent = state.repos.length
      ? 'No matching repos.'
      : state.syncError
        ? `Couldn't load repos: ${state.syncError}`
        : 'Loading your repos from GitHub…';
  } else {
    empty.hidden = true;
  }
}

async function go(disposition) {
  const repo = state.results[state.sel];
  if (!repo) return;
  const { parsed, section } = target();
  const url = buildUrl(repo.full_name, { ...parsed, section });
  if (OVERLAY) {
    // Let the page navigate itself: browsers like Cra don't expose their tabs
    // to chrome.tabs, so tabs.update/create silently do nothing there.
    await recordVisit(repo.full_name);
    parent.postMessage({ type: 'repo-jump:open', url, newTab: disposition !== 'currentTab' }, '*');
    return;
  }
  await openUrl(url, { fullName: repo.full_name, disposition });
  // In the action popup getCurrent() is undefined; when popup.html is open as
  // a tab (e.g. in tests) the tab itself was navigated, so don't close it.
  if (!(await chrome.tabs.getCurrent())) window.close();
}

function cycleSection(dir) {
  const ids = SECTIONS.map((s) => s.id);
  const { section } = target();
  // Typed suffix wins; strip it so Tab can take over.
  const parsed = parseInput(q.value);
  if (parsed.section) {
    q.value = q.value.replace(/\s+\S+\s*$/, '');
  }
  state.section = ids[(ids.indexOf(section) + dir + ids.length) % ids.length];
  render();
}

async function refresh() {
  status.textContent = 'syncing…';
  const res = await chrome.runtime.sendMessage({ type: 'sync' });
  await loadState();
  if (!res?.ok) status.textContent = `sync failed: ${res?.error ?? 'unknown'}`;
}

async function loadState() {
  const s = await load();
  state.repos = s.repos;
  state.visits = s.visits;
  shortcut = (await chrome.storage.local.get('paletteShortcut')).paletteShortcut ?? DEFAULT_SHORTCUT;
  state.syncedAt = s.syncedAt;
  state.syncError = s.syncError;
  if (!state.sectionLocked) state.section = sectionById(s.defaultSection).id;
  status.textContent = s.syncError ? `sync error: ${s.syncError}` : `${s.repos.length} repos · ${ago(s.syncedAt)}`;
  render();
  return s;
}

q.addEventListener('input', () => {
  state.sel = 0;
  render();
});

document.addEventListener('keydown', (e) => {
  const n = state.results.length;
  if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'n')) {
    e.preventDefault();
    if (n) state.sel = (state.sel + 1) % n;
    render();
  } else if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'p')) {
    e.preventDefault();
    if (n) state.sel = (state.sel - 1 + n) % n;
    render();
  } else if (e.key === 'Tab') {
    e.preventDefault();
    state.sectionLocked = true;
    cycleSection(e.shiftKey ? -1 : 1);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    go(e.metaKey || e.ctrlKey ? 'newForegroundTab' : e.shiftKey ? 'newBackgroundTab' : 'currentTab');
  } else if (e.key === 'Escape' || matches(e, shortcut)) {
    e.preventDefault();
    closePalette();
  } else if (e.altKey && e.code === 'KeyR') {
    e.preventDefault();
    refresh();
  }
});

chrome.storage.onChanged.addListener((_c, area) => {
  if (area === 'local') loadState();
});

loadState().then((s) => {
  if (!s.syncedAt && !s.syncError) refresh();
});
q.focus();
window.addEventListener('focus', () => q.focus());
