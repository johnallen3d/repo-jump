// Launches Chromium with the unpacked extension, the real gh native-messaging
// host wired to a fake `gh`, and a mocked GitHub API — so the whole flow runs
// with no clicking, no real tokens, and no network.
import { test as base, chromium, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPOS } from '../fixtures.js';
import { installHost } from '../../scripts/install-host.js';

const EXT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../extension');

// Token -> repos the mocked API returns for it. Overlap tests the merge.
export const API_REPOS = {
  'personal-token': REPOS.slice(0, 4),
  'work-token': REPOS.slice(2),
};

// A stand-in for the gh CLI answering the two commands the host runs.
function writeFakeGh(dir, accounts) {
  const status = JSON.stringify({
    hosts: { 'github.com': accounts.map((a, i) => ({ state: 'success', active: i === 0, host: 'github.com', login: a.login })) },
  });
  const cases = accounts.map((a) => `  *"--user ${a.login}") echo "${a.token}" ;;`).join('\n');
  const gh = path.join(dir, 'fake-gh');
  fs.writeFileSync(
    gh,
    `#!/bin/sh
case "$*" in
  "auth status --json hosts") ${accounts.length ? `echo '${status}'` : 'echo "not logged in" >&2; exit 1'} ;;
${cases}
  *) exit 1 ;;
esac
`,
    { mode: 0o755 },
  );
  return gh;
}

export async function mockGitHub(context, calls = []) {
  await context.route('https://api.github.com/**', (route) => {
    const req = route.request();
    const token = (req.headers()['authorization'] ?? '').replace('Bearer ', '');
    calls.push({ url: req.url(), token });
    const repos = API_REPOS[token];
    if (!repos) return route.fulfill({ status: 401, body: '{"message":"Bad credentials"}' });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(repos) });
  });
  // Any github.com navigation lands on a stub page so we can assert the URL.
  await context.route('https://github.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<title>stub</title>github stub' }),
  );
  return calls;
}

export const test = base.extend({
  ghAccounts: [
    [
      { login: 'jallen', token: 'personal-token' },
      { login: 'jallen-work', token: 'work-token' },
    ],
    { option: true },
  ],
  installGhHost: [true, { option: true }],
  calls: async ({}, use) => use([]),
  context: async ({ ghAccounts, installGhHost, calls }, use) => {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-jump-'));
    if (installGhHost) installHost({ dir: profile, gh: writeFakeGh(profile, ghAccounts) });
    const context = await chromium.launchPersistentContext(profile, {
      channel: 'chromium',
      headless: !process.env.HEADED,
      args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
    });
    await mockGitHub(context, calls);
    await use(context);
    await context.close();
    fs.rmSync(profile, { recursive: true, force: true });
  },
  worker: async ({ context }, use) => {
    let [sw] = context.serviceWorkers();
    sw ??= await context.waitForEvent('serviceworker');
    await use(sw);
  },
  extensionId: async ({ worker }, use) => {
    await use(new URL(worker.url()).host);
  },
  // Waits for the install-time background sync to land.
  synced: async ({ worker, calls }, use) => {
    await expect
      .poll(() => worker.evaluate(async () => (await chrome.storage.local.get('syncedAt')).syncedAt ?? 0))
      .toBeGreaterThan(0);
    await use({ calls });
  },
  popup: async ({ context, extensionId }, use) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await use(page);
  },
});

export { expect };

// Tabs the extension creates aren't covered by context.route on their first
// navigation, so record chrome.tabs.create calls and open about:blank instead
// (keeps tests off the real network).
export async function spyTabCreate(worker) {
  await worker.evaluate(() => {
    globalThis.__created = [];
    const orig = chrome.tabs.create.bind(chrome.tabs);
    chrome.tabs.create = (opts) => {
      globalThis.__created.push(opts);
      return orig({ ...opts, url: 'about:blank' });
    };
  });
  return () => worker.evaluate(() => globalThis.__created);
}
