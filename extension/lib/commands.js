// Parses palette/omnibox input into a repo query plus an optional target
// (section, issue/PR number, or branch), and builds GitHub URLs.

export const GITHUB = 'https://github.com';

// Ordered list drives Tab-cycling in the palette.
export const SECTIONS = [
  { id: 'code', label: 'Code', path: '', aliases: ['code', 'c'] },
  { id: 'pulls', label: 'PRs', path: '/pulls', aliases: ['pulls', 'prs', 'pr', 'p'] },
  { id: 'issues', label: 'Issues', path: '/issues', aliases: ['issues', 'issue', 'i'] },
  { id: 'actions', label: 'Actions', path: '/actions', aliases: ['actions', 'a', 'ci'] },
  { id: 'releases', label: 'Releases', path: '/releases', aliases: ['releases', 'r'] },
  { id: 'wiki', label: 'Wiki', path: '/wiki', aliases: ['wiki', 'w'] },
  { id: 'projects', label: 'Projects', path: '/projects', aliases: ['projects'] },
  { id: 'settings', label: 'Settings', path: '/settings', aliases: ['settings', 's'] },
];

const ALIAS = new Map(SECTIONS.flatMap((s) => s.aliases.map((a) => [a, s.id])));

export function sectionById(id) {
  return SECTIONS.find((s) => s.id === id) ?? SECTIONS[0];
}

/**
 * "owner/repo issues"  -> { query: 'owner/repo', section: 'issues' }
 * "repo #123"          -> { query: 'repo', number: 123 }
 * "repo @main"         -> { query: 'repo', branch: 'main' }
 * Trailing modifiers only apply when a repo query precedes them, so typing
 * "pulls" alone still searches for a repo named "pulls".
 */
export function parseInput(input) {
  const tokens = String(input ?? '').trim().split(/\s+/).filter(Boolean);
  const out = { query: '', section: null, number: null, branch: null };
  while (tokens.length > 1) {
    const last = tokens[tokens.length - 1];
    const lower = last.toLowerCase();
    if (out.number == null && /^#\d+$/.test(last)) {
      out.number = Number(last.slice(1));
    } else if (out.branch == null && /^@\S+$/.test(last)) {
      out.branch = last.slice(1);
    } else if (out.section == null && ALIAS.has(lower)) {
      out.section = ALIAS.get(lower);
    } else {
      break;
    }
    tokens.pop();
  }
  out.query = tokens.join(' ');
  return out;
}

export function buildUrl(fullName, { section = null, number = null, branch = null } = {}) {
  const base = `${GITHUB}/${fullName}`;
  // /issues/N redirects to /pull/N when N is a PR, so one form covers both.
  if (number != null) return `${base}/issues/${number}`;
  if (branch) return `${base}/tree/${encodeURIComponent(branch).replace(/%2F/g, '/')}`;
  return base + sectionById(section ?? 'code').path;
}
