const assert = require('assert');
const path = require('path');
process.env.MNEMO_BASE = path.join(__dirname, '..', '.test-memory');
const { generateFilename, parseYamlFrontmatter, validateMemoryEntry, parseSimpleYaml } = require('../src/utils');

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  PASS: ${name}`); } catch (e) { failed++; console.log(`  FAIL: ${name} — ${e.message}`); } }

console.log('utils tests\n');

test('generateFilename format with suffix', () => { assert.match(generateFilename('session', 'My Title', '2026-04-12', 'abc123'), /^2026-04-12-session-my-title-abc123\.md$/); });
test('generateFilename slugifies', () => { assert.match(generateFilename('decision', 'Use React (not Vue)', '2026-01-01', 'x1'), /^2026-01-01-decision-use-react-not-vue-x1\.md$/); });
test('generateFilename truncates', () => { const r = generateFilename('progress', 'a'.repeat(60), '2026-01-01'); assert(r.length < 80); });
test('generateFilename auto-suffix without id', () => { const r = generateFilename('session', 'Test', '2026-01-01'); assert.match(r, /^2026-01-01-session-test-\d{6}\.md$/); });

test('parseYamlFrontmatter basic', () => {
  const { frontmatter, body } = parseYamlFrontmatter('---\ntitle: Hello\ntags:\n  - a\n  - b\n---\nBody');
  assert.strictEqual(frontmatter.title, 'Hello');
  assert.deepStrictEqual(frontmatter.tags, ['a', 'b']);
  assert.strictEqual(body, 'Body');
});
test('parseYamlFrontmatter booleans and numbers', () => {
  const { frontmatter } = parseYamlFrontmatter('---\nopen: true\nsession: 3\n---\n');
  assert.strictEqual(frontmatter.open, true);
  assert.strictEqual(frontmatter.session, 3);
});
test('parseYamlFrontmatter no frontmatter', () => {
  const { frontmatter, body } = parseYamlFrontmatter('Just text');
  assert.deepStrictEqual(frontmatter, {});
  assert.strictEqual(body, 'Just text');
});

test('parseSimpleYaml handles all types', () => {
  const cfg = parseSimpleYaml('version: 1\nflag: true\nval: null\nitems:\n  - a\n  - b');
  assert.strictEqual(cfg.version, 1);
  assert.strictEqual(cfg.flag, true);
  assert.strictEqual(cfg.val, null);
  assert.deepStrictEqual(cfg.items, ['a', 'b']);
});

test('validateMemoryEntry accepts valid', () => {
  const { valid } = validateMemoryEntry({ id: '1', type: 'session', project: 'x', date: '2026-01-01', title: 'T', tags: ['a'] });
  assert.strictEqual(valid, true);
});
test('validateMemoryEntry rejects missing', () => { assert.strictEqual(validateMemoryEntry({ id: '1' }).valid, false); });
test('validateMemoryEntry rejects bad type', () => { assert.strictEqual(validateMemoryEntry({ id: '1', type: 'bad', project: 'x', date: '2026-01-01', title: 'T', tags: [] }).valid, false); });

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
