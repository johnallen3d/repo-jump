import { test, expect, spyTabCreate } from './harness.js';
import { REPOS } from '../fixtures.js';

test('extension has the pinned id the gh host allows', async ({ extensionId }) => {
  expect(extensionId).toBe('mginlchbajjkclmddldllddifhidgiba');
});

test('sync merges repos from every gh account without storing tokens', async ({ synced, worker }) => {
  const tokens = new Set(synced.calls.map((c) => c.token));
  expect(tokens).toEqual(new Set(['personal-token', 'work-token']));
  expect(synced.calls[0].url).toContain('/user/repos');
  const stored = await worker.evaluate(() => chrome.storage.local.get(null));
  expect(stored.repos.length).toBe(REPOS.length);
  expect(stored.accounts).toEqual(['jallen', 'jallen-work']);
  expect(JSON.stringify(stored)).not.toContain('-token');
});

test.describe('without the gh helper installed', () => {
  test.use({ installGhHost: false });
  test('palette explains how to install it', async ({ popup }) => {
    await expect(popup.locator('#empty')).toContainText('mise run install-host');
  });
});

test.describe('when gh is not signed in', () => {
  test.use({ ghAccounts: [] });
  test('palette says to run gh auth login', async ({ popup }) => {
    await expect(popup.locator('#empty')).toContainText('gh auth login');
  });
});

