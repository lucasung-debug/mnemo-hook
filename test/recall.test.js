const assert = require('assert');
const path = require('path');
process.env.MNEMO_BASE = path.join(__dirname, '..', '.test-memory');
const recall = require('../src/recall');

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  PASS: ${name}`); } catch (e) { failed++; console.log(`  FAIL: ${name} — ${e.message}`); } }

console.log('recall tests\n');

test('extractKeywords filters stopwords', () => {
  const kw = recall.extractKeywords({ file_path: '', command: 'the config deploy react', keywords: [] });
  assert(!kw.includes('the'));
  assert(kw.includes('config'));
  assert(kw.includes('react'));
});
test('extractKeywords deduplicates', () => {
  const kw = recall.extractKeywords({ file_path: 'test', command: 'test', keywords: ['test'] });
  assert.strictEqual(kw.filter((w) => w === 'test').length, 1);
});
test('extractKeywords from file path', () => {
  assert(recall.extractKeywords({ file_path: '/src/session.js', command: '', keywords: [] }).includes('src'));
});
test('autoRecall returns array', () => { assert(Array.isArray(recall.autoRecall({}, 'nonexistent'))); });
test('deepSearch returns scored array', () => {
  const r = recall.deepSearch('test');
  assert(Array.isArray(r));
  if (r.length > 0) assert(typeof r[0].score === 'number');
});
test('deepSearch respects limit', () => { assert(recall.deepSearch('test', { limit: 1 }).length <= 1); });
test('formatQuietHint string under 120', () => {
  const h = recall.formatQuietHint({ title: 'T', date: '2026-01-01', project: 'p' });
  assert(typeof h === 'string' && h.length <= 120);
});
test('formatQuietHint null', () => { assert.strictEqual(recall.formatQuietHint(null), ''); });
test('formatDeepSearchResults empty', () => { assert(recall.formatDeepSearchResults('q', []).includes('No memories')); });
test('formatDeepSearchResults non-empty', () => {
  const out = recall.formatDeepSearchResults('q', [{ type: 's', title: 'T', project: 'p', date: '2026-01-01', tags: ['a'] }]);
  assert(out.includes('Found 1'));
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
