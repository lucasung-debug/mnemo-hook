const assert = require('assert');
const path = require('path');
const { execFileSync } = require('child_process');
process.env.MNEMO_BASE = path.join(__dirname, '..', '.test-memory');
const { formatBriefing, formatSilent, formatError, formatPass } = require('../src/session');

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  PASS: ${name}`); } catch (e) { failed++; console.log(`  FAIL: ${name} — ${e.message}`); } }

const FORBIDDEN_FIELDS = ['continue', 'suppressOutput', 'outputText'];

function assertValidHookJson(json, label) {
  if (json === '') return;
  let parsed;
  try { parsed = JSON.parse(json); } catch { throw new Error(`${label}: not valid JSON — got: ${json}`); }
  for (const field of FORBIDDEN_FIELDS) {
    assert.strictEqual(field in parsed, false, `${label}: forbidden field "${field}" present`);
  }
  if (parsed.decision) {
    assert.ok(['allow', 'block', 'deny'].includes(parsed.decision), `${label}: invalid decision value "${parsed.decision}"`);
  }
}

function runSession(mode, stdinData) {
  const sessionPath = path.join(__dirname, '..', 'src', 'session.js');
  return execFileSync('node', [sessionPath, mode], {
    input: stdinData,
    encoding: 'utf8',
    timeout: 5000,
  }).trim();
}

console.log('session tests — hook output schema\n');

test('formatPass returns empty string', () => {
  assert.strictEqual(formatPass(), '');
});

test('formatSilent returns empty string', () => {
  assert.strictEqual(formatSilent(), '');
});

test('formatBriefing returns valid hook JSON', () => {
  const result = formatBriefing('Hello world briefing');
  assertValidHookJson(result, 'formatBriefing');
  const parsed = JSON.parse(result);
  assert.strictEqual(parsed.decision, 'allow');
  assert.ok(parsed.reason.includes('Hello world briefing'));
});

test('formatError returns valid hook JSON', () => {
  const result = formatError('something broke');
  assertValidHookJson(result, 'formatError');
  const parsed = JSON.parse(result);
  assert.strictEqual(parsed.decision, 'allow');
  assert.ok(parsed.reason.includes('something broke'));
  assert.ok(parsed.reason.includes('[MNEMO WARNING]'));
});

test('formatBriefing has no forbidden fields', () => {
  const parsed = JSON.parse(formatBriefing('test'));
  for (const field of FORBIDDEN_FIELDS) {
    assert.strictEqual(field in parsed, false, `forbidden: ${field}`);
  }
});

test('formatError has no forbidden fields', () => {
  const parsed = JSON.parse(formatError('test'));
  for (const field of FORBIDDEN_FIELDS) {
    assert.strictEqual(field in parsed, false, `forbidden: ${field}`);
  }
});

test('formatBriefing only contains decision and reason', () => {
  const keys = Object.keys(JSON.parse(formatBriefing('test'))).sort();
  assert.deepStrictEqual(keys, ['decision', 'reason']);
});

test('formatError only contains decision and reason', () => {
  const keys = Object.keys(JSON.parse(formatError('test'))).sort();
  assert.deepStrictEqual(keys, ['decision', 'reason']);
});

test('integration: invalid mode returns empty', () => {
  const result = runSession('invalid', '{}');
  assert.strictEqual(result, '');
});

test('integration: post with error response returns valid output', () => {
  const input = JSON.stringify({ session_id: 'test-001', hook_event_name: 'PostToolUse', tool_name: 'Read', tool_input: {}, tool_response: { error: true } });
  const result = runSession('post', input);
  if (result !== '') assertValidHookJson(result, 'post-error');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
