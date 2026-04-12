const fs = require('fs');
const path = require('path');
const { MEMORY_BASE, resolveProject, loadConfig, readStdin, parseYamlFrontmatter } = require('./utils');
const store = require('./store');
const graphSync = require('./graph-sync');
const recall = require('./recall');

const STATE_DIR = path.join(MEMORY_BASE, '.state');
const STATE_FILE = path.join(STATE_DIR, 'current_session.json');

function formatBriefing(outputText) {
  return JSON.stringify({ continue: true, suppressOutput: false, decision: 'allow', reason: 'New session detected.', outputText });
}
function formatSilent() { return JSON.stringify({ continue: true, suppressOutput: true }); }
function formatError(message) { return JSON.stringify({ continue: true, suppressOutput: false, decision: 'allow', reason: message, outputText: `[MNEMO WARNING] ${message}` }); }
function formatPass() { return JSON.stringify({ continue: true, suppressOutput: true }); }

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch { return { last_session_id: null, write_count: 0, saves_this_session: 0 }; }
}
function saveState(state) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function isNewSession(sessionId, state) { return state.last_session_id !== sessionId; }

function buildBriefingText(project, config) {
  const maxLines = (config && config.briefing_max_lines) || 15;
  const lookback = (config && config.briefing_lookback_sessions) || 2;
  const entries = store.read(project, lookback + 5);
  if (entries.length === 0) return null;

  const sessions = entries.filter((e) => e.type === 'session');
  const openItems = entries.filter((e) => e.open === true || e.open === 'true');
  const lines = ['', `  Mnemo Briefing — ${project}`, `  ${new Date().toISOString().slice(0, 10)} | ${entries.length} memories loaded`, ''];

  if (sessions.length > 0) {
    const last = sessions[0];
    lines.push(`Last session (${last.date}):`);
    for (const bl of (last.body || '').split('\n').filter((l) => l.trim()).slice(0, 3))
      lines.push(`  - ${bl.replace(/^#+\s*/, '').trim()}`);
    lines.push('');
  }
  if (openItems.length > 0) {
    lines.push('Open items:');
    for (const item of openItems.slice(0, 3)) lines.push(`  - ${item.title} (from ${item.date})`);
    lines.push('');
  }
  lines.push('Type "recall {topic}" for deeper search.');
  return lines.slice(0, maxLines).join('\n');
}

function checkGitCommit(event) {
  if (event.tool_name !== 'Bash') return null;
  const cmd = (event.tool_input && event.tool_input.command) || '';
  if (!/^git\s+commit/i.test(cmd)) return null;
  const output = (event.tool_response && event.tool_response.output) || '';
  const hashMatch = output.match(/\[[\w/.-]+\s+([a-f0-9]{7,})\]/);
  if (!hashMatch) return null;
  return { type: 'progress', title: `Git commit ${hashMatch[1]}`, tags: ['git', 'commit', 'auto-save'], body: `Commit: ${hashMatch[1]}\nCommand: ${cmd}\n\n${output.slice(0, 500)}`, commit: hashMatch[1] };
}

function checkFileWriteThreshold(event, state, config) {
  const threshold = (config && config.file_write_threshold) || 3;
  if (event.tool_name !== 'Write' && event.tool_name !== 'Edit') return false;
  state.write_count = (state.write_count || 0) + 1;
  return state.write_count >= threshold && state.write_count % threshold === 0;
}

function checkDecisionPhrases(event, config) {
  const phrases = (config && config.decision_trigger_phrases) || ['decided to', "we'll use", 'going with', 'architecture decision', 'key decision', 'tradeoff', 'important:', 'note for next time'];
  const text = [(event.tool_input && event.tool_input.new_string) || '', (event.tool_input && event.tool_input.command) || '', (event.tool_input && event.tool_input.content) || ''].join(' ').toLowerCase();
  for (const phrase of phrases) {
    if (text.includes(phrase.toLowerCase())) {
      const idx = text.indexOf(phrase.toLowerCase());
      const snippet = text.slice(Math.max(0, idx - 20), idx + phrase.length + 60).trim();
      return { type: 'decision', title: `Decision: ${snippet.slice(0, 60)}`, tags: ['decision', 'auto-detected'], body: `Trigger phrase: "${phrase}"\n\n${snippet}` };
    }
  }
  return null;
}

function buildSessionDigest(project) {
  const sessionsDir = path.join(MEMORY_BASE, project, 'sessions');
  let files;
  try { files = fs.readdirSync(sessionsDir).filter((f) => f.endsWith('.md')); } catch { return null; }
  if (files.length === 0) return null;

  const partials = [];
  const partialFiles = [];
  for (const f of files) {
    try {
      const content = fs.readFileSync(path.join(sessionsDir, f), 'utf8');
      const { frontmatter, body } = parseYamlFrontmatter(content);
      if (frontmatter.partial === true || frontmatter.partial === 'true') {
        partials.push({ ...frontmatter, body, _filename: f });
        partialFiles.push(f);
      }
    } catch {}
  }
  if (partials.length === 0) return null;

  const decisions = partials.filter((p) => p.type === 'decision');
  const progress = partials.filter((p) => p.type === 'progress');
  const bodyLines = ['## Session Summary', `Merged from ${partials.length} partial saves.\n`];
  if (decisions.length > 0) { bodyLines.push('## Decisions'); decisions.forEach((d, i) => bodyLines.push(`${i + 1}. ${d.title}`)); bodyLines.push(''); }
  if (progress.length > 0) { bodyLines.push('## Progress'); progress.forEach((p) => bodyLines.push(`- ${p.title}`)); bodyLines.push(''); }

  const allTags = [...new Set(partials.flatMap((p) => p.tags || []))];
  const digest = { type: 'session', title: `Session digest — ${project}`, tags: ['session', 'digest', ...allTags.slice(0, 5)], body: bodyLines.join('\n'), decisions_count: decisions.length, progress_count: progress.length, partial_saves: partials.length };

  return { digest, partialFiles, sessionsDir };
}

