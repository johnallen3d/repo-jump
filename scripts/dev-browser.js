// Opens Chromium with the unpacked extension, a persistent dev profile, and
// the gh native-messaging host pointed at your real `gh`. Usage: mise run dev
// CHECK=1 runs headless, waits for the first sync, prints a summary, exits.
import { chromium } from '@playwright/test';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { installHost } from './install-host.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ext = path.join(root, 'extension');
const profile = path.join(root, '.dev-profile');
const check = !!process.env.CHECK;

installHost({ dir: profile, gh: execFileSync('/bin/sh', ['-c', 'command -v gh']).toString().trim() });

const context = await chromium.launchPersistentContext(profile, {
  channel: 'chromium',
  headless: check,
  viewport: null,
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
});
let [sw] = context.serviceWorkers();
sw ??= await context.waitForEvent('serviceworker');
const id = new URL(sw.url()).host;

if (check) {
  const res = await sw.evaluate(() => globalThis.__repoJump.syncRepos());
  console.log(res.ok ? `sync ok: ${res.count} repos from ${res.accounts.length} gh account(s)` : `sync failed: ${res.error}`);
  await context.close();
  process.exit(res.ok ? 0 : 1);
}

const page = context.pages()[0] ?? (await context.newPage());
await page.goto(`chrome-extension://${id}/popup.html`);
console.log(`Repo Jump loaded (id ${id}). Type "gh " in the address bar or press ⌘⇧K. Close the window to exit.`);
await new Promise((r) => context.on('close', r));
