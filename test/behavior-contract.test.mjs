import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const evals = JSON.parse(await readFile(new URL('../evals/evals.json', import.meta.url), 'utf8'));

test('behavior suite covers explanation, error, code, and context cases', () => {
  assert.deepEqual(evals.map(({ id }) => id), [
    'concept', 'error', 'code', 'bare-trigger', 'precision-boundary',
  ]);
  for (const scenario of evals) {
    assert.ok(scenario.prompt.length > 10);
    assert.ok(scenario.expected.length >= 3);
    assert.ok(scenario.forbidden.length >= 2);
  }
});
