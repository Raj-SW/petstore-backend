## Project context

Shared memory files live in `.claude/memory/`. Read these at the start of any session before asking questions or making decisions:

- `STATUS.md` — what's done, what's remaining, what's blocked
- `ARCHITECTURE.md` — key design decisions and rationale (read before touching images, pricing, inventory, or orders)
- `SECURITY.md` — five open security findings; do not fix without QA sign-off
- `PATTERNS.md` — shared components and utilities; build here once, use everywhere
- `DEFERRED.md` — items explicitly parked; do not reopen without discussion
- `SPECS-INDEX.md` — every epic's spec file location

Update `STATUS.md` whenever an epic ships.

---

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
