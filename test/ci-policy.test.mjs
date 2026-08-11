import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
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

async function rejectMutations(mutations) {
  const root = await mkdtemp(resolve(tmpdir(), 'eli5-validation-'));
  await cp(resolve(import.meta.dirname, '..'), root, { recursive: true });
  for (const [path, mutate] of mutations) {
    const target = resolve(root, path);
    const original = await readFile(target, 'utf8');
    await writeFile(target, mutate(original));
  }
  const result = spawnSync(process.execPath, ['scripts/validate-repo.mjs'], { cwd: root, encoding: 'utf8' });
  assert.notEqual(result.status, 0, `${mutations.map(([path]) => path).join(', ')} mutation was accepted`);
}

async function rejectMutation(path, mutate) {
  await rejectMutations([[path, mutate]]);
}

test('repository metadata validator rejects inconsistent package identity', async () => {
  await rejectMutation('package-lock.json', (source) => source.replace('"version": "0.1.2"', '"version": "9.9.9"'));
  await rejectMutation('CITATION.cff', (source) => source.replace('version: 0.1.2', 'version: 9.9.9'));
  await rejectMutation('CITATION.cff', (source) => source.replace('github.com/Kyaa-A/eli5', 'github.com/other/eli5'));
  await rejectMutation('.claude-plugin/marketplace.json', (source) => source.replace('"plugins": [\n    {\n      "name": "eli5"', '"plugins": [\n    {\n      "name": "other"'));
});

test('repository metadata validator rejects unsafe hook metadata', async () => {
  await rejectMutation('hooks/hooks.json', (source) => source.replace('scripts/check-update.mjs', 'scripts/other.mjs'));
  await rejectMutation('.agents/plugins/marketplace.json', (source) => source.replace('"AVAILABLE"', '"BLOCKED"'));
});

test('repository metadata validator rejects SemVer leading zeros', async () => {
  const paths = ['package.json', 'package-lock.json', '.claude-plugin/plugin.json', '.claude-plugin/marketplace.json', '.codex-plugin/plugin.json', '.agents/plugins/marketplace.json', 'CITATION.cff'];
  await rejectMutations(paths.map((path) => [path, (source) => source.replaceAll('0.1.2', '01.1.2')]));
});
