import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { assertSafeWorkflows } from '../scripts/ci-policy.mjs';

const sha = '1'.repeat(40);

test('repository workflows satisfy CI policy', async () => assertSafeWorkflows(resolve(import.meta.dirname, '..')));

test('CI policy scans all workflow YAML syntax and files', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'eli5-ci-'));
  await mkdir(resolve(root, '.github/workflows'), { recursive: true });
  await writeFile(resolve(root, '.github/workflows/ci.yml'), `steps:\n  - uses: actions/checkout@${sha}\n`);
  await writeFile(resolve(root, '.github/workflows/extra.yaml'), `steps:\n  - { "uses": actions/setup-node@${sha} }\n`);
  await assertSafeWorkflows(root);
  await writeFile(resolve(root, '.github/workflows/extra.yaml'), `jobs:\n  attack:\n    "uses": evil/action@${sha}\n`);
  await assert.rejects(assertSafeWorkflows(root));
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
  await rejectMutation('package-lock.json', (source) => source.replace('"version": "0.1.3"', '"version": "9.9.9"'));
  await rejectMutation('CITATION.cff', (source) => source.replace('version: 0.1.3', 'version: 9.9.9'));
  await rejectMutation('CITATION.cff', (source) => source.replace('github.com/Kyaa-A/eli5', 'github.com/other/eli5'));
  await rejectMutation('.claude-plugin/marketplace.json', (source) => source.replace('"plugins": [\n    {\n      "name": "eli5"', '"plugins": [\n    {\n      "name": "other"'));
  await rejectMutation('.claude-plugin/marketplace.json', (source) => {
    const document = JSON.parse(source);
    document.plugins.push({ ...document.plugins[0], name: 'other' });
    return JSON.stringify(document);
  });
  await rejectMutation('.agents/plugins/marketplace.json', (source) => {
    const document = JSON.parse(source);
    document.plugins.push({ ...document.plugins[0], name: 'other' });
    return JSON.stringify(document);
  });
});

test('repository metadata validator rejects unsafe hook metadata', async () => {
  await rejectMutation('hooks/hooks.json', (source) => source.replace('scripts/check-update.mjs', 'scripts/other.mjs'));
  await rejectMutation('.agents/plugins/marketplace.json', (source) => source.replace('"AVAILABLE"', '"BLOCKED"'));
});

test('repository metadata validator requires explicit Codex hook fallbacks', async () => {
  await rejectMutation('hooks/hooks.json', (source) => {
    const document = JSON.parse(source);
    const hook = document.hooks.SessionStart[0].hooks[0];
    hook.command = hook.command.replace('root="$PLUGIN_ROOT"', 'root="$CLAUDE_PLUGIN_ROOT"');
    return JSON.stringify(document);
  });
  await rejectMutation('hooks/hooks.json', (source) => {
    const document = JSON.parse(source);
    const hook = document.hooks.SessionStart[0].hooks[0];
    hook.commandWindows = hook.commandWindows.replace('$env:PLUGIN_ROOT', '$env:CLAUDE_PLUGIN_ROOT');
    return JSON.stringify(document);
  });
});

test('repository metadata validator rejects SemVer leading zeros', async () => {
  const paths = ['package.json', 'package-lock.json', '.claude-plugin/plugin.json', '.claude-plugin/marketplace.json', '.codex-plugin/plugin.json', '.agents/plugins/marketplace.json', 'CITATION.cff'];
  await rejectMutations(paths.map((path) => [path, (source) => source.replaceAll('0.1.3', '01.1.3')]));
});
