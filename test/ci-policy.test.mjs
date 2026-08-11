import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const workflowPath = resolve(import.meta.dirname, '../.github/workflows/ci.yml');
const allowedActions = new Set(['actions/checkout', 'actions/setup-node']);

test('CI uses only allowlisted actions pinned to full commit SHAs', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  const uses = [...workflow.matchAll(/^\s*- uses:\s*([^\s@]+)@([^\s#]+)/gm)];

  assert.ok(uses.length > 0, 'CI must use at least one GitHub Action');
  for (const [, action, revision] of uses) {
    assert.ok(allowedActions.has(action), `${action} is not allowlisted`);
    assert.match(revision, /^[0-9a-f]{40}$/, `${action} must use a full 40-character commit SHA`);
  }
});

test('repository metadata validator accepts the packaged plugin', () => {
  const result = spawnSync(process.execPath, ['scripts/validate-repo.mjs'], {
    cwd: resolve(import.meta.dirname, '..'),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
});
