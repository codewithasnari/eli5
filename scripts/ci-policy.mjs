import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from 'yaml';

const allowed = new Set(['actions/checkout', 'actions/setup-node']);
export async function assertSafeWorkflows(root = resolve(import.meta.dirname, '..')) {
  const directory = resolve(root, '.github/workflows');
  const files = (await readdir(directory)).filter((name) => /\.ya?ml$/.test(name));
  const uses = [];
  const visit = (value) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) { if (key === 'uses') uses.push(child); visit(child); }
  };
  for (const file of files) visit(parse(await readFile(resolve(directory, file), 'utf8')));
  if (uses.length === 0) throw new Error('workflows must use at least one GitHub Action');
  for (const reference of uses) {
    if (typeof reference !== 'string') throw new Error('uses must be a string');
    const at = reference.lastIndexOf('@');
    const action = reference.slice(0, at);
    const revision = reference.slice(at + 1);
    if (!allowed.has(action)) throw new Error(`${action} is not allowlisted`);
    if (!/^[0-9a-f]{40}$/.test(revision)) throw new Error(`${action} must use a full lowercase 40-character commit SHA`);
  }
}
