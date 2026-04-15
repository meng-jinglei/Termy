# State: Termy

## Project Reference

**Core Value:** 在 Windows 上提供 tmux 级别的持久化会话体验——关掉终端，一切原地恢复，无需额外工具。

**Current Focus:** Phase 1 — PTY Foundation (single terminal pane with ConPTY backend)

**Tech Stack:** Electron 41.x + xterm.js 6.0 + node-pty 1.1.0 + TypeScript

**Platform:** Windows 11 only (ConPTY API)

**Architecture:** Electron two-process model — renderer owns xterm.js UI, main owns node-pty lifecycle

**Research Confidence:** HIGH (with caveat: Electron 41 + node-pty 1.1.0 compatibility must be verified at build time)

## Current Position

| Item | Value |
|------|-------|
| Milestone | v1 |
| Phase | 1 — PTY Foundation |
| Plan | TBD |
| Status | Not started |
| Progress | ░░░░░░░░░░ 0% |

## Performance Metrics

- Requirements defined: 26
- Requirements mapped: 26/26
- Phases defined: 5
- Plans created: 0
- Plans completed: 0

## Accumulated Context

### Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Electron over Tauri | Development speed, full TypeScript, mature native module ecosystem | 2026-04-15 |
| xterm.js as renderer | VS Code's choice, mature, community-backed | 2026-04-15 |
| node-pty as PTY layer | Microsoft-maintained, ConPTY binding, VS Code uses it | 2026-04-15 |
| Auto-save on app close | User-transparent, most natural UX | 2026-04-15 |
| JSON file for session state | Simple, debuggable, manually editable | 2026-04-15 |
| Snapshot+restore persistence (not true detach) | ConPTY does not support PTY transfer to new client | 2026-04-15 |

### Key Risks

1. **Native module compilation**: node-pty + Electron 41 compatibility unknown (Issue #728). Fallback: `@lydell/node-pty` 1.2.0-beta
2. **ConPTY ClosePseudoConsole hangs**: Windows 11 24H2 OS-level bug. Mitigation: worker threads + shutdown timeout + taskkill fallback
3. **Orphaned processes on crash**: ConPTY survives app death. Mitigation: Windows Job Objects + startup orphan scan
4. **State corruption on crash**: Non-atomic writes. Mitigation: temp file + fs.rename, last-good backup
5. **Scrollback memory growth**: Linear memory growth with output. Mitigation: scrollback limits (5000-10000 lines)

### Blockers

(None)

## Session Continuity

### Completed Phases

(None yet)

### Next Steps

1. Approve this roadmap
2. Run `/gsd-plan-phase 1` to create implementation plan for Phase 1
3. Phase 1 must include native module build verification spike (node-pty + Electron compatibility)

---
*Last updated: 2026-04-15 after roadmap creation*
