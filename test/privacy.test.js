const assert = require('assert');
const path = require('path');
process.env.MNEMO_BASE = path.join(__dirname, '..', '.test-memory');
const { applyPrivacyFilter, checkBlockedFiles } = require('../src/privacy');

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  PASS: ${name}`); } catch (e) { failed++; console.log(`  FAIL: ${name} — ${e.message}`); } }

console.log('privacy tests\n');

test('redacts passwords', () => { assert(applyPrivacyFilter('password = secret123', {}).includes('[REDACTED]')); });
test('redacts bearer tokens', () => { assert(!applyPrivacyFilter('Bearer eyJhbG.test', {}).includes('eyJhbG')); });
test('redacts private keys', () => { assert(applyPrivacyFilter('-----BEGIN RSA PRIVATE KEY-----', {}).includes('[REDACTED]')); });
test('scrubs SECRET lines', () => { assert.strictEqual(applyPrivacyFilter('SECRET_KEY=abc', {}).split('\n')[0], '[REDACTED]'); });
test('truncates long text', () => { const r = applyPrivacyFilter('x'.repeat(15000), {}); assert(r.length < 15000); });
test('passes clean text', () => { assert.strictEqual(applyPrivacyFilter('clean text', {}), 'clean text'); });
test('detects .env files', () => { assert.strictEqual(checkBlockedFiles(['/project/.env', '/src/main.js']).length, 1); });
test('detects wildcard patterns', () => {
  const config = { blocked_file_patterns: ['.env', '.pem', 'credentials.json', '*secret*', '*password*'] };
  assert.strictEqual(checkBlockedFiles(['/data/my_secret_config.json'], config).length, 1);
});
test('passes safe files', () => { assert.strictEqual(checkBlockedFiles(['/src/app.js']).length, 0); });

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
