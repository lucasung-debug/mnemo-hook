# mnemo-hook FAQ

## What is mnemo-hook?

mnemo-hook is an open-source Node.js utility that adds persistent, local session memory to Claude Code through Claude Code hooks.

## Who should use mnemo-hook?

It is for developers using Claude Code who want later sessions to remember recent decisions, milestones, open work, and related context without relying on a hosted memory service.

## What problem does it solve?

Claude Code sessions can lose continuity between invocations. mnemo-hook reduces repeated explanation by saving sanitized project memory and surfacing it during later sessions.

## Is mnemo-hook a web app or SaaS product?

No. mnemo-hook is a local CLI and hook utility. The repository may include static documentation for discovery, but the tool itself is not a hosted web SaaS.

## How does mnemo-hook connect to Claude Code?

mnemo-hook installs hook entries for Claude Code. Its main hook router is `src/session.js`, which handles session briefing, auto-save behavior, hints, and explicit recall prompts.

## Where are memories stored?

Memories are stored as local Markdown files with YAML frontmatter under the configured memory base directory. By default, the project uses `~/.claude/memory` unless changed with configuration or environment variables.

## Does mnemo-hook send memory to a remote server?

The project is designed around local file-based storage. It does not require a hosted memory service, telemetry endpoint, database, or npm dependency to run.

## What privacy protections are built in?

Before storage, mnemo-hook redacts common secrets and credentials, filters sensitive metadata, caps stored content length, guards custom regex patterns from ReDoS-prone nested quantifiers, sanitizes project names, and flags sensitive file names such as `.env`, `.pem`, and `credentials.json`.

## What can I recall?

You can ask for prior context with `recall {topic}`. mnemo-hook searches stored memory text and tags for relevant prior decisions, milestones, and session summaries.

## What are quiet hints?

Quiet hints are short contextual reminders shown when current work overlaps with tags from stored memories. The feature is designed to avoid interrupting the coding flow.

## Does mnemo-hook support Obsidian?

Yes. mnemo-hook can optionally mirror memory into an Obsidian-oriented project graph and Canvas output when configured with an Obsidian vault path.

## Why does zero dependencies matter?

Zero npm dependencies reduce install footprint, supply-chain exposure, and maintenance overhead. The project uses built-in Node.js capabilities and simple file formats.

## How do I validate the project locally?

Run:

```bash
npm run check
npm test
```

`npm run check` syntax-checks the source modules. `npm test` runs the repository test suite.

## What are the main source modules?

The core modules are `session.js`, `store.js`, `recall.js`, `privacy.js`, `graph-sync.js`, and `utils.js` under `src/`.

## What limitations should evaluators know?

mnemo-hook depends on local Claude Code hook execution and local file access. It is not a semantic vector database, hosted collaboration platform, or browser-based dashboard. Its recall behavior is intentionally lightweight and file-based.
