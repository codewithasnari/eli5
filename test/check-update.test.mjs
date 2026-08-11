import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, mkdir, mkdtemp, readdir, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const repoRoot = resolve(import.meta.dirname, '..');
const checker = join(repoRoot, 'scripts/check-update.mjs');

async function fixture(platform = 'claude', version = '0.1.0') {
  const root = await mkdtemp(join(tmpdir(), 'eli5-plugin-'));
  const data = await mkdtemp(join(tmpdir(), 'eli5-data-'));
  const manifestDir = platform === 'claude' ? '.claude-plugin' : '.codex-plugin';
  await mkdir(join(root, manifestDir));
  await writeFile(join(root, manifestDir, 'plugin.json'), JSON.stringify({ name: 'eli5', version }));
  return { root, data };
}

async function serve(handler) {
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return { url: `http://127.0.0.1:${port}/manifest.json`, close: () => new Promise((resolve) => server.close(resolve)) };
}

async function run({ platform = 'claude', root, data, url, extraEnv = {} }) {
  const child = spawn(process.execPath, [checker, '--platform', platform, '--root', root, '--data', data], {
    env: { ...process.env, NODE_ENV: 'test', ELI5_UPDATE_TEST_URL: url, ELI5_UPDATE_TTL_MS: '86400000', ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
  child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
  const code = await new Promise((resolve) => child.on('close', resolve));
  return { code, stdout, stderr };
}

test('skill is preserved byte-for-byte', async () => {
  const original = await readFile('/home/asnari/.codex/skills/eli5/SKILL.md');
  const packaged = await readFile(join(repoRoot, 'skills/eli5/SKILL.md'));
  assert.deepEqual(packaged, original);
});

test('manifests align at v0.1.0 and hooks follow each host contract', async () => {
  const paths = ['package.json', '.claude-plugin/plugin.json', '.claude-plugin/marketplace.json', '.codex-plugin/plugin.json', '.agents/plugins/marketplace.json', 'hooks/hooks.json', 'hooks/codex-hooks.json'];
  const docs = Object.fromEntries(await Promise.all(paths.map(async (path) => [path, JSON.parse(await readFile(join(repoRoot, path), 'utf8'))])));
  assert.equal(docs['package.json'].version, '0.1.0');
  assert.equal(docs['.claude-plugin/plugin.json'].version, '0.1.0');
  assert.equal(docs['.claude-plugin/plugin.json'].hooks, undefined);
  assert.equal(docs['.codex-plugin/plugin.json'].version, '0.1.0');
  assert.equal(docs['.codex-plugin/plugin.json'].hooks, './hooks/codex-hooks.json');
  assert.equal(docs['.agents/plugins/marketplace.json'].plugins[0].version, '0.1.0');
  assert.match(docs['hooks/hooks.json'].hooks.SessionStart[0].hooks[0].command, /CLAUDE_PLUGIN_ROOT/);
  assert.match(docs['hooks/hooks.json'].hooks.SessionStart[0].hooks[0].command, /CLAUDE_PLUGIN_DATA/);
  assert.match(docs['hooks/codex-hooks.json'].hooks.SessionStart[0].hooks[0].command, /\$PLUGIN_ROOT/);
  assert.match(docs['hooks/codex-hooks.json'].hooks.SessionStart[0].hooks[0].commandWindows, /\$env:PLUGIN_ROOT/);
});

for (const platform of ['claude', 'codex']) {
  test(`${platform}: newer version prints only safe manual update instructions`, async () => {
    const { root, data } = await fixture(platform);
    const remote = await serve((_req, res) => res.end(JSON.stringify({ name: 'eli5', version: '0.2.0' })));
    try {
      const result = await run({ platform, root, data, url: remote.url });
      assert.equal(result.code, 0);
      assert.equal(result.stderr, '');
      const output = JSON.parse(result.stdout);
      assert.equal(output.continue, true);
      assert.equal('additionalContext' in output, false);
      assert.match(output.systemMessage, /eli5 0\.1\.0.*0\.2\.0/s);
      assert.match(output.systemMessage, platform === 'claude' ? /claude plugin update eli5@eli5/ : /codex plugin add eli5@eli5/);
      assert.doesNotMatch(result.stdout, /127\.0\.0\.1|manifest\.json|token/i);
    } finally { await remote.close(); }
  });
}

test('equal versions are silent and successful checks are cached securely', async () => {
  const { root, data } = await fixture();
  let requests = 0;
  const remote = await serve((_req, res) => { requests += 1; res.end(JSON.stringify({ name: 'eli5', version: '0.1.0' })); });
  try {
    assert.deepEqual(await run({ root, data, url: remote.url }), { code: 0, stdout: '', stderr: '' });
    assert.deepEqual(await run({ root, data, url: remote.url }), { code: 0, stdout: '', stderr: '' });
    assert.equal(requests, 1);
    assert.deepEqual(await readdir(data), ['update-check.json']);
    assert.equal((await stat(join(data, 'update-check.json'))).mode & 0o077, 0);
  } finally { await remote.close(); }
});

test('network, HTTP, JSON, schema, and semver failures are silent', async () => {
  const handlers = [
    (_req, res) => { res.statusCode = 404; res.end('secret'); },
    (_req, res) => res.end('{bad json'),
    (_req, res) => res.end(JSON.stringify({ name: 'other', version: '0.2.0' })),
    (_req, res) => res.end(JSON.stringify({ name: 'eli5', version: 'v0.2.0' })),
  ];
  for (const handler of handlers) {
    const { root, data } = await fixture();
    const remote = await serve(handler);
    try { assert.deepEqual(await run({ root, data, url: remote.url }), { code: 0, stdout: '', stderr: '' }); }
    finally { await remote.close(); }
  }
  const { root, data } = await fixture();
  assert.deepEqual(await run({ root, data, url: 'http://127.0.0.1:1/private?token=value' }), { code: 0, stdout: '', stderr: '' });
});

test('checker never writes in the plugin root', async () => {
  const { root, data } = await fixture();
  const before = await readdir(root, { recursive: true });
  const remote = await serve((_req, res) => res.end(JSON.stringify({ name: 'eli5', version: '0.1.0' })));
  try {
    await run({ root, data, url: remote.url });
    assert.deepEqual(await readdir(root, { recursive: true }), before);
  } finally { await remote.close(); }
});
