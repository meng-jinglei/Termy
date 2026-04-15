# Phase 1: PTY Foundation - Context

**Gathered:** 2026-04-15
**Status:** Ready for planning

<domain>
## Phase Boundary

User can open Termy and use a single fully-functional terminal pane with a real Windows shell. This is the irreducible core — if this doesn't work, nothing else matters. Covers: Electron app scaffold, xterm.js rendering, node-pty + ConPTY lifecycle, keyboard input/output loop, shell selection.

Deliverables:
- A working Electron app window with a single terminal pane
- User can type commands and see output from a real shell
- Shell process exits cleanly and shows exit status
- Terminal resize correctly propagates to PTY

Does NOT deliver: tabs, panes, session persistence, themes, search — these are later phases.
</domain>

<decisions>
## Implementation Decisions

### Shell Support
- **D-01:** Default shell on first launch is PowerShell 7 (auto-detected, falls back to Windows PowerShell if PS7 not installed)
- **D-02:** User can switch between PowerShell 7, Git Bash, and WSL (Ubuntu) shells
- **D-03:** Shell choice is remembered per session restore (ties into Phase 3 persistence)
- **D-04:** cmd.exe is NOT included in v1 shell list — user can add custom shells via config later (Phase 5)

### Startup Behavior
- **D-05:** Opening Termy directly pops up a terminal pane — no splash screen, no management UI first
- **D-06:** Shell selector is accessible via UI (dropdown or button) but default is always the last-used or first-time default (PowerShell 7)

### Window Behavior
- **D-07:** Phase 1 is single-window only — one Electron BrowserWindow with one terminal pane
- **D-08:** Multi-window support deferred to Phase 2+ (requires architectural changes to session management)

### Build Risk Mitigation
- **D-09:** Phase 1 begins with a native module build verification spike — confirm node-pty compiles with the target Electron version on Windows 11 before any feature work
- **D-10:** If node-pty 1.1.0 fails to build, fall back to `@lydell/node-pty` fork (1.2.0-beta.12)
- **D-11:** If both forks fail, design spike to evaluate direct ConPTY FFI via `ffi-napi` or `node-addon-api`

### Technical Stack (from research, locked)
- **D-12:** Electron 41 (latest stable) — node-pty compatibility must be verified first (D-09)
- **D-13:** xterm.js 6.0.0 (@xterm scoped packages) with WebGL renderer addon mandatory
- **D-14:** node-pty 1.1.0 as primary PTY layer, wrapping Windows ConPTY API
- **D-15:** TypeScript strict mode enabled from the start
- **D-16:** Vite as build tool (faster HMR, better Electron integration via electron-vite)

### Claude's Discretion
- PTY process lifecycle management details (spawn/kill/error handling patterns) — Claude decides based on node-pty best practices
- IPC channel naming and message schema design — Claude decides based on Electron IPC patterns
- Error message wording and formatting — Claude decides based on terminal UX standards

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Stack & Architecture
- `.planning/research/STACK.md` — Technology recommendations, ConPTY deep dive, node-pty/xterm.js versions
- `.planning/research/ARCHITECTURE.md` — Component boundaries, data flow, build order
- `.planning/research/PITFALLS.md` — 17 domain-specific pitfalls with prevention strategies
- `.planning/research/FEATURES.md` — Feature landscape, table stakes vs differentiators
- `.planning/research/SUMMARY.md` — Research synthesis with executive summary

### Requirements
- `.planning/REQUIREMENTS.md` — PTY-01 through PTY-04 requirements for this phase
- `.planning/PROJECT.md` — Project context, constraints, key decisions

### External References (for research agents)
- node-pty GitHub: https://github.com/microsoft/node-pty — Issues #471, #728, #854, #827
- xterm.js GitHub: https://github.com/xtermjs/xterm.js — v6.0.0 release notes
- ConPTY docs: https://github.com/Microsoft/Console-Docs/blob/main/docs/createpseudoconsole.md
- electron-vite: https://electron-vite.org/ — Electron + Vite integration guide
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing code

### Established Patterns
- None yet — Phase 1 establishes the foundational patterns

### Integration Points
- xterm.js runs in Electron renderer process
- node-pty runs in Electron main process (Node.js)
- IPC bridges renderer ↔ main ↔ PTY ↔ conhost.exe ↔ shell
- State file (JSON) will be written by main process, read on startup

</code_context>

<specifics>
## Specific Ideas

- User wants the terminal to appear immediately on launch — no splash, no welcome screen, no configuration wizard
- "Like opening iTerm/Terminal on macOS" — instant terminal, ready to type
- Shell switching should be easy but not necessarily keyboard-driven in Phase 1 (UI button is fine)
- WSL support is important — this is a key differentiator from simple terminal emulators
</specifics>

<deferred>
## Deferred Ideas

- cmd.exe support — deferred to Phase 5 (custom shell config)
- Custom shell profiles — deferred to Phase 5
- Terminal themes and fonts — deferred to Phase 5
- Multi-window support — deferred to Phase 2+
- Command palette — deferred to Phase 5

None — discussion stayed within phase scope.
</deferred>

---

*Phase: 01-pty-foundation*
*Context gathered: 2026-04-15*
