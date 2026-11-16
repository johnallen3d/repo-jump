import { buildUrl, parseInput, GITHUB } from './lib/commands.js';
import { search } from './lib/search.js';
import { load } from './lib/store.js';
import { syncRepos, STALE_MS } from './lib/sync.js';
import { openUrl } from './lib/navigate.js';

const ALARM = 'repo-refresh';

async function ensureAlarm() {
  if (!(await chrome.alarms.get(ALARM))) {
    chrome.alarms.create(ALARM, { periodInMinutes: 60 });
  }
}

async function syncIfStale() {
  const { syncedAt } = await load(['syncedAt']);
  if (Date.now() - syncedAt > STALE_MS) await syncRepos();
}

chrome.runtime.onInstalled.addListener(() => {
  ensureAlarm();
  syncIfStale();
});
chrome.runtime.onStartup.addListener(() => {
  ensureAlarm();
  syncIfStale();
});
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === ALARM) syncIfStale();
});

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg?.type === 'sync') {
    syncRepos().then(reply);
    return true;
  }
  return false;
});

// ---- Omnibox: type `gh <query> [section|#N|@branch]` ----

const escapeXml = (s) =>
  s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]);

export async function suggestionsFor(text, limit = 8) {
  const parsed = parseInput(text);
  const { repos, visits, defaultSection } = await load(['repos', 'visits', 'defaultSection']);
  const target = { ...parsed, section: parsed.section ?? defaultSection };
  return search(parsed.query, repos, { visits, limit }).map((repo) => {
    const url = buildUrl(repo.full_name, target);
    const desc = repo.description ? ` <dim>— ${escapeXml(repo.description.slice(0, 80))}</dim>` : '';
    return {
      content: url,
      description: `<match>${escapeXml(repo.full_name)}</match> <url>${escapeXml(url.replace(GITHUB, ''))}</url>${desc}`,
      repo,
    };
  });
}

export async function resolveEntered(text) {
  if (text.startsWith(`${GITHUB}/`)) {
    const fullName = text.slice(GITHUB.length + 1).split('/').slice(0, 2).join('/');
    return { url: text, fullName };
  }
  const [top] = await suggestionsFor(text, 1);
  if (top) return { url: top.content, fullName: top.repo.full_name };
  return { url: `${GITHUB}/search?type=repositories&q=${encodeURIComponent(text)}`, fullName: null };
}

chrome.omnibox.setDefaultSuggestion({ description: 'Jump to a repo — add <match>pulls</match>, <match>issues</match>, <match>#123</match>, or <match>@branch</match>' });

chrome.omnibox.onInputStarted.addListener(() => {
  syncIfStale();
});

chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
  const s = await suggestionsFor(text);
  suggest(s.map(({ content, description }) => ({ content, description })));
});

chrome.omnibox.onInputEntered.addListener(async (text, disposition) => {
  const { url, fullName } = await resolveEntered(text);
  await openUrl(url, { fullName, disposition });
});

// Exposed for automated tests (service worker evaluate).
globalThis.__repoJump = { suggestionsFor, resolveEntered, syncRepos, openUrl };
