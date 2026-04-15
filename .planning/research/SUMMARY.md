# Project Research Summary

**Project:** Termy
**Domain:** Windows terminal emulator with persistent session management
**Researched:** 2026-04-15
**Confidence:** MEDIUM-HIGH

## Executive Summary

Termy is a Windows-only terminal emulator whose core differentiator is tmux-like persistent session management -- the ability to close the app and reopen with layouts, working directories, and running processes intact. Unlike Unix where tmux achieves this through true PTY detach/reattach, Windows ConPTY does not support transferring a live pseudo-console to a new client. This is the single most important architectural constraint: Termy's "persistence" must be achieved through state snapshot + intelligent restore, NOT through actual process survival across app restarts.

The recommended stack is Electron 41.x with xterm.js 6.0 for rendering (WebGL addon mandatory for performance) and node-pty 1.1.0 for the ConPTY backend, all in TypeScript. This mirrors VS Code's terminal architecture, which is the closest proven reference. The main risk is native module compilation (node-pty against Electron) and several known ConPTY OS-level bugs (ClosePseudoConsole hangs, process orphaning) that must be addressed early in the build order.

The research strongly recommends a strict MVP scope: ship a working single-pane terminal first, then tabs and splits, then the persistence layer that differentiates Termy from Windows Terminal. Feature creep is the highest organizational risk -- the anti-features list (no remote SSH, no cross-platform, no plugin system, no built-in AI) must be enforced.

## Key Findings

### Recommended Stack

**Core technologies:**
- **Electron 41.x**: Desktop shell -- proven by VS Code's terminal, full TypeScript, mature native module ecosystem
- **node-pty 1.1.0**: ConPTY wrapper -- Microsoft-maintained, VS Code's choice, Windows-only ConPTY API
- **@xterm/xterm 6.0.0**: Terminal renderer -- most mature web terminal renderer, full ANSI/VT escape support
- **@xterm/addon-webgl 6.0.x**: GPU-accelerated rendering -- mandatory for performance; DOM renderer is unusably slow
- **zod 3.x**: Session state validation -- schema-validate all saved/restored session files
- **electron-store 9.x**: App preferences storage -- themes, fonts, keybindings, restore strategy defaults

