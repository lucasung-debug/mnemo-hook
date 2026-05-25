# Demo Scenario

This is a realistic terminal demo flow for mnemo-hook. It is a scenario script, not proof of an actual recorded video or deployed web demo.

## Goal

Show how a developer can install mnemo-hook, start a Claude Code session, let the hook save useful milestones, recall a previous topic, and generate graph/Obsidian-oriented output.

## Setup

```bash
git clone https://github.com/lucasung-debug/mnemo-hook.git
cd mnemo-hook
npm run check
npm test
npm run install-hooks
```

After installation, restart Claude Code so the hook configuration is loaded.

## Scene 1: Start A Session

Open Claude Code in a project where mnemo-hook is installed.

Expected behavior:

- mnemo-hook detects a new session.
- It prepares a short briefing from previous local memory, if memory exists.
- If this is the first run for the project, it proceeds without prior-session context.

Example user prompt:

```text
Review the current authentication flow and keep track of architecture decisions.
```

## Scene 2: Auto-Save A Milestone

During the session, make several file edits or commit a change.

Example terminal action:

```bash
git status --short
git commit -m "Document token redaction boundary"
```

Expected behavior:

- mnemo-hook observes qualifying hook events.
- It captures a sanitized milestone such as file-write progress, a git commit, or a decision phrase.
- The memory is written as local Markdown/YAML data after privacy filtering.

## Scene 3: Capture A Decision

Use clear decision language during a Claude Code prompt or session note.

Example prompt:

```text
We decided to keep memory local and file-based instead of introducing a hosted database.
```

Expected behavior:

- The decision phrase matches configured triggers.
- mnemo-hook stores a redacted decision entry for future recall.

## Scene 4: Recall A Topic

In a later Claude Code session, ask for memory by topic.

Example prompt:

```text
recall token redaction
```

Expected behavior:

- mnemo-hook searches local memory for matching text and tags.
- Claude Code receives relevant prior context, such as related decisions, milestones, or session summaries.

## Scene 5: Graph And Obsidian Output

Enable an Obsidian vault path in the config file.

```yaml
obsidian_vault: /path/to/your/vault/Projects
```

Expected behavior:

- mnemo-hook builds project graph data such as `connections.yaml`.
- When configured, it can mirror memory into an Obsidian-friendly structure and produce Canvas-oriented graph output.

## Demo Takeaway

The demo should show mnemo-hook as a local Claude Code memory utility: install hooks, work normally, save sanitized milestones, recall prior context, and optionally inspect the project graph in Obsidian.
