const fs = require('fs');
const path = require('path');
const { MEMORY_BASE, generateFilename, validateMemoryEntry, sanitizeProjectName, loadConfig, parseYamlFrontmatter } = require('./utils');
const { applyPrivacyFilter, checkBlockedFiles } = require('./privacy');

const SYNC_ERRORS_LOG = path.join(MEMORY_BASE, 'sync-errors.log');

function buildFrontmatter(entry) {
  const lines = ['---'];
  lines.push(`id: "${entry.id}"`);
  const q = (v) => String(v || '').replace(/"/g, '');
  lines.push(`type: "${q(entry.type)}"`);
  lines.push(`project: "${q(entry.project)}"`);
  lines.push(`date: "${q(entry.date)}"`);
  lines.push(`session: ${entry.session || 1}`);
  lines.push(`title: "${q(entry.title)}"`);
  lines.push('tags:');
  for (const tag of entry.tags || []) lines.push(`  - "${q(tag)}"`);
  lines.push(`status: "${q(entry.status || 'active')}"`);
  lines.push(`open: ${entry.open || false}`);
  if (entry.partial) lines.push(`partial: true`);
  if (entry.commit) lines.push(`commit: ${entry.commit}`);
  if (entry.decisions_count != null) lines.push(`decisions_count: ${entry.decisions_count}`);
  if (entry.progress_count != null) lines.push(`progress_count: ${entry.progress_count}`);
  if (entry.partial_saves != null) lines.push(`partial_saves: ${entry.partial_saves}`);
  lines.push('---');
  return lines.join('\n');
}

function resolveObsidianMirrorDir(project, config) {
  const vaultBase = config && config.obsidian_vault;
  if (!vaultBase) return null;
  return path.join(vaultBase, project, 'sessions');
}

function logSyncError(message) {
  try { fs.appendFileSync(SYNC_ERRORS_LOG, `[${new Date().toISOString()}] ${message}\n`, 'utf8'); } catch {}
}

function write(entry) {
  const validation = validateMemoryEntry(entry);
  if (!validation.valid) throw new Error(`Invalid memory entry: ${validation.errors.join('; ')}`);
  entry.project = sanitizeProjectName(entry.project);

  const config = loadConfig();
  if (entry.files_modified) {
    const blocked = checkBlockedFiles(entry.files_modified, config);
    if (blocked.length > 0) entry.body = `> Blocked files accessed: ${blocked.join(', ')}\n\n${entry.body || ''}`;
  }

  const sanitizedBody = applyPrivacyFilter(entry.body || '', config);
  entry.title = applyPrivacyFilter(entry.title || '', config).replace(/\n/g, ' ').slice(0, 120);
  const fileContent = `${buildFrontmatter(entry)}\n\n${sanitizedBody}\n`;
  const filename = generateFilename(entry.type, entry.title, entry.date, entry.id);
  const projectDir = path.join(MEMORY_BASE, entry.project, 'sessions');
  fs.mkdirSync(projectDir, { recursive: true });
  const primaryPath = path.join(projectDir, filename);
  fs.writeFileSync(primaryPath, fileContent, 'utf8');

  const mirrorDir = resolveObsidianMirrorDir(entry.project, config);
  if (mirrorDir) {
    try {
      fs.mkdirSync(mirrorDir, { recursive: true });
      fs.writeFileSync(path.join(mirrorDir, filename), fileContent, 'utf8');
    } catch (err) { logSyncError(`Mirror failed for ${filename}: ${err.message}`); }
  }
  return primaryPath;
}

function read(project, n = 5) {
  const dir = path.join(MEMORY_BASE, project, 'sessions');
  let files;
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort().reverse().slice(0, n); }
  catch { return []; }
  return files.map((filename) => {
    const { frontmatter, body } = parseYamlFrontmatter(fs.readFileSync(path.join(dir, filename), 'utf8'));
    return { ...frontmatter, body, _filename: filename };
  });
}

function list(project) {
  const dir = path.join(MEMORY_BASE, project, 'sessions');
  try { return fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort().reverse(); }
  catch { return []; }
}

function search(query, options = {}) {
  const dirs = [];
  if (options.project) {
    dirs.push(path.join(MEMORY_BASE, options.project, 'sessions'));
    if (options.includeArchive) dirs.push(path.join(MEMORY_BASE, options.project, 'archive'));
  } else {
    try {
      for (const e of fs.readdirSync(MEMORY_BASE, { withFileTypes: true })) {
        if (e.isDirectory() && e.name !== 'graph' && e.name !== '.state') {
          dirs.push(path.join(MEMORY_BASE, e.name, 'sessions'));
          if (options.includeArchive) dirs.push(path.join(MEMORY_BASE, e.name, 'archive'));
        }
      }
    } catch { return []; }
  }

  const results = [];
  const lq = query.toLowerCase();
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  for (const dir of dirs) {
    let files;
    try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.md')); } catch { continue; }
    for (const filename of files) {
      const { frontmatter, body } = parseYamlFrontmatter(fs.readFileSync(path.join(dir, filename), 'utf8'));
      const tagMatch = (frontmatter.tags || []).filter((t) => t.toLowerCase().includes(lq)).length;
      const titleMatch = (frontmatter.title || '').toLowerCase().includes(lq) ? 1 : 0;
      const bodyMatches = (body.toLowerCase().match(new RegExp(esc(lq), 'g')) || []).length;
      if (!tagMatch && !titleMatch && !bodyMatches) continue;
      const score = (tagMatch * 3) + (titleMatch * 2) + bodyMatches;
      const idx = body.toLowerCase().indexOf(lq);
      results.push({
        type: frontmatter.type, title: frontmatter.title, project: frontmatter.project,
        date: frontmatter.date, tags: frontmatter.tags, score,
        excerpt: idx >= 0 ? body.slice(Math.max(0, idx - 40), idx + query.length + 40).trim() : '',
        file_path: path.join(dir, filename),
      });
    }
  }
  return results.sort((a, b) => b.score - a.score).slice(0, options.limit || 10);
}

module.exports = { write, read, list, search };
