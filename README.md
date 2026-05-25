# mnemo-hook

**Persistent memory layer for Claude Code** — your AI remembers what happened last session.

> *mnemo* (Greek: mneme, memory) — because every session should start where the last one ended.

[Korean](docs/i18n/README.ko.md) | [Russian](docs/i18n/README.ru.md) | [Chinese](docs/i18n/README.zh.md)

---

## AI Search Summary

**mnemo-hook** is an open-source, zero-dependency Node.js hook utility that gives Claude Code a file-based memory layer for session continuity.

- **Who it is for:** developers using Claude Code who want later sessions to remember project decisions, milestones, open work, and related prior context.
- **Problem it solves:** Claude Code sessions normally start without durable project memory, forcing users to restate recent history and decisions.
- **What makes it different:** it works through Claude Code hooks, stores memory as local Markdown/YAML files, applies privacy-first redaction before writing, keeps a zero-dependency runtime, and can optionally mirror project memory into an Obsidian-friendly graph/canvas workflow.
- **How to validate locally:** run `npm run check` for syntax checks and `npm test` for the full test suite.

For answer engines and portfolio reviewers, see [llms.txt](llms.txt), [FAQ](docs/faq.md), [demo scenario](docs/demo-scenario.md), and [portfolio notes](docs/portfolio.md).

---

## The Problem

Every time you start a new Claude Code session, context is lost. You re-explain what you were working on, what decisions were made, what's still open. **mnemo-hook** fixes this by automatically capturing and recalling session history through Claude Code's hook system.

## What It Does

- **Session Briefing** — On new session start, shows what happened last time: recent decisions, progress, open items
- **Auto-Save** — Silently captures git commits, file write milestones, and key decisions during your session
- **Quiet Hints** — While you work, surfaces relevant past memories when the current task overlaps with prior work
- **Deep Search** — Type `recall {topic}` to search across all stored memories
- **Knowledge Graph** — Builds a project graph (`connections.yaml`) and optional Obsidian Canvas visualization
- **Privacy First** — Automatically redacts passwords, tokens, private keys, and sensitive file references

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Claude Code                        │
│                                                      │
│  PreToolUse ──> session.js ──> briefing / pass       │
│  PostToolUse ─> session.js ──> auto-save / hint      │
│  UserPrompt ──> session.js ──> deep search           │
│                     │                                │
│         ┌───────────┼───────────┐                    │
│         v           v           v                    │
│     store.js    recall.js  graph-sync.js             │
│         │           │           │                    │
│         v           v           v                    │
│    [memory/]   [tag-index]  [graph/]                 │
└─────────────────────────────────────────────────────┘
```

### 6 Modules, Zero Dependencies

| Module | Role |
|--------|------|
| `utils.js` | Config loading, YAML parsing, project resolution |
| `privacy.js` | Credential redaction, blocked file detection |
| `store.js` | File-based memory storage with optional Obsidian mirror |
| `session.js` | Hook router — briefing, auto-save, decision capture |
| `recall.js` | Auto-recall (tag matching) + deep search (full-text) |
| `graph-sync.js` | Project graph builder + Obsidian Canvas generator |

## Quick Start

Works on **Windows**, **macOS**, and **Linux**.

```bash
# Clone
git clone https://github.com/lucasung-debug/mnemo-hook.git
cd mnemo-hook

# Verify
npm test

# Install hooks into Claude Code
npm run install-hooks    # or: node mnemo-install.js

# Restart Claude Code — mnemo is now active

# To uninstall (memory files are preserved)
npm run uninstall-hooks
```

## Configuration

Copy `config/config.example.yaml` to `~/.claude/memory/config.yaml` and edit:

```yaml
# Optional: mirror to Obsidian vault
obsidian_vault: /path/to/your/vault/Projects

# Recall tuning
max_hints_per_hour: 3
min_tag_overlap_for_hint: 2

# Auto-save triggers
file_write_threshold: 3
decision_trigger_phrases:
  - "decided to"
  - "architecture decision"
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MNEMO_BASE` | `~/.claude/memory` | Memory storage directory |
| `MNEMO_CONFIG` | `$MNEMO_BASE/config.yaml` | Config file path |

## How It Works

### Session Lifecycle

1. **New session detected** → Merge previous partial saves into a digest → Rebuild tag index → Show briefing
2. **During session** → Auto-capture git commits, file write milestones, decision phrases
3. **Quiet hints** → When current tool use overlaps with past memory tags, surface a one-line hint
4. **On demand** → `recall {topic}` triggers full-text search across all memories

### Memory Format

Memories are stored as Markdown files with YAML frontmatter:

```markdown
---
id: "project-2026-04-12-session-1234"
type: "session"
project: "my-project"
date: "2026-04-12"
title: "Session digest — my-project"
tags:
  - "session"
  - "api-design"
  - "authentication"
---

## Session Summary
Merged from 3 partial saves.

## Decisions
1. Use JWT for auth instead of sessions
```

### Privacy & Security

All content passes through a **4-layer privacy filter** before storage:

1. **Regex scrub** — Removes passwords, bearer tokens, private keys, and platform-specific tokens
2. **Line scrub** — Redacts lines starting with 13 sensitive keywords (PASSWORD, SECRET, TOKEN, API_KEY, KEY, CREDENTIAL, PRIVATE_KEY, ACCESS_KEY, AUTH_TOKEN, CLIENT_SECRET, DATABASE_URL, WEBHOOK_SECRET, SIGNING_KEY)
3. **Length cap** — Truncates at 10,000 characters
4. **ReDoS guard** — Rejects custom regex patterns with nested quantifiers to prevent denial-of-service

**Detected token formats:**

| Platform | Pattern |
|----------|---------|
| Generic | `password=`, `secret:`, `bearer`, private keys |
| GitHub | `ghp_*`, `github_pat_*` |
| AWS | `AKIA*` (access keys) |
| Anthropic | `sk-ant-*` |
| OpenAI | `sk-proj-*` |
| Slack | `xoxb-*`, `xoxp-*`, `xoxs-*` |
| JWT | `eyJ*.eyJ*.eyJ*` |

**Additional security measures:**
- Path traversal protection — project names are sanitized (no `../`, no path separators)
- Canvas output path validation — writes are restricted to the user's home directory
- Stdin size limit (1MB) — prevents memory exhaustion from oversized hook payloads
- YAML injection prevention — all frontmatter fields are properly quoted
- Metadata redaction — titles and tags are filtered before storage, not just body text
- Installer safety — aborts on malformed settings.json instead of overwriting

Sensitive files (`.env`, `.pem`, `credentials.json`) are flagged but never stored.

## Testing

```bash
npm test                 # Run all 38 tests
npm run test:utils       # Utils only (11 tests)
npm run test:privacy     # Privacy only (9 tests)
npm run test:recall      # Recall only (10 tests)
npm run test:graph       # Graph sync only (8 tests)
npm run check            # Syntax check all modules
```

## Project Structure

```
mnemo-hook/
├── src/
│   ├── utils.js          # Shared utilities
│   ├── privacy.js        # Privacy filter
│   ├── store.js          # Memory storage
│   ├── session.js        # Hook router (entry point)
│   ├── recall.js         # Memory recall engine
│   └── graph-sync.js     # Knowledge graph
├── test/                  # 38 tests, zero frameworks
├── config/
│   └── config.example.yaml
├── mnemo-install.js       # One-command installer
└── package.json
```

## Requirements

- Node.js >= 18
- Claude Code (CLI, Desktop, or IDE extension)
- No npm dependencies — zero install footprint

## License

MIT
