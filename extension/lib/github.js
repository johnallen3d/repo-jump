// Fetches every repo the token's user can access: owned, collaborator, and
// org member repos.

export const API = 'https://api.github.com';

function nextLink(header) {
  if (!header) return null;
  for (const part of header.split(',')) {
    const m = part.match(/<([^>]+)>;\s*rel="next"/);
    if (m) return m[1];
  }
  return null;
}

export function slimRepo(r) {
  return {
    id: r.id,
    name: r.name,
    full_name: r.full_name,
    owner: r.owner?.login ?? r.full_name.split('/')[0],
    description: r.description ?? '',
    private: !!r.private,
    fork: !!r.fork,
    archived: !!r.archived,
    default_branch: r.default_branch,
    pushed_at: r.pushed_at,
    open_issues_count: r.open_issues_count ?? 0,
  };
}

// Union of repos across accounts, deduped by repo id.
export function mergeRepos(lists) {
  const byId = new Map();
  for (const list of lists) for (const r of list) if (!byId.has(r.id)) byId.set(r.id, r);
  return [...byId.values()];
}

export async function fetchAllRepos(token, { fetchImpl = fetch } = {}) {
  if (!token) throw new Error('Empty GitHub token');
  let url = `${API}/user/repos?per_page=100&sort=pushed&affiliation=owner,collaborator,organization_member`;
  const repos = [];
  while (url) {
    const res = await fetchImpl(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`GitHub API ${res.status}: ${body.slice(0, 200)}`);
    }
    const page = await res.json();
    repos.push(...page.map(slimRepo));
    url = nextLink(res.headers.get('link'));
  }
  return repos;
}
