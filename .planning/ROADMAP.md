# Roadmap: Termy

Windows terminal emulator with tmux-like persistent session management.

**Core Value:** 在 Windows 上提供 tmux 级别的持久化会话体验——关掉终端，一切原地恢复，无需额外工具。

**Created:** 2026-04-15
**Granularity:** coarse
**Phases:** 5

## Phases

- [ ] **Phase 1: PTY Foundation** - Single terminal pane with ConPTY backend, xterm.js WebGL rendering, and bidirectional I/O
- [ ] **Phase 2: Multi-Pane & Layout** - Tabs, split panes, resize, mouse/scroll/clipboard interaction
- [ ] **Phase 3: Session Persistence** - Auto-save on close, auto-restore on open, atomic state files, buffer persistence
- [ ] **Phase 4: Restore Strategies** - Per-pane recovery strategies (background-keep-alive / layout-only / auto-rerun / remain-on-exit)
- [ ] **Phase 5: UX Polish** - Configurable shortcuts, in-terminal search, themes, font configuration

## Phase Details

### Phase 1: PTY Foundation
**Goal**: User can open Termy and use a single fully-functional terminal pane with a real Windows shell
**Depends on**: Nothing (first phase)
**Requirements**: PTY-01, PTY-02, PTY-03, PTY-04
**Success Criteria** (what must be TRUE):
  1. User launches Termy and sees a terminal running their default shell (PowerShell/CMD/WSL) with full ANSI color rendering
  2. User types commands and sees correct output with true color (24-bit) and 256-color support
  3. User exits the shell and sees the exit status displayed in the pane
  4. Native module build (node-pty + Electron) completes successfully with documented toolchain prerequisites
**Plans**: TBD

### Phase 2: Multi-Pane & Layout
**Goal**: User can manage multiple tabs and split panes with mouse, keyboard, scrollback, and clipboard
**Depends on**: Phase 1
**Requirements**: PTY-05, TAB-01, TAB-02, TAB-03, TAB-04, TAB-05, UX-02, UX-04
**Success Criteria** (what must be TRUE):
  1. User can create, switch between, and close multiple tabs, each with independent PTY sessions
  2. User can split any tab into horizontal and vertical panes, focus panes by mouse click or keyboard arrow keys
  3. User can resize panes by dragging handles and all terminal content reflows correctly
  4. User can close a tab and its associated PTY processes terminate cleanly
  5. User can scroll back through output with mouse wheel and copy/paste text via Ctrl+C/V
**Plans**: TBD
**UI hint**: yes

### Phase 3: Session Persistence
**Goal**: User can close Termy and reopen to find their session layout, working directories, and buffer content restored
**Depends on**: Phase 2
**Requirements**: SES-01, SES-02, SES-03, SES-04, SES-05
**Success Criteria** (what must be TRUE):
  1. User closes Termy and a session state file is written atomically to %APPDATA%/termy/
  2. User reopens Termy and the same tab/pane layout with working directories is restored automatically
  3. User sees previously visible terminal buffer content in restored panes (scrollback persisted)
  4. Session state file survives an unclean shutdown without corruption (atomic write + last-good backup)
**Plans**: TBD

### Phase 4: Restore Strategies
**Goal**: User can control how each pane behaves on session restore -- from background keep-alive to remain-on-exit
**Depends on**: Phase 3
**Requirements**: RST-01, RST-02, RST-03, RST-04, RST-05
**Success Criteria** (what must be TRUE):
  1. User can set a restore strategy per pane via right-click context menu or settings
  2. "Background keep alive" pane: PTY process survives app close and continues running in background
  3. "Layout only" pane: restores pane position and working directory without starting any process
  4. "Auto rerun" pane: restores layout and re-executes the previously running command
  5. "Remain-on-exit" pane: stays open after process exits, user presses a key to restart
**Plans**: TBD

### Phase 5: UX Polish
**Goal**: User can customize shortcuts, search terminal text, adjust appearance, and change fonts
**Depends on**: Phase 4
**Requirements**: UX-01, UX-03, UX-05, UX-06
**Success Criteria** (what must be TRUE):
  1. User can configure custom keyboard shortcuts for split, navigate, and close actions
  2. User can search text within the terminal buffer using Ctrl+F
  3. User can change foreground, background, cursor, and selection colors via a theme configuration
  4. User can change terminal font family and size with changes reflected immediately
**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. PTY Foundation | 0/4 | Not started | - |
| 2. Multi-Pane & Layout | 0/5 | Not started | - |
| 3. Session Persistence | 0/4 | Not started | - |
| 4. Restore Strategies | 0/5 | Not started | - |
| 5. UX Polish | 0/4 | Not started | - |

## Coverage

| Requirement | Phase | Status |
|-------------|-------|--------|
| PTY-01 | Phase 1 | Pending |
| PTY-02 | Phase 1 | Pending |
| PTY-03 | Phase 1 | Pending |
| PTY-04 | Phase 1 | Pending |
| PTY-05 | Phase 2 | Pending |
| TAB-01 | Phase 2 | Pending |
| TAB-02 | Phase 2 | Pending |
| TAB-03 | Phase 2 | Pending |
| TAB-04 | Phase 2 | Pending |
| TAB-05 | Phase 2 | Pending |
| SES-01 | Phase 3 | Pending |
| SES-02 | Phase 3 | Pending |
| SES-03 | Phase 3 | Pending |
| SES-04 | Phase 3 | Pending |
| SES-05 | Phase 3 | Pending |
| RST-01 | Phase 4 | Pending |
| RST-02 | Phase 4 | Pending |
| RST-03 | Phase 4 | Pending |
| RST-04 | Phase 4 | Pending |
| RST-05 | Phase 4 | Pending |
| UX-01 | Phase 5 | Pending |
| UX-02 | Phase 2 | Pending |
| UX-03 | Phase 5 | Pending |
| UX-04 | Phase 2 | Pending |
| UX-05 | Phase 5 | Pending |
| UX-06 | Phase 5 | Pending |

**Coverage:** 26/26 v1 requirements mapped, 0 orphaned
