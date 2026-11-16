// Small dependency-free ranker: exact > prefix > substring > fuzzy, with a
// frecency boost for repos you open often or recently.

const BOUNDARY = /[\/\-_.\s]/;

function fuzzy(q, text) {
  // Subsequence match rewarding consecutive runs and word-boundary hits.
  let ti = 0;
  let score = 0;
  let run = 0;
  for (const ch of q) {
    const found = text.indexOf(ch, ti);
    if (found === -1) return null;
    if (found === ti && ti > 0) run += 1;
    else run = 0;
    const atBoundary = found === 0 || BOUNDARY.test(text[found - 1]);
    score += 10 + run * 8 + (atBoundary ? 12 : 0) - Math.min(found - ti, 10);
    ti = found + 1;
  }
  // Normalise into 100..400 and prefer shorter targets.
  return Math.max(100, Math.min(400, 100 + score * 2 - text.length));
}

function textScore(q, text) {
  if (!text) return null;
  if (text === q) return 1000;
  if (text.startsWith(q)) return 800 - Math.min(text.length - q.length, 100);
  const idx = text.indexOf(q);
  if (idx !== -1) {
    const atBoundary = BOUNDARY.test(text[idx - 1]);
    return (atBoundary ? 650 : 500) - Math.min(idx, 50);
  }
  return fuzzy(q.replace(/\s+/g, ''), text);
}

export function scoreRepo(query, repo) {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const name = repo.name.toLowerCase();
  const full = repo.full_name.toLowerCase();
  const candidates = [textScore(q, name), textScore(q, full)];
  const desc = (repo.description ?? '').toLowerCase();
  if (q.length >= 3 && desc.includes(q)) candidates.push(80);
  const best = Math.max(...candidates.filter((s) => s != null));
  return Number.isFinite(best) ? best : null;
}

export function frecency(visit, now = Date.now()) {
  if (!visit) return 0;
  const ageDays = Math.max(0, (now - visit.last) / 86_400_000);
  return Math.min(200, 40 * Math.log2(1 + visit.count)) / (1 + ageDays / 7);
}

export function search(query, repos, { visits = {}, limit = 50, now = Date.now() } = {}) {
  const results = [];
  for (const repo of repos) {
    const s = scoreRepo(query, repo);
    if (s == null) continue;
    const boost = frecency(visits[repo.full_name], now);
    const archivedPenalty = repo.archived ? 50 : 0;
    results.push({ repo, score: s + boost - archivedPenalty });
  }
  results.sort(
    (a, b) =>
      b.score - a.score ||
      (b.repo.pushed_at ?? '').localeCompare(a.repo.pushed_at ?? '') ||
      a.repo.full_name.localeCompare(b.repo.full_name),
  );
  return results.slice(0, limit).map((r) => r.repo);
}
