const assert = require('assert');
const path = require('path');
process.env.MNEMO_BASE = path.join(__dirname, '..', '.test-memory');
const gs = require('../src/graph-sync');

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  PASS: ${name}`); } catch (e) { failed++; console.log(`  FAIL: ${name} — ${e.message}`); } }

console.log('graph-sync tests\n');

test('parseGraphYaml empty', () => { const g = gs.parseGraphYaml(''); assert.deepStrictEqual(g.nodes, []); });
test('parseGraphYaml nodes+edges', () => {
  const g = gs.parseGraphYaml('version: 1\nlast_updated: 2026-04-12\n\nnodes:\n  - id: "a"\n    type: project\n    label: "T"\n\nedges:\n  - id: "e1"\n    from: "a"\n    to: "b"\n    relationship: depends_on\n');
  assert.strictEqual(g.nodes.length, 1);
  assert.strictEqual(g.edges.length, 1);
});
test('parseGraphYaml nodes-only', () => {
  const g = gs.parseGraphYaml('version: 1\nlast_updated: 2026-04-12\n\nnodes:\n  - id: "a"\n    type: project\n    label: "T"\n');
  assert.strictEqual(g.nodes.length, 1);
});
test('serializeYaml roundtrip', () => {
  const orig = { version: 1, last_updated: '2026-04-12', nodes: [{ id: 'n1', type: 'decision', label: 'D1', project: 'px' }], edges: [{ id: 'e1', from: 'n1', to: 'n2', relationship: 'blocks' }] };
  const parsed = gs.parseGraphYaml(gs.serializeYaml(orig));
  assert.strictEqual(parsed.nodes[0].id, 'n1');
  assert.strictEqual(parsed.edges[0].from, 'n1');
});
test('detectCycles finds cycle', () => {
  assert(gs.detectCycles({ nodes: [{ id: 'A' }, { id: 'B' }], edges: [{ from: 'A', to: 'B' }, { from: 'B', to: 'A' }] }).length > 0);
});
test('detectCycles acyclic', () => {
  assert.strictEqual(gs.detectCycles({ nodes: [{ id: 'A' }, { id: 'B' }], edges: [{ from: 'A', to: 'B' }] }).length, 0);
});
test('generateCanvas creates nodes', () => {
  const c = gs.generateCanvas({ nodes: [{ id: 'p1', type: 'project', label: 'P', status: 'active' }], edges: [] }, {});
  assert.strictEqual(c.nodes.length, 1);
  assert(c.nodes[0].width > 0);
});
test('generateCanvas preserves positions', () => {
  const c = gs.generateCanvas({ nodes: [{ id: 'a', type: 'task', label: 'T' }], edges: [] }, { a: { x: 99, y: 88 } });
  assert.strictEqual(c.nodes[0].x, 99);
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
