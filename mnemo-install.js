#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const HOME = process.env.HOME || process.env.USERPROFILE;
const HOOKS_DIR = path.join(HOME, '.claude', 'hooks');
const MEMORY_DIR = path.join(HOME, '.claude', 'memory');
const CONFIG_DEST = path.join(MEMORY_DIR, 'config.yaml');
const SETTINGS_FILE = path.join(HOME, '.claude', 'settings.json');

const SRC_DIR = path.join(__dirname, 'src');
const CONFIG_SRC = path.join(__dirname, 'config', 'config.example.yaml');

const FILES = ['utils.js', 'privacy.js', 'store.js', 'recall.js', 'graph-sync.js', 'session.js'];

function log(msg) { console.log(`[mnemo] ${msg}`); }

function copyFiles() {
  fs.mkdirSync(HOOKS_DIR, { recursive: true });
  for (const file of FILES) {
    const src = path.join(SRC_DIR, file);
    const dest = path.join(HOOKS_DIR, `mnemo-${file}`);
    fs.copyFileSync(src, dest);
    log(`Copied ${file} -> ${dest}`);
  }

  const sessionDest = path.join(HOOKS_DIR, 'mnemo-session.js');
  let sessionContent = fs.readFileSync(sessionDest, 'utf8');
  sessionContent = sessionContent.replace(/require\('\.\/utils'\)/g, "require('./mnemo-utils')");
  sessionContent = sessionContent.replace(/require\('\.\/privacy'\)/g, "require('./mnemo-privacy')");
  sessionContent = sessionContent.replace(/require\('\.\/store'\)/g, "require('./mnemo-store')");
  sessionContent = sessionContent.replace(/require\('\.\/recall'\)/g, "require('./mnemo-recall')");
  sessionContent = sessionContent.replace(/require\('\.\/graph-sync'\)/g, "require('./mnemo-graph-sync')");
  fs.writeFileSync(sessionDest, sessionContent, 'utf8');

  for (const file of FILES.filter((f) => f !== 'session.js')) {
    const dest = path.join(HOOKS_DIR, `mnemo-${file}`);
    let content = fs.readFileSync(dest, 'utf8');
    content = content.replace(/require\('\.\/utils'\)/g, "require('./mnemo-utils')");
    content = content.replace(/require\('\.\/privacy'\)/g, "require('./mnemo-privacy')");
    content = content.replace(/require\('\.\/store'\)/g, "require('./mnemo-store')");
    fs.writeFileSync(dest, content, 'utf8');
  }
}

function setupConfig() {
  fs.mkdirSync(MEMORY_DIR, { recursive: true });
  fs.mkdirSync(path.join(MEMORY_DIR, 'graph'), { recursive: true });
  fs.mkdirSync(path.join(MEMORY_DIR, '.state'), { recursive: true });
  if (!fs.existsSync(CONFIG_DEST)) {
    fs.copyFileSync(CONFIG_SRC, CONFIG_DEST);
    log(`Config created at ${CONFIG_DEST}`);
  } else {
    log('Config already exists, skipping.');
  }
}

function registerHooks() {
  let settings;
  try {
    settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') {
      log(`ERROR: Cannot parse ${SETTINGS_FILE}: ${err.message}. Aborting to avoid data loss.`);
      process.exit(1);
    }
    settings = {};
  }

  if (!settings.hooks) settings.hooks = {};
  const hookCmd = `node ${path.join(HOOKS_DIR, 'mnemo-session.js').replace(/\\/g, '/')}`;

  const preHooks = settings.hooks.PreToolUse || [];
  const hasPreHook = preHooks.some((h) => h.hooks && h.hooks.some((hh) => hh.command && hh.command.includes('mnemo-session')));
  if (!hasPreHook) {
    preHooks.push({ matcher: '', hooks: [{ type: 'command', command: `${hookCmd} pre` }] });
    settings.hooks.PreToolUse = preHooks;
    log('Registered PreToolUse hook.');
  }

  const postHooks = settings.hooks.PostToolUse || [];
  const hasPostHook = postHooks.some((h) => h.hooks && h.hooks.some((hh) => hh.command && hh.command.includes('mnemo-session')));
  if (!hasPostHook) {
    postHooks.push({ matcher: '', hooks: [{ type: 'command', command: `${hookCmd} post` }] });
    settings.hooks.PostToolUse = postHooks;
    log('Registered PostToolUse hook.');
  }

  const promptHooks = settings.hooks.UserPromptSubmit || [];
  const hasPromptHook = promptHooks.some((h) => h.hooks && h.hooks.some((hh) => hh.command && hh.command.includes('mnemo-session')));
  if (!hasPromptHook) {
    promptHooks.push({ matcher: '', hooks: [{ type: 'command', command: `${hookCmd} prompt` }] });
    settings.hooks.UserPromptSubmit = promptHooks;
    log('Registered UserPromptSubmit hook.');
  }

  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
  log('Settings updated.');
}

function uninstall() {
  log('Uninstalling mnemo-hook...');
  for (const file of FILES) {
    const dest = path.join(HOOKS_DIR, `mnemo-${file}`);
    try { fs.unlinkSync(dest); log(`Removed ${dest}`); } catch {}
  }

  let settings;
  try { settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')); } catch { return; }
  if (!settings.hooks) return;

  for (const key of ['PreToolUse', 'PostToolUse', 'UserPromptSubmit']) {
    if (Array.isArray(settings.hooks[key])) {
      settings.hooks[key] = settings.hooks[key].filter(
        (h) => !(h.hooks && h.hooks.some((hh) => hh.command && hh.command.includes('mnemo-session')))
      );
    }
  }
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
  log('Hooks removed from settings.json.');
  log('Done! Memory files in ~/.claude/memory/ are preserved.');
}

const action = process.argv[2];
const platform = process.platform === 'win32' ? 'Windows' : process.platform === 'darwin' ? 'macOS' : 'Linux';

if (action === 'uninstall') {
  uninstall();
} else {
  log(`Installing mnemo-hook on ${platform}...`);
  log(`Home: ${HOME}`);
  copyFiles();
  setupConfig();
  registerHooks();
  log('Done! Restart Claude Code to activate.');
}
