// Tokens come from the local `gh` CLI via a native-messaging host; they are
// used for the sync and never persisted by the extension.
export const HOST_NAME = 'com.repojump.gh';

export const HOST_MISSING_HINT = 'gh helper not installed — run `mise run install-host`';

export async function getAccounts() {
  let res;
  try {
    res = await chrome.runtime.sendNativeMessage(HOST_NAME, { type: 'accounts' });
  } catch (err) {
    const msg = String(err.message ?? err);
    if (/not found|forbidden/i.test(msg)) throw new Error(HOST_MISSING_HINT);
    throw new Error(`gh helper failed: ${msg}`);
  }
  if (!res?.ok) throw new Error(res?.error ?? 'gh helper returned nothing');
  return res.accounts;
}
