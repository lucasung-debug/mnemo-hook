const fs = require('fs');
const path = require('path');

const MEMORY_BASE = process.env.MNEMO_BASE
  || path.join(process.env.HOME || process.env.USERPROFILE, '.claude', 'memory');

function generateFilename(type, title, date, id) {
  const d = date instanceof Date ? date : new Date(date);
  const dateStr = d.toISOString().slice(0, 10);
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 40)
    .replace(/-$/, '');
  const suffix = id ? `-${String(id).slice(-6)}` : `-${process.hrtime.bigint().toString().slice(-6)}`;
  return `${dateStr}-${type}-${slug}${suffix}.md`;
}

function parseYamlFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content };

  const raw = match[1];
  const body = match[2];
  const frontmatter = {};
  let currentKey = null;
  let inArray = false;

  for (const line of raw.split(/\r?\n/)) {
    if (/^\s*-\s+/.test(line) && currentKey && inArray) {
      frontmatter[currentKey].push(line.replace(/^\s*-\s+/, '').replace(/^["']|["']$/g, ''));
      continue;
    }
    const kvMatch = line.match(/^(\w[\w_]*)\s*:\s*(.*)$/);
    if (kvMatch) {
      currentKey = kvMatch[1];
      const val = kvMatch[2].trim();
      if (val === '' || val === '[]') { frontmatter[currentKey] = []; inArray = true; }
      else if (val === 'true') { frontmatter[currentKey] = true; inArray = false; }
      else if (val === 'false') { frontmatter[currentKey] = false; inArray = false; }
      else if (/^\d+$/.test(val)) { frontmatter[currentKey] = parseInt(val, 10); inArray = false; }
      else { frontmatter[currentKey] = val.replace(/^["']|["']$/g, ''); inArray = false; }
    }
  }
  return { frontmatter, body };
}

function parseSimpleYaml(content) {
  const config = {};
  let currentKey = null;
  let inArray = false;
  for (const line of content.split(/\r?\n/)) {
    if (/^\s*#/.test(line) || line.trim() === '') continue;
    if (/^\s+-\s+/.test(line) && currentKey && inArray) {
      config[currentKey].push(line.replace(/^\s*-\s+/, '').replace(/^["']|["']$/g, ''));
      continue;
    }
    const kvMatch = line.match(/^(\w[\w_]*)\s*:\s*(.*)$/);
    if (kvMatch) {
      currentKey = kvMatch[1];
      const val = kvMatch[2].trim();
      if (val === '' || val === '[]') { config[currentKey] = []; inArray = true; }
      else if (val === '{}') { config[currentKey] = {}; inArray = false; }
      else if (val === 'true') { config[currentKey] = true; inArray = false; }
      else if (val === 'false') { config[currentKey] = false; inArray = false; }
      else if (val === 'null') { config[currentKey] = null; inArray = false; }
      else if (/^\d+$/.test(val)) { config[currentKey] = parseInt(val, 10); inArray = false; }
      else { config[currentKey] = val.replace(/^["']|["']$/g, ''); inArray = false; }
    }
  }
  return config;
}

function validateMemoryEntry(entry) {
  const required = ['id', 'type', 'project', 'date', 'title', 'tags'];
  const validTypes = ['decision', 'progress', 'connection', 'session'];
  const errors = [];
  for (const field of required) {
    if (!entry[field]) errors.push(`Missing required field: ${field}`);
  }
  if (entry.type && !validTypes.includes(entry.type)) {
    errors.push(`Invalid type: ${entry.type}. Must be one of: ${validTypes.join(', ')}`);
  }
  if (entry.tags && !Array.isArray(entry.tags)) errors.push('tags must be an array');
  return { valid: errors.length === 0, errors };
}

function sanitizeProjectName(name) {
  return (name || 'unknown')
    .replace(/[/\\]/g, '')
    .replace(/\.\./g, '')
    .replace(/[^a-z0-9_\-]/gi, '-')
    .toLowerCase()
    .slice(0, 64);
}

function resolveProject(cwd) {
  let dir = cwd || process.cwd();
  while (dir && dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'CLAUDE.md')) || fs.existsSync(path.join(dir, '.git'))) {
      return sanitizeProjectName(path.basename(dir));
    }
    dir = path.dirname(dir);
  }
  return sanitizeProjectName(path.basename(cwd || process.cwd()));
}

function loadConfig() {
  const configPath = process.env.MNEMO_CONFIG || path.join(MEMORY_BASE, 'config.yaml');
  try { return parseSimpleYaml(fs.readFileSync(configPath, 'utf8')); }
  catch { return {}; }
}

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    let resolved = false;
    const MAX_STDIN = 1024 * 1024;
    const timer = setTimeout(() => { if (!resolved) { resolved = true; resolve(null); } }, 3000);
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
      if (data.length > MAX_STDIN) { if (!resolved) { resolved = true; clearTimeout(timer); resolve(null); } }
    });
    process.stdin.on('end', () => {
      clearTimeout(timer);
      if (!resolved) {
        resolved = true;
        try { resolve(JSON.parse(data)); } catch { resolve(null); }
      }
    });
  });
}

module.exports = {
  MEMORY_BASE, generateFilename, parseYamlFrontmatter, parseSimpleYaml,
  validateMemoryEntry, sanitizeProjectName, resolveProject, loadConfig, readStdin,
};
