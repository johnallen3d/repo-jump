// chrome.storage.local wrappers. Only repo metadata and visit counts are
// stored; GitHub tokens are fetched from `gh` per sync and never saved.

const DEFAULTS = {
  accounts: [],
  defaultSection: 'code',
  repos: [],
  syncedAt: 0,
  syncError: '',
  visits: {},
};

export async function load(keys = Object.keys(DEFAULTS)) {
  const got = await chrome.storage.local.get(keys);
  return Object.fromEntries(keys.map((k) => [k, got[k] ?? DEFAULTS[k]]));
}

export function save(values) {
  return chrome.storage.local.set(values);
}

export async function recordVisit(fullName, now = Date.now()) {
  const { visits } = await load(['visits']);
  const v = visits[fullName] ?? { count: 0, last: 0 };
  visits[fullName] = { count: v.count + 1, last: now };
  await save({ visits });
}
