const fs = require('fs');
const path = require('path');
const { MEMORY_BASE, loadConfig, parseYamlFrontmatter } = require('./utils');
const store = require('./store');

const STATE_DIR = path.join(MEMORY_BASE, '.state');
const RATE_FILE = path.join(STATE_DIR, 'recall_rate.json');
const STOPWORDS = new Set(['the','and','for','with','this','that','from','into','have','been','will','code','file','path']);

function loadRate() {
  try { return JSON.parse(fs.readFileSync(RATE_FILE, 'utf8')); } catch { return { hints: [] }; }
}
function saveRate(rate) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(RATE_FILE, JSON.stringify(rate), 'utf8');
}
function isRateLimited(config) {
  const max = (config && config.max_hints_per_hour) || 3;
  const rate = loadRate();
  const now = Date.now();
  rate.hints = (rate.hints || []).filter((t) => now - t < 3600000);
  return rate.hints.length >= max;
}
function recordHint() {
  const rate = loadRate();
  rate.hints = (rate.hints || []).filter((t) => Date.now() - t < 3600000);
  rate.hints.push(Date.now());
  saveRate(rate);
}

function extractKeywords(context) {
  const text = [context.file_path || '', context.command || '', ...(context.keywords || [])].join(' ');
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w))
    .filter((v, i, a) => a.indexOf(v) === i);
}

function loadTagIndex(project) {
  try {
    const content = fs.readFileSync(path.join(MEMORY_BASE, project, 'tag-index.yaml'), 'utf8');
    const index = {};
    let tag = null;
    for (const line of content.split('\n')) {
      const tm = line.match(/^([a-z0-9_-]+):$/);
      if (tm) { tag = tm[1]; index[tag] = []; continue; }
      const fm = line.match(/^\s+-\s+(.+)$/);
      if (fm && tag) index[tag].push(fm[1]);
    }
    return index;
  } catch { return null; }
}

function autoRecall(context, project) {
  const config = loadConfig();
  if (isRateLimited(config)) return [];
  const keywords = extractKeywords(context);
  if (keywords.length === 0) return [];
  const minOverlap = (config && config.min_tag_overlap_for_hint) || 2;

  const tagIndex = loadTagIndex(project);
  if (tagIndex) {
    const counts = {};
    for (const kw of keywords) for (const f of (tagIndex[kw] || [])) counts[f] = (counts[f] || 0) + 1;
    const cands = Object.entries(counts).filter(([, c]) => c >= minOverlap).sort((a, b) => b[1] - a[1]).slice(0, 3);
    if (cands.length > 0) {
      const dir = path.join(MEMORY_BASE, project, 'sessions');
      const results = cands.map(([fn, ov]) => {
        try {
          const { frontmatter, body } = parseYamlFrontmatter(fs.readFileSync(path.join(dir, fn), 'utf8'));
          return { ...frontmatter, body, _filename: fn, _overlap: ov };
        } catch { return null; }
      }).filter(Boolean);
      if (results.length > 0) { recordHint(); return results; }
    }
  }

  const entries = store.read(project, 20);
  const matches = [];
  for (const entry of entries) {
    const tags = (entry.tags || []).map((t) => t.toLowerCase());
    const overlap = keywords.filter((k) => tags.includes(k));
    if (overlap.length >= minOverlap) matches.push({ ...entry, _overlap: overlap.length });
  }
  matches.sort((a, b) => b._overlap - a._overlap);
  const results = matches.slice(0, 3);
  if (results.length > 0) recordHint();
  return results;
}

function deepSearch(query, options = {}) {
  const limit = options.limit || 10;
  const results = store.search(query, { includeArchive: true, limit: Math.max(limit * 5, 50) });
  const now = Date.now();
  return results.map((r) => {
    const days = r.date ? (now - new Date(r.date).getTime()) / 86400000 : 999;
    return { ...r, score: r.score + Math.max(0, 30 - days) / 10 };
  }).sort((a, b) => b.score - a.score).slice(0, limit);
}

function formatQuietHint(entry) {
  if (!entry) return '';
  const text = `(Memory: ${entry.title} — ${entry.date}, project: ${entry.project})`;
  return text.length > 120 ? text.slice(0, 117) + '...)' : text;
}

function formatDeepSearchResults(query, results) {
  if (results.length === 0) return `No memories found for '${query}'.`;
  const projects = [...new Set(results.map((r) => r.project))];
  const lines = [`Memory Search: "${query}"`, `Found ${results.length} results across ${projects.length} project(s).`, ''];
  results.forEach((r, i) => {
    lines.push(`${i + 1}. [${r.type}] ${r.title}`);
    lines.push(`   Project: ${r.project} | Date: ${r.date} | Tags: ${(r.tags || []).join(', ')}`);
    if (r.excerpt) lines.push(`   "${r.excerpt}"`);
  });
  return lines.join('\n');
}

module.exports = { autoRecall, deepSearch, extractKeywords, formatQuietHint, formatDeepSearchResults, isRateLimited };
