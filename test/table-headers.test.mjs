import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeTableData } from '../vendor/web/src/table-data.js';
const root = fileURLToPath(new URL('../', import.meta.url));
// Exercise the same vendored-path adaptation as the browser bundle.
const bundle = await build({
  entryPoints: [path.join(root, 'vendor/web/src/speech-queue.js')], bundle: true, format: 'esm', platform: 'node', write: false,
  plugins: [{ name: 'shared-source', setup(builder) {
    builder.onResolve({ filter: /^\.\.\/vendor\// }, args => ({ path: path.join(root, 'vendor', args.path.slice('../vendor/'.length)) }));
  } }],
});
const { buildQueue, formulaOptions } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const table = { headers: ['Item', 'Count'], rows: [['Apples', '0'], ['Pears', '3']], caption: '' };
const doc = { blocks: [{ raw: '', table }] };
const settings = { academic: true, mathMode: 'smart', mathLanguage: 'english', tableMode: 'smart' };
const speech = (document, options) => buildQueue(document, options).map(item => item.text).join(' ');

test('table headers repeat by default and are read once when disabled', () => {
  assert.equal(formulaOptions(settings, '').academicTableRepeatHeaders, true);
  assert.match(speech(doc, settings), /Item: Apples; Count: 0/);
  const once = speech(doc, { ...settings, academicTableRepeatHeaders: false });
  assert.match(once, /Table columns: Item; Count/);
  assert.match(once, /Row 1\. Apples; 0/);
  assert.doesNotMatch(once, /Count: 0/);
});

test('table switch keeps smart skipping and selection bounds independent', () => {
  const long = { headers: ['Item', 'A', 'B'], rows: Array.from({ length: 8 }, (_, i) => ['R' + i, '' + i, '' + (i + 10)]) };
  for (const academicTableRepeatHeaders of [true, false]) {
    assert.doesNotMatch(speech({ blocks: [{ raw: '', table: long }] }, { ...settings, academicTableRepeatHeaders }), /R7/);
    assert.match(speech({ blocks: [{ raw: '', table: long }] }, { ...settings, tableMode: 'all', academicTableRepeatHeaders }), /R7/);
    assert.equal(speech({ blocks: [{ raw: 'Apples', table, explicitSelection: true }] }, { ...settings, academicTableRepeatHeaders }), 'Apples');
  }
});

test('cross-frame table data is bounded and excludes unknown fields', () => {
  const copy = normalizeTableData({ ...table, credential: 'synthetic-placeholder' });
  assert.deepEqual(copy, table);
  assert.notEqual(copy.rows, table.rows);
  assert.equal(normalizeTableData({ headers: ['x'], rows: [[{}]] }), null);
  assert.equal(normalizeTableData({ headers: ['x'], rows: [['x'.repeat(250001)]] }), null);
});