function rebuildTagIndex(project) {
  const entries = store.read(project, 500);
  const index = {};
  for (const entry of entries) for (const tag of (entry.tags || [])) { const t = tag.toLowerCase(); if (!index[t]) index[t] = []; index[t].push(entry._filename); }
  const lines = [];
  for (const [tag, files] of Object.entries(index).sort((a, b) => a[0].localeCompare(b[0]))) { lines.push(`${tag}:`); for (const f of files) lines.push(`  - ${f}`); }
  fs.writeFileSync(path.join(MEMORY_BASE, project, 'tag-index.yaml'), lines.join('\n') + '\n', 'utf8');
}

function parseEvent(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const event = raw.event || raw;
  if (!event.hook_event_name && !event.session_id) return null;
  return { session_id: event.session_id || 'unknown', hook_event_name: event.hook_event_name || 'unknown', tool_name: event.tool_name || '', tool_input: event.tool_input || {}, tool_response: event.tool_response || {} };
}

async function handlePreToolUse(event, state, config) {
  const project = resolveProject((event.tool_input && event.tool_input.file_path) ? path.dirname(event.tool_input.file_path) : process.cwd());
  if (isNewSession(event.session_id, state)) {
    state.last_session_id = event.session_id;
    state.write_count = 0;
    state.saves_this_session = 0;
    state.project = project;
    const digestResult = buildSessionDigest(project);
    if (digestResult) {
      const { digest, partialFiles, sessionsDir } = digestResult;
      const date = new Date().toISOString().slice(0, 10);
      const entry = { id: `${project}-${date}-session-${String(Date.now()).slice(-4)}`, project, date, session: 1, ...digest };
      store.write(entry);
      for (const f of partialFiles) { try { fs.unlinkSync(path.join(sessionsDir, f)); } catch {} }
      try { graphSync.syncAndGenerate(entry); } catch {}
    }
    try { rebuildTagIndex(project); } catch {}
    saveState(state);
    const briefing = buildBriefingText(project, config);
    if (briefing) { process.stdout.write(formatBriefing(briefing)); return; }
  }
  process.stdout.write(formatPass());
}

async function handlePostToolUse(event, state, config) {
  if (event.tool_response && event.tool_response.error) { process.stdout.write(formatPass()); return; }
  const project = state.project || resolveProject(process.cwd());
  const date = new Date().toISOString().slice(0, 10);
  let saved = false;

  const commitEntry = checkGitCommit(event);
  if (commitEntry) { store.write({ id: `${project}-${date}-partial-${process.hrtime.bigint().toString().slice(-6)}`, project, date, session: 1, partial: true, ...commitEntry }); saved = true; }
  if (checkFileWriteThreshold(event, state, config)) { store.write({ id: `${project}-${date}-partial-${process.hrtime.bigint().toString().slice(-6)}`, type: 'progress', project, date, session: 1, partial: true, title: `Progress checkpoint (${state.write_count} writes)`, tags: ['progress', 'auto-save'], body: `File write threshold reached (${state.write_count} writes).` }); saved = true; }
  const decisionEntry = checkDecisionPhrases(event, config);
  if (decisionEntry && !saved) { store.write({ id: `${project}-${date}-partial-${process.hrtime.bigint().toString().slice(-6)}`, project, date, session: 1, partial: true, ...decisionEntry }); saved = true; }

  saveState(state);
  try {
    const context = { file_path: (event.tool_input && event.tool_input.file_path) || '', command: (event.tool_input && event.tool_input.command) || '', keywords: (event.tool_input && event.tool_input.pattern) ? [event.tool_input.pattern] : [] };
    const hints = recall.autoRecall(context, project);
    if (hints.length > 0) { process.stdout.write(JSON.stringify({ continue: true, suppressOutput: false, outputText: recall.formatQuietHint(hints[0]) })); return; }
  } catch {}
  process.stdout.write(formatSilent());
}

async function handleUserPromptSubmit(raw) {
  const prompt = (raw && (raw.user_prompt || (raw.event && raw.event.user_prompt))) || '';
  const m = prompt.match(/^(?:recall|search memory(?: for)?)\s+(.+)/i);
  if (!m) { process.stdout.write(formatPass()); return; }
  const results = recall.deepSearch(m[1].trim());
  process.stdout.write(JSON.stringify({ continue: true, suppressOutput: false, outputText: recall.formatDeepSearchResults(m[1].trim(), results) }));
}

async function main() {
  const mode = process.argv[2];
  if (mode !== 'pre' && mode !== 'post' && mode !== 'prompt') { process.stdout.write(formatPass()); return; }
  let raw;
  try { raw = await readStdin(); } catch { process.stdout.write(formatError('Failed to read stdin')); return; }
  if (mode === 'prompt') { try { await handleUserPromptSubmit(raw); } catch (err) { process.stdout.write(formatError(`Prompt error: ${err.message}`)); } return; }
  const event = parseEvent(raw);
  if (!event) { process.stdout.write(formatPass()); return; }
  const state = loadState();
  const config = loadConfig();
  try {
    if (mode === 'pre') await handlePreToolUse(event, state, config);
    else await handlePostToolUse(event, state, config);
  } catch (err) { process.stdout.write(formatError(`Hook error: ${err.message}`)); }
}

if (require.main === module) main();

module.exports = { parseEvent, formatBriefing, formatSilent, formatError, formatPass, isNewSession, buildBriefingText, checkGitCommit, checkFileWriteThreshold, checkDecisionPhrases, buildSessionDigest };
