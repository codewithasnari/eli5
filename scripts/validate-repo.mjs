import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const jsonPaths = [
  'package.json',
  'package-lock.json',
  '.claude-plugin/plugin.json',
  '.claude-plugin/marketplace.json',
  '.codex-plugin/plugin.json',
  '.agents/plugins/marketplace.json',
  'hooks/hooks.json',
];
const documents = Object.fromEntries(await Promise.all(jsonPaths.map(async (path) => [
  path,
  JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8')),
])));
const version = documents['package.json'].version;
const packageLock = documents['package-lock.json'];
const claudePlugin = documents['.claude-plugin/plugin.json'];
const claudeMarketplace = documents['.claude-plugin/marketplace.json'];
const codexPlugin = documents['.codex-plugin/plugin.json'];
const agentsMarketplace = documents['.agents/plugins/marketplace.json'];
const hooks = documents['hooks/hooks.json'];
const semver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

assert.match(version, semver);
for (const [name, candidate] of [
  [documents['package.json'].name, version],
  [packageLock.name, packageLock.version],
  [packageLock.packages[''].name, packageLock.packages[''].version],
  [claudePlugin.name, claudePlugin.version],
  [claudeMarketplace.plugins[0].name, claudeMarketplace.plugins[0].version],
  [codexPlugin.name, codexPlugin.version],
  [agentsMarketplace.plugins[0].name, agentsMarketplace.plugins[0].version],
]) {
  assert.equal(name, 'eli5');
  assert.equal(candidate, version);
}
assert.equal(claudeMarketplace.name, 'eli5');
assert.equal(agentsMarketplace.name, 'eli5');
assert.deepEqual(agentsMarketplace.plugins[0].policy, { installation: 'AVAILABLE', authentication: 'ON_INSTALL' });

const hook = hooks.hooks.SessionStart[0];
assert.equal(hooks.hooks.SessionStart.length, 1);
assert.equal(hook.matcher, 'startup');
assert.equal(hook.hooks.length, 1);
assert.equal(hook.hooks[0].type, 'command');
assert.match(hook.hooks[0].command, /CLAUDE_PLUGIN_ROOT/);
assert.match(hook.hooks[0].command, /PLUGIN_ROOT/);
assert.match(hook.hooks[0].command, /scripts\/check-update\.mjs/);
assert.match(hook.hooks[0].commandWindows, /CLAUDE_PLUGIN_ROOT/);
assert.match(hook.hooks[0].commandWindows, /PLUGIN_ROOT/);
assert.match(hook.hooks[0].commandWindows, /scripts\\check-update\.mjs/);
assert.equal(hook.hooks[0].timeout, 5);
assert.equal(hook.hooks[0].statusMessage, 'Checking eli5 version');

const citation = await readFile(new URL('../CITATION.cff', import.meta.url), 'utf8');
assert.match(citation, /^title: eli5$/m);
assert.match(citation, new RegExp(`^version: ${version.replaceAll('.', '\\.')}$`, 'm'));
assert.match(citation, /^repository-code: "https:\/\/github\.com\/Kyaa-A\/eli5"$/m);
assert.match(citation, /^url: "https:\/\/github\.com\/Kyaa-A\/eli5"$/m);

const skill = await readFile(new URL('../skills/eli5/SKILL.md', import.meta.url), 'utf8');
const frontmatter = skill.match(/^---\n([\s\S]+?)\n---\n/);
assert.ok(frontmatter, 'SKILL.md must begin with YAML frontmatter');
assert.match(frontmatter[1], /^name:\s*eli5$/m);
assert.match(frontmatter[1], /^description:\s*\S.+$/m);
