#!/usr/bin/env node

import { randomBytes } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';

const CONFIG = {
  claude: {
    manifest: '.claude-plugin/plugin.json',
    remote: 'https://raw.githubusercontent.com/codewithasnari/eli5/main/.claude-plugin/plugin.json',
    message(installed, latest) {
      return `eli5 ${installed} -> ${latest} update available\nRun:\n  claude plugin marketplace update eli5\n  claude plugin update eli5@eli5\nThen restart Claude Code or run /reload-plugins.`;
    },
  },
  codex: {
    manifest: '.codex-plugin/plugin.json',
    remote: 'https://raw.githubusercontent.com/codewithasnari/eli5/main/.codex-plugin/plugin.json',
    message(installed, latest) {
      return `eli5 ${installed} -> ${latest} update available\nRun:\n  codex plugin marketplace upgrade eli5\n  codex plugin remove eli5@eli5\n  codex plugin add eli5@eli5\nThen start a new Codex session.`;
    },
  },
};

const CACHE_FILE = 'update-check.json';
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 3000;
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function argsToObject(args) {
  const result = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key?.startsWith('--') || value === undefined) return null;
    result[key.slice(2)] = value;
  }
  return result;
}

function testNumber(name, fallback, maximum = Number.MAX_SAFE_INTEGER) {
  if (process.env.NODE_ENV !== 'test') return fallback;
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value >= 0 && value <= maximum ? value : fallback;
}

function parseVersion(value) {
  const match = typeof value === 'string' ? SEMVER.exec(value) : null;
  return match ? match.slice(1) : null;
}

function isNewer(current, latest) {
  for (let index = 0; index < 3; index += 1) {
    if (latest[index].length !== current[index].length) return latest[index].length > current[index].length;
    if (latest[index] !== current[index]) return latest[index] > current[index];
  }
  return false;
}

function remoteUrl(config) {
  if (process.env.NODE_ENV === 'test' && process.env.ELI5_UPDATE_TEST_URL) {
    const testUrl = new URL(process.env.ELI5_UPDATE_TEST_URL);
    if (testUrl.protocol === 'http:' && ['127.0.0.1', '::1', 'localhost'].includes(testUrl.hostname)) return testUrl;
    if (testUrl.protocol === 'https:') return testUrl;
    throw new Error('invalid test URL');
  }
  const url = new URL(config.remote);
  if (url.protocol !== 'https:') throw new Error('invalid production URL');
  return url;
}

async function freshCache(data, platform, installed, ttlMs) {
  const cache = JSON.parse(await readFile(join(data, CACHE_FILE), 'utf8'));
  return cache.platform === platform && cache.version === installed && Number.isFinite(cache.checkedAt)
    && Date.now() - cache.checkedAt >= 0 && Date.now() - cache.checkedAt < ttlMs;
}

async function writeCache(data, platform, installed) {
  await mkdir(data, { recursive: true, mode: 0o700 });
  const destination = join(data, CACHE_FILE);
  const temporary = join(data, `.${CACHE_FILE}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`);
  let handle;
  try {
    handle = await open(temporary, 'wx', 0o600);
    await handle.writeFile(`${JSON.stringify({ platform, version: installed, checkedAt: Date.now() })}\n`);
    await handle.sync();
    await handle.close();
    handle = undefined;
    const windowsReplacement = process.platform === 'win32' || (process.env.NODE_ENV === 'test' && process.env.ELI5_UPDATE_TEST_WINDOWS_REPLACE === '1');
    if (!windowsReplacement) {
      await rename(temporary, destination);
      return;
    }
    const backup = join(data, `.${CACHE_FILE}.${process.pid}.${randomBytes(6).toString('hex')}.bak`);
    let backedUp = false;
    try {
      try { await rename(destination, backup); backedUp = true; } catch (error) { if (error?.code !== 'ENOENT') throw error; }
      await rename(temporary, destination);
      if (backedUp) await unlink(backup);
    } catch (error) {
      if (backedUp) await rename(backup, destination).catch(() => {});
      throw error;
    }
  } finally {
    await handle?.close().catch(() => {});
    await unlink(temporary).catch(() => {});
  }
}

async function main() {
  if (process.env.ELI5_UPDATE_CHECK === '0') return;
  const args = argsToObject(process.argv.slice(2));
  const config = args && CONFIG[args.platform];
  if (!config || !args.root || !args.data) return;
  const manifest = JSON.parse(await readFile(join(args.root, config.manifest), 'utf8'));
  if (manifest.name !== 'eli5') return;
  const current = parseVersion(manifest.version);
  if (!current) return;
  const ttlMs = testNumber('ELI5_UPDATE_TTL_MS', DEFAULT_TTL_MS);
  try { if (await freshCache(args.data, args.platform, manifest.version, ttlMs)) return; } catch {}
  const timeoutMs = testNumber('ELI5_UPDATE_TIMEOUT_MS', DEFAULT_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
  const response = await fetch(remoteUrl(config), { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) return;
  const remote = await response.json();
  if (remote?.name !== 'eli5') return;
  const latest = parseVersion(remote.version);
  if (!latest) return;
  try { await writeCache(args.data, args.platform, manifest.version); } catch {}
  if (isNewer(current, latest)) {
    process.stdout.write(`${JSON.stringify({ continue: true, systemMessage: config.message(manifest.version, remote.version) })}\n`);
  }
}

await main().catch(() => {});
