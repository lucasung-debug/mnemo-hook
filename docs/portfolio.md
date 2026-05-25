# Portfolio Notes

## Project

mnemo-hook is a zero-dependency Node.js memory hook for Claude Code. It gives AI-assisted coding sessions durable local memory without introducing a hosted service or package dependency chain.

## Problem

AI coding sessions often lose continuity. Developers repeat recent project state, design decisions, open questions, and implementation history. Existing memory approaches can be too heavy when they require external services, databases, embedding pipelines, or dashboard infrastructure.

## Approach

mnemo-hook treats memory as local project infrastructure:

- Claude Code hooks provide lifecycle integration.
- Markdown files with YAML frontmatter provide durable, inspectable storage.
- Tags and full-text search provide lightweight recall.
- Privacy filters run before memory is written.
- Optional graph and Obsidian Canvas output make relationships visible without making Obsidian mandatory.

## Implementation Highlights

- `src/session.js` routes Claude Code hook events for session briefing, auto-save, hints, and recall.
- `src/privacy.js` redacts common token formats, secret-style lines, sensitive metadata, and risky custom regex behavior.
- `src/store.js` writes memory to local files and supports optional Obsidian mirroring.
- `src/recall.js` combines tag overlap with full-text search for practical context retrieval.
- `src/graph-sync.js` builds project graph data and Canvas-oriented output.
- `mnemo-install.js` installs and uninstalls hook configuration while preserving stored memory.
- The project intentionally uses no npm dependencies.

## Validation

The repository exposes two primary validation commands:

```bash
npm run check
npm test
```

`npm run check` syntax-checks source modules. `npm test` runs the included test suite for utilities, privacy filtering, recall, graph sync, and session behavior.

## Privacy And Security Posture

mnemo-hook is designed to store memory locally. It avoids a remote memory service and applies redaction before storage. It also includes protections for sensitive files, path traversal, oversized hook input, metadata leakage, malformed installer state, and unsafe custom regex patterns.

## Limitations

- It is not a deployed web app or SaaS product.
- It is not a vector database or semantic embedding system.
- Recall is lightweight and file-based by design.
- It depends on Claude Code hook behavior and local file access.
- Obsidian output is optional and requires local configuration.

## Next Improvements

- Add more examples for multi-project memory organization.
- Document additional Claude Code hook troubleshooting cases.
- Expand graph examples for Obsidian users.
- Add fixture-based documentation examples for common recall workflows.
- Consider optional richer indexing while preserving the zero-dependency default.
