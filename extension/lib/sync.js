import { fetchAllRepos, mergeRepos } from './github.js';
import { getAccounts } from './auth.js';
import { save } from './store.js';

export const STALE_MS = 60 * 60 * 1000;

let inflight = null;

export function syncRepos() {
  inflight ??= (async () => {
    try {
      const accounts = await getAccounts();
      const lists = await Promise.all(accounts.map((a) => fetchAllRepos(a.token)));
      const repos = mergeRepos(lists);
      const logins = accounts.map((a) => a.login);
      await save({ repos, accounts: logins, syncedAt: Date.now(), syncError: '' });
      return { ok: true, count: repos.length, accounts: logins };
    } catch (err) {
      await save({ syncError: String(err.message ?? err) });
      return { ok: false, error: String(err.message ?? err) };
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
