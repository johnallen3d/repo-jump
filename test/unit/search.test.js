import { test } from 'node:test';
import assert from 'node:assert/strict';
import { search, scoreRepo } from '../../extension/lib/search.js';
import { slimRepo } from '../../extension/lib/github.js';
import { REPOS } from '../fixtures.js';

const repos = REPOS.map(slimRepo);
const names = (q, opts) => search(q, repos, opts).map((r) => r.full_name);

test('exact beats prefix beats fuzzy', () => {
  assert.deepEqual(names('react').slice(0, 2), ['facebook/react', 'remix-run/react-router']);
});

test('fuzzy subsequence matches', () => {
  assert.equal(names('rpjmp')[0], 'jallen/repo-jump');
  assert.equal(names('apigw')[0], 'acme/api-gateway');
});

test('matches owner/repo', () => {
  assert.equal(names('acme/api')[0], 'acme/api-gateway');
});

test('non-matching returns null', () => {
  assert.equal(scoreRepo('zzzz', repos[0]), null);
});

test('empty query lists everything, recent pushes first', () => {
  const r = names('');
  assert.equal(r.length, repos.length);
  assert.equal(r[0], 'jallen/repo-jump');
});

test('frecency reorders similar matches but never beats an exact match', () => {
  const now = Date.now();
  const visits = { 'remix-run/react-router': { count: 20, last: now } };
  assert.equal(names('rea')[0], 'facebook/react');
  assert.equal(names('rea', { visits, now })[0], 'remix-run/react-router');
  assert.equal(names('react', { visits, now })[0], 'facebook/react');
});

test('archived repos sink', () => {
  assert.equal(names('').at(-1), 'acme/old-thing');
});
