import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseInput, buildUrl } from '../../extension/lib/commands.js';

test('parses trailing section aliases', () => {
  assert.deepEqual(parseInput('owner/repo issues'), { query: 'owner/repo', section: 'issues', number: null, branch: null });
  assert.equal(parseInput('repo prs').section, 'pulls');
  assert.equal(parseInput('repo PR').section, 'pulls');
  assert.equal(parseInput('repo a').section, 'actions');
});

test('lone alias is a repo query, not a section', () => {
  assert.deepEqual(parseInput('pulls'), { query: 'pulls', section: null, number: null, branch: null });
});

test('parses #number and @branch', () => {
  assert.deepEqual(parseInput('repo #123'), { query: 'repo', section: null, number: 123, branch: null });
  assert.equal(parseInput('repo @feature/x').branch, 'feature/x');
});

test('builds urls', () => {
  assert.equal(buildUrl('a/b'), 'https://github.com/a/b');
  assert.equal(buildUrl('a/b', { section: 'pulls' }), 'https://github.com/a/b/pulls');
  assert.equal(buildUrl('a/b', { number: 7, section: 'pulls' }), 'https://github.com/a/b/issues/7');
  assert.equal(buildUrl('a/b', { branch: 'feat/x y' }), 'https://github.com/a/b/tree/feat/x%20y');
});