test.describe('when GitHub rejects a token', () => {
  test.use({ ghAccounts: [{ login: 'x', token: 'revoked' }] });
  test('options page surfaces the 401', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options.html`);
    await expect(page.locator('#status')).toContainText('401');
  });
});

test('fuzzy type + suffix jumps straight to PRs', async ({ synced, popup }) => {
  await popup.locator('#q').pressSequentially('rpjmp');
  await expect(popup.locator('#results li').first()).toHaveAttribute('data-full-name', 'jallen/repo-jump');
  await popup.locator('#q').pressSequentially(' pulls');
  await expect(popup.locator('#sections .on')).toHaveText('PRs');
  await popup.keyboard.press('Enter');
  await expect(popup).toHaveURL('https://github.com/jallen/repo-jump/pulls');
});

test('Tab cycles sections, arrows move selection', async ({ synced, popup }) => {
  await popup.locator('#q').pressSequentially('react');
  await expect(popup.locator('#results li').first()).toHaveAttribute('data-full-name', 'facebook/react');
  await popup.keyboard.press('Tab');
  await popup.keyboard.press('Tab');
  await expect(popup.locator('#sections .on')).toHaveText('Issues');
  await popup.keyboard.press('Shift+Tab');
  await expect(popup.locator('#sections .on')).toHaveText('PRs');
  await popup.keyboard.press('ArrowDown');
  await expect(popup.locator('#results li.sel')).toHaveAttribute('data-full-name', 'remix-run/react-router');
  await popup.keyboard.press('Enter');
  await expect(popup).toHaveURL('https://github.com/remix-run/react-router/pulls');
});

test('#number jumps to an issue or PR', async ({ synced, popup }) => {
  await popup.locator('#q').pressSequentially('acme/api #42');
  await popup.keyboard.press('Enter');
  await expect(popup).toHaveURL('https://github.com/acme/api-gateway/issues/42');
});

test('opening a repo records a visit that boosts ranking', async ({ synced, popup, worker, context, extensionId }) => {
  await popup.locator('#q').pressSequentially('rea');
  await expect(popup.locator('#results li').first()).toHaveAttribute('data-full-name', 'facebook/react');
  await popup.keyboard.press('ArrowDown');
  await popup.keyboard.press('Enter');
  await expect(popup).toHaveURL('https://github.com/remix-run/react-router');
  const visits = await worker.evaluate(async () => (await chrome.storage.local.get('visits')).visits);
  expect(visits['remix-run/react-router'].count).toBe(1);

  const again = await context.newPage();
  await again.goto(`chrome-extension://${extensionId}/popup.html`);
  await again.locator('#q').pressSequentially('rea');
  await expect(again.locator('#results li').first()).toHaveAttribute('data-full-name', 'remix-run/react-router');
});

test('omnibox suggestions and enter resolve to section URLs', async ({ synced, worker }) => {
  const suggestions = await worker.evaluate(() => globalThis.__repoJump.suggestionsFor('react issues'));
  expect(suggestions[0].content).toBe('https://github.com/facebook/react/issues');
  expect(suggestions[0].description).toContain('<match>facebook/react</match>');

  const entered = await worker.evaluate(() => globalThis.__repoJump.resolveEntered('dotf prs'));
  expect(entered).toEqual({ url: 'https://github.com/jallen/dotfiles/pulls', fullName: 'jallen/dotfiles' });

  const picked = await worker.evaluate(() => globalThis.__repoJump.resolveEntered('https://github.com/acme/api-gateway/actions'));
  expect(picked.fullName).toBe('acme/api-gateway');
});

test('default section setting applies when no suffix is typed', async ({ synced, worker, context, extensionId }) => {
  await worker.evaluate(() => chrome.storage.local.set({ defaultSection: 'issues' }));
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(page.locator('#sections .on')).toHaveText('Issues');
  await page.locator('#q').pressSequentially('dotfiles');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('https://github.com/jallen/dotfiles/issues');
});

test('options page shows accounts and saves default section', async ({ synced, context, extensionId, worker }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(page.locator('#accounts')).toHaveText('jallen, jallen-work');
  await expect(page.locator('#status')).toContainText('6 repos cached');
  await page.locator('#section').selectOption('pulls');
  await expect.poll(() => worker.evaluate(async () => (await chrome.storage.local.get('defaultSection')).defaultSection)).toBe('pulls');
});

test('omnibox enter navigates the active tab and honours new-tab disposition', async ({ synced, worker, context }) => {
  const tab = await context.newPage();
  await tab.goto('https://github.com/somewhere');
  await tab.bringToFront();
  await worker.evaluate(async () => {
    const { url, fullName } = await globalThis.__repoJump.resolveEntered('react a');
    await globalThis.__repoJump.openUrl(url, { fullName, disposition: 'currentTab' });
  });
  await expect(tab).toHaveURL('https://github.com/facebook/react/actions');

  const created = await spyTabCreate(worker);
  await worker.evaluate(() =>
    globalThis.__repoJump.openUrl('https://github.com/jallen/dotfiles', { fullName: 'jallen/dotfiles', disposition: 'newForegroundTab' }),
  );
  expect(await created()).toEqual([{ url: 'https://github.com/jallen/dotfiles', active: true }]);
});

test('palette renders (screenshot)', async ({ synced, popup }) => {
  await popup.setViewportSize({ width: 560, height: 520 });
  await popup.locator('#q').pressSequentially('re');
  await popup.screenshot({ path: 'test-results/palette.png' });
});

test.describe('in-page palette (for browsers that ignore extension shortcuts, e.g. Cra)', () => {
  const overlay = (page) => page.locator('repo-jump-overlay');
  const frame = (page) => page.frameLocator('repo-jump-overlay iframe');

  test('⌥⌘K opens it over the page, Enter navigates that tab', async ({ synced, context }) => {
    const page = await context.newPage();
    await page.goto('https://github.com/somewhere');
    await page.keyboard.press('Alt+Meta+KeyK');
    await expect(overlay(page)).toHaveCount(1);
    await expect(frame(page).locator('#q')).toBeFocused();
    await page.keyboard.type('dotf issues');
    await expect(frame(page).locator('#results li').first()).toHaveAttribute('data-full-name', 'jallen/dotfiles');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL('https://github.com/jallen/dotfiles/issues');
  });

  test('Esc and the shortcut again both close it', async ({ synced, context }) => {
    const page = await context.newPage();
    await page.goto('https://github.com/somewhere');
    await page.keyboard.press('Alt+Meta+KeyK');
    await expect(frame(page).locator('#q')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(overlay(page)).toHaveCount(0);
    await page.keyboard.press('Alt+Meta+KeyK');
    await expect(frame(page).locator('#q')).toBeFocused();
    await page.keyboard.press('Alt+Meta+KeyK');
    await expect(overlay(page)).toHaveCount(0);
  });

  test('⌘↵ opens a new tab from the page itself, records the visit', async ({ synced, context, worker }) => {
    const page = await context.newPage();
    await page.goto('https://github.com/somewhere');
    await page.keyboard.press('Alt+Meta+KeyK');
    await expect(frame(page).locator('#q')).toBeFocused();
    await page.keyboard.type('react pr');
    const popup = page.waitForEvent('popup');
    await page.keyboard.press('Meta+Enter');
    await expect(await popup).toHaveURL('https://github.com/facebook/react/pulls');
    await expect(overlay(page)).toHaveCount(0);
    await expect(page).toHaveURL('https://github.com/somewhere');
    const visits = await worker.evaluate(async () => (await chrome.storage.local.get('visits')).visits);
    expect(visits['facebook/react'].count).toBe(1);
  });

  test('navigation does not depend on chrome.tabs (Cra hides its tabs)', async ({ synced, context, worker }) => {
    await worker.evaluate(() => {
      chrome.tabs.update = chrome.tabs.create = chrome.tabs.query = async () => {
        throw new Error('no tabs here');
      };
    });
    const page = await context.newPage();
    await page.goto('https://github.com/somewhere');
    await page.keyboard.press('Alt+Meta+KeyK');
    await expect(frame(page).locator('#q')).toBeFocused();
    await page.keyboard.type('api a');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL('https://github.com/acme/api-gateway/actions');
  });

  test('shortcut can be changed in options', async ({ synced, context, extensionId }) => {
    const opts = await context.newPage();
    await opts.goto(`chrome-extension://${extensionId}/options.html`);
    await expect(opts.locator('#shortcut')).toHaveValue('⌥⌘K');
    await opts.locator('#shortcut').click();
    await opts.keyboard.press('Control+Meta+KeyJ');
    await expect(opts.locator('#shortcut')).toHaveValue('⌃⌘J');

    const page = await context.newPage();
    await page.goto('https://github.com/somewhere');
    await page.keyboard.press('Alt+Meta+KeyK');
    await expect(overlay(page)).toHaveCount(0);
    await page.keyboard.press('Control+Meta+KeyJ');
    await expect(frame(page).locator('#q')).toBeFocused();
  });
});
