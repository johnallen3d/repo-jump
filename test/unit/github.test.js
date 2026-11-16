import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchAllRepos } from '../../extension/lib/github.js';
import { REPOS } from '../fixtures.js';

test('follows Link pagination and sends auth', async () => {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url, auth: opts.headers.Authorization });
    const second = url.includes('page=2');
    return new Response(JSON.stringify(second ? REPOS.slice(3) : REPOS.slice(0, 3)), {
      headers: second ? {} : { link: '<https://api.github.com/user/repos?page=2>; rel="next", <https://api.github.com/user/repos?page=2>; rel="last"' },
    });
  };
  const repos = await fetchAllRepos('tok', { fetchImpl });
  assert.equal(repos.length, REPOS.length);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].auth, 'Bearer tok');
  assert.equal(repos[0].owner, 'jallen');
});

test('throws on API error', async () => {
  const fetchImpl = async () => new Response('Bad credentials', { status: 401 });
  await assert.rejects(fetchAllRepos('bad', { fetchImpl }), /401/);
});

test('mergeRepos dedupes across accounts by id', async () => {
  const { mergeRepos } = await import('../../extension/lib/github.js');
  const merged = mergeRepos([[{ id: 1 }, { id: 2 }], [{ id: 2 }, { id: 3 }]]);
  assert.deepEqual(merged.map((r) => r.id), [1, 2, 3]);
});
