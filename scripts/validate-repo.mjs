import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const jsonPaths = [
  'package.json',
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

assert.match(version, /^\d+\.\d+\.\d+$/);
assert.equal(documents['.claude-plugin/plugin.json'].name, 'eli5');
assert.equal(documents['.claude-plugin/plugin.json'].version, version);
assert.equal(documents['.codex-plugin/plugin.json'].name, 'eli5');
assert.equal(documents['.codex-plugin/plugin.json'].version, version);
assert.equal(documents['.agents/plugins/marketplace.json'].plugins[0].version, version);
assert.ok(documents['hooks/hooks.json'].hooks.SessionStart.length > 0);

const skill = await readFile(new URL('../skills/eli5/SKILL.md', import.meta.url), 'utf8');
const frontmatter = skill.match(/^---\n([\s\S]+?)\n---\n/);
assert.ok(frontmatter, 'SKILL.md must begin with YAML frontmatter');
assert.match(frontmatter[1], /^name:\s*eli5$/m);
assert.match(frontmatter[1], /^description:\s*\S.+$/m);