**Critical version notes:**
- Electron 41 + node-pty 1.1.0 compatibility is MEDIUM-LOW confidence (known Issue #728). Fallback: `@lydell/node-pty` fork 1.2.0-beta.
- `@xterm/addon-image` (Sixel) has a known rendering bug in 6.0 (Issue #5644). Defer until fixed.
- `node-pty` must be excluded from asar packaging (`asarUnpack`) or the native binary fails to load.

### Expected Features

**Must have (table stakes):**
- ANSI escape sequence rendering with true color (24-bit), 256-color, cursor styles
- Unicode and emoji rendering with CJK wide-character support
- Multiple tabs and split panes (vertical/horizontal, resizable)
- Multiple shell profiles (PowerShell, CMD, WSL, Git Bash)
- Font configuration with Nerd Font and ligature support
- Copy/paste with bracketed paste mode awareness
- Keyboard shortcuts with configurable key bindings
- Terminal search, hyperlink detection, scrollback buffer, resize handling

**Should have (competitive differentiators):**
- Full session persistence via auto-save on close + auto-restore on open (zero-config)
- Per-pane process recovery strategy (keep running / layout only / re-execute / remain-on-exit)
- Session naming and switching (named session groups like tmux)
- Session state visualization panel (see what's saved, which processes are alive)
- Layout presets/templates (save and restore dev setups)
- Crash recovery (detect unclean shutdown, offer reconnect)

**Defer (v2+):**
- Selective scrollback persistence (opt-in per-pane due to file size)
- Sixel/inline image rendering (addon is beta quality with known bugs)
- Cloud sync of sessions (privacy risk, adds infrastructure)
- Real-time collaboration / shared terminals

### Architecture Approach

The architecture follows Electron's two-process model with strict boundaries: the **renderer process** owns all UI (xterm.js rendering, layout engine, state store), while the **main process** owns all PTY lifecycle (node-pty instances, session registry, state persistence). Communication is via session-scoped IPC channels.

**Major components:**
1. **TerminalPane** (Renderer) -- xterm.js rendering, input capture, IPC to/from main
2. **LayoutEngine** (Renderer) -- split tree management, pane sizing, focus traversal
3. **PTY Session Manager / PtyRegistry** (Main) -- single source of truth for all PTY lifecycle, spawn/kill, orphan detection
4. **node-pty Instances** (Main) -- one per pane, wraps ConPTY API, handles I/O pipes
5. **State Persistence** (Main) -- JSON file I/O in `%APPDATA%/termy/`, atomic writes, backup last-good state

**Key patterns:**
- One PTY per pane (never share a PTY across panes)
- IPC channel isolation by session ID (prevents output bleeding)
- Batched output for performance (buffer at 16ms intervals under high throughput)
- Graceful shutdown with per-pane restore strategy enforcement on `before-quit`

### Critical Pitfalls

1. **ConPTY ClosePseudoConsole hangs** (Windows 11 24H2 and earlier) -- The OS-level API can block indefinitely on shutdown, freezing the main process. **Prevention:** Use separate worker threads for PTY lifecycle, implement shutdown timeout with fallback to `taskkill /T`, detect OS version and adjust strategy.

2. **Orphaned PTY processes after crash** -- ConPTY processes survive app death, accumulating over time. **Prevention:** Windows Job Objects to auto-terminate process trees on Electron death, startup orphan detection with user prompt to clean up.

3. **Session state corruption on crash during save** -- Non-atomic `fs.writeFile` leaves partial JSON. **Prevention:** Atomic writes (temp file + `fs.rename`), state file versioning with backup of last-good state, checksum validation on read.

4. **node-pty native module rebuild failures on Electron upgrade** -- Native C++ bindings frequently fail to compile on Windows. **Prevention:** Pin Electron + node-pty version pairs (use VS Code's as reference), `@electron/rebuild`, document prerequisites, test rebuild on every upgrade.

5. **xterm.js scrollback memory growth without bounds** -- Memory grows linearly with output, causing OOM on long sessions. **Prevention:** Set scrollback limits (5000-10000 lines), make full scrollback persistence opt-in with size warnings, monitor renderer memory.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: PTY Foundation
**Rationale:** This is the irreducible core. If it cannot render a shell and accept input, nothing else matters. Highest technical risk (native module compilation, ConPTY quirks).
**Delivers:** Single terminal pane with xterm.js WebGL rendering, node-pty spawn/kill, bidirectional I/O via IPC, basic resize handling.
**Addresses:** ANSI rendering, Unicode, scrollback buffer, copy/paste, resize handling.
**Avoids:** Pitfall 4 (native rebuild failures -- pin versions immediately), Pitfall 13 (ConPTY OS version check), Pitfall 14 (font rendering quality).

### Phase 2: Multi-Pane + Layout
**Rationale:** Once one terminal works, extending to multiple panes is the natural next step. Must solve resize race conditions and IPC performance before persistence.
**Delivers:** Split-pane UI (H/V), focus traversal, resize handles, tab bar with multiple tabs, layout state management.
**Uses:** LayoutEngine, batched IPC output, WebGL renderer, @xterm/addon-fit.
**Implements:** One-PTY-per-pane pattern, session-scoped IPC channels.
**Avoids:** Pitfall 6 (resize race conditions -- debounce resize), Pitfall 5 (scrollback memory growth -- set limits), Pitfall 11 (IPC bottleneck -- batch output), Pitfall 7 (CJK IME input), Pitfall 16 (resize-after-exit crash).

### Phase 3: Session Persistence
**Rationale:** Requires all UI components to exist so their state can be captured. This is where the core differentiation begins but also where the most pitfalls cluster.
**Delivers:** Auto-save on `before-quit`, auto-restore on startup, session state JSON with zod validation, atomic file writes, orphan detection on startup.
**Addresses:** Session persistence, crash recovery, orphan process management.
**Avoids:** Pitfall 2 (orphaned processes -- Job Objects + startup scan), Pitfall 3 (state corruption -- atomic writes), Pitfall 9 (undefined exit codes -- heartbeat monitoring), Pitfall 12 (process state misconception -- clear UX about restore limits).
**Needs research:** YES -- per-pane strategy enforcement on shutdown; orphan detection semantics; "background keep alive" behavior design.

### Phase 4: Restore Strategies (Core Differentiator)
**Rationale:** This is what makes Termy unique vs Windows Terminal. Requires persistence infrastructure from Phase 3.
**Delivers:** Per-pane restore strategy UI (background-keep-alive / layout-only / auto-rerun / remain-on-exit), session naming and switching, layout templates.
**Addresses:** Per-pane recovery strategies, session naming, layout presets.
**Avoids:** Pitfall 1 (ClosePseudoConsole hang -- enforce shutdown timeout), Pitfall 12 (communicate restore limits clearly).
**Needs research:** YES -- background-keep-alive semantics need deeper design; output capture for orphaned processes.

### Phase 5: Polish & UX
**Rationale:** All features that layer on top of a working terminal with persistence.
**Delivers:** Command palette, in-terminal search, settings UI (themes, fonts, keybindings, profiles), session visualization panel, keyboard shortcuts.
**Addresses:** Command palette, search, settings UI, session panel, keyboard shortcuts.
**Avoids:** Pitfall 15 (clipboard edge cases), Pitfall 8 (Unicode discrepancies).
**Needs research:** NO -- standard UI patterns.

### Phase Ordering Rationale

- Phases 1-2 establish the fundamental terminal capability with no persistence dependency.
- Phase 3 builds the persistence layer on top of a working multi-pane terminal.
- Phase 4 adds the differentiation (restore strategies) which requires Phase 3's infrastructure.
- Phase 5 is polish that can ship incrementally.
- Each phase depends on its predecessor. No phase can meaningfully be built without the ones before it.
- Phase 1 is the highest risk (native module, ConPTY). If it fails, the project must pivot.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Session Persistence):** Concurrent state file access, JSON schema design for session format, atomic write edge cases on Windows.
- **Phase 4 (Restore Strategies):** "Background keep alive" semantics on Windows (no true PTY reattachment), output capture for orphaned processes, environment variable save/restore.

Phases with standard patterns (skip research-phase):
- **Phase 2 (Multi-Pane):** Well-documented split-pane patterns, established xterm.js integration.
- **Phase 5 (Polish):** Standard Electron UI patterns, command palette, settings UI, keyboard shortcuts.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All core technologies (Electron, xterm.js, node-pty) verified via official sources, npm registry, and VS Code reference. Version compatibility (Electron 41 + node-pty 1.1.0) is MEDIUM-LOW -- needs build-time validation. |
| Features | HIGH | Feature classification verified against Windows Terminal 1.25, tmux-resurrect, WezTerm, and Alacritty. User pain points sourced from real issue trackers and community discussions. |
| Architecture | HIGH | Architecture mirrors VS Code's terminal process model, confirmed by Microsoft specs and VS Code source code. ConPTY limitations verified via Microsoft documentation and confirmed GitHub issues. |
| Pitfalls | HIGH | All critical pitfalls backed by specific GitHub issues in microsoft/terminal, microsoft/node-pty, and xtermjs/xterm.js. Mitigations derived from VS Code and Windows Terminal source code patterns. |

**Overall confidence:** HIGH (with one caveat: Electron 41 + node-pty 1.1.0 compatibility must be verified at build time)

### Gaps to Address

- **Electron 41 + node-pty compatibility:** Must verify at Phase 1 build time. If it fails, fall back to `@lydell/node-pty` 1.2.0-beta.
- **Background keep-alive output capture:** No clear pattern exists for capturing output from an orphaned shell process without a valid PTY pipe. May need a named pipe or file redirector approach.
- **Session state JSON schema:** Formal schema needs to be designed. The proposed format in ARCHITECTURE.md is a starting point but needs validation against edge cases (nested splits, environment variables, escape sequences in cwd paths).
- **Performance at 16+ panes:** Research covers up to 32 panes but real-world testing is needed for IPC batching thresholds and SharedArrayBuffer migration triggers.

## Sources

### Primary (HIGH confidence)
- Microsoft ConPTY docs: https://learn.microsoft.com/en-us/windows/console/creating-a-pseudoconsole-session
- node-pty GitHub: https://github.com/microsoft/node-pty
- xterm.js GitHub: https://github.com/xtermjs/xterm.js/releases
- Windows Terminal Process Model 2.0 Spec: https://github.com/microsoft/terminal/blob/main/doc/specs/%235000%20-%20Process%20Model%202.0/
- VS Code terminalProcess.ts: https://github.com/microsoft/vscode/blob/main/src/vs/platform/terminal/node/terminalProcess.ts
- Console-Docs (Microsoft): https://github.com/Microsoft/Console-Docs
- Windows Terminal 1.25 Release Notes: https://devblogs.microsoft.com/commandline/windows-terminal-preview-1-25-release/
- tmux-resurrect source: https://github.com/tmux-plugins/tmux-resurrect

### Secondary (MEDIUM confidence)
- ConPTY ClosePseudoConsole hang (microsoft/terminal #17688)
- node-pty Electron compatibility (microsoft/node-pty #728)
- xterm.js parser worker isolation (xtermjs/xterm.js #3368)
- Ghostty session manager discussion
- Windows Terminal user complaints (HN)

### Tertiary (LOW confidence)
- @xterm/addon-image Sixel rendering bug (xtermjs/xterm.js #5644) -- status uncertain
- resurrect.wezterm Reddit discussion -- community plugin, not official
- tmux-resurrect zombie process reports -- edge cases, not consistently reproducible

---
*Research completed: 2026-04-15*
*Ready for roadmap: yes*
