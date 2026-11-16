import { recordVisit } from './store.js';

// disposition mirrors chrome.omnibox: currentTab | newForegroundTab | newBackgroundTab
export async function openUrl(url, { fullName, disposition = 'currentTab' } = {}) {
  if (fullName) await recordVisit(fullName);
  if (disposition === 'currentTab') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id != null) return chrome.tabs.update(tab.id, { url });
  }
  return chrome.tabs.create({ url, active: disposition !== 'newBackgroundTab' });
}
