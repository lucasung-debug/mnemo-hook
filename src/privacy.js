const { loadConfig } = require('./utils');

const MAX_BODY_LENGTH = 10000;
const CONTENT_TYPE_KEYWORDS = [
  'PASSWORD', 'SECRET', 'TOKEN', 'API_KEY', 'KEY', 'CREDENTIAL',
  'PRIVATE_KEY', 'ACCESS_KEY', 'AUTH_TOKEN', 'CLIENT_SECRET',
  'DATABASE_URL', 'WEBHOOK_SECRET', 'SIGNING_KEY',
];

function getDefaultPatterns() {
  return [
    '(?i)(password|secret|token|key|credential|api_key)\\s*[=:]\\s*\\S+',
    '(?i)bearer\\s+[A-Za-z0-9_\\-\\.]+',
    '(?i)-----BEGIN (RSA|EC|OPENSSH) PRIVATE KEY-----',
    'ghp_[A-Za-z0-9]{20,}',
    'github_pat_[A-Za-z0-9_]{20,}',
    'AKIA[0-9A-Z]{16}',
    '(?i)sk-ant-[A-Za-z0-9_\\-]{10,}',
    '(?i)sk-proj-[A-Za-z0-9_\\-]{10,}',
    '(?i)xox[baprs]-[0-9A-Za-z\\-]+',
    'eyJ[A-Za-z0-9_\\-]{10,}\\.[A-Za-z0-9_\\-]{10,}\\.[A-Za-z0-9_\\-]{10,}',
  ];
}

function isSafePattern(pattern) {
  return !/(\([^)]*[+*][^)]*\)\s*[+*])/.test(pattern);
}

function applyPrivacyFilter(text, config) {
  if (!text) return '';
  let result = text;
  const cfg = config || loadConfig();
  const defaults = getDefaultPatterns();
  const custom = cfg.blocked_patterns || [];
  const merged = [...defaults, ...custom.filter((p) => !defaults.includes(p))];
  result = scrubPatterns(result, merged);
  result = scrubContentTypeLines(result);
  result = enforceMaxLength(result);
  return result;
}

function scrubPatterns(text, patterns) {
  let result = text;
  for (let pattern of patterns) {
    try {
      let flags = 'g';
      if (pattern.startsWith('(?i)')) { pattern = pattern.slice(4); flags = 'gi'; }
      if (!isSafePattern(pattern)) continue;
      result = result.replace(new RegExp(pattern, flags), '[REDACTED]');
    } catch {}
  }
  return result;
}

function scrubContentTypeLines(text) {
  return text.split('\n').map((line) => {
    const trimmed = line.trimStart().toUpperCase();
    for (const kw of CONTENT_TYPE_KEYWORDS) {
      if (trimmed.startsWith(kw)) return '[REDACTED]';
    }
    return line;
  }).join('\n');
}

function enforceMaxLength(text) {
  if (text.length <= MAX_BODY_LENGTH) return text;
  return text.slice(0, MAX_BODY_LENGTH) + '\n[TRUNCATED]';
}

function checkBlockedFiles(filePaths, config) {
  const cfg = config || loadConfig();
  const patterns = cfg.blocked_file_patterns || ['.env', '.pem', 'credentials.json'];
  const blocked = [];
  for (const fp of filePaths || []) {
    const name = fp.split(/[/\\]/).pop();
    for (const pattern of patterns) {
      const core = pattern.replace(/^\*|\*$/g, '');
      const isContains = pattern.startsWith('*') && pattern.endsWith('*');
      const isPrefix = pattern.endsWith('*') && !pattern.startsWith('*');
      const isSuffix = pattern.startsWith('*') && !pattern.endsWith('*');
      if (isContains && name.includes(core)) blocked.push(fp);
      else if (isPrefix && name.startsWith(core)) blocked.push(fp);
      else if (isSuffix && name.endsWith(core)) blocked.push(fp);
      else if (!pattern.includes('*') && name === pattern) blocked.push(fp);
    }
  }
  return blocked;
}

module.exports = { applyPrivacyFilter, checkBlockedFiles };
