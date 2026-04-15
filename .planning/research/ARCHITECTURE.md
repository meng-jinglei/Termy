# Architecture Patterns

**Domain:** Windows Terminal Emulator with Persistent Session Management
**Researched:** 2026-04-15

## Recommended Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Electron App                              │
│                                                                  │
│  ┌─────────────────────┐         ┌────────────────────────────┐  │
│  │   Renderer Process   │         │       Main Process         │  │
│  │   (xterm.js UI)      │         │   (Node.js + node-pty)     │  │
│  │                      │  IPC    │                            │  │
│  │  ┌───────────────┐   │◄──────►│  ┌──────────────────────┐  │  │
│  │  │  TerminalPane  │   │  channel│  │  PTY Session Manager │  │  │
│  │  │  Component     │   │         │  │  (PtyRegistry)       │  │  │
│  │  └───────┬───────┘   │         │  └──────────┬───────────┘  │  │
│  │          │            │         │             │               │  │
│  │  ┌───────┴───────┐   │         │  ┌──────────┴───────────┐  │  │
│  │  │  Layout Engine │   │         │  │  node-pty instances   │  │  │
│  │  │  (split tree)  │   │         │  │  (one per pane)      │  │  │
│  │  └───────┬───────┘   │         │  └──────────┬───────────┘  │  │
│  │          │            │         │             │               │  │
│  │  ┌───────┴───────┐   │         │  ┌──────────┴───────────┐  │  │
│  │  │  State Store   │   │         │  │  State Persistence    │  │  │
│  │  │  (Zustand/     │   │         │  │  (JSON files in       │  │  │
│  │  │  React Context)│   │         │  │   %APPDATA%/termy)    │  │  │
│  │  └───────────────┘   │         │  └──────────────────────┘  │  │
│  └─────────────────────┘         └────────────────────────────┘  │
│                                                                  │
│                                                                  │
│                    (IPC Data Flow)                               │
│  Renderer ──input──► Main     (user keystrokes → pty.write)     │
│  Renderer ◄──output── Main    (pty.on('data') → xterm.write)    │
│  Renderer ──resize──► Main    (terminal resize → pty.resize)    │
│  Renderer ◄──exit─── Main     (pty.onExit → notify renderer)    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                            │
                            │ CreatePseudoConsole()
                            ▼
              ┌─────────────────────────────┐
              │  conhost.exe (per PTY)      │
              │  (headless, managed by       │
              │   node-pty)                  │
              └──────────────┬──────────────┘
                             │
                             ▼
              ┌─────────────────────────────┐
              │  Shell process              │
              │  (pwsh.exe, cmd.exe, etc.)  │
              │  + any child processes      │
              └─────────────────────────────┘
```

## Component Boundaries

| Component | Responsibility | Communicates With | Process |
|-----------|---------------|-------------------|---------|
| **TerminalPane** (Renderer) | Renders terminal UI via xterm.js, captures keyboard/mouse input | IPC → Main (input, resize); IPC ← Main (output, exit) | Renderer |
| **LayoutEngine** (Renderer) | Manages split tree (H/V splits), pane sizing, focus traversal | Reads/writes layout state in Store | Renderer |
| **StateStore** (Renderer) | Reactive state for tabs, panes, layouts, active focus | Persisted via IPC to Main's State Persistence layer | Renderer |
| **PTY Session Manager** (Main) | Registry of all active PTY sessions, spawn/kill lifecycle, orphan detection | IPC ↔ Renderer; node-pty API; file system | Main |
| **node-pty Instance** (Main) | Wraps ConPTY API; one per pane; handles I/O pipes to conhost + shell | Session Manager; OS ConPTY API | Main |
| **State Persistence** (Main) | Reads/writes session state JSON; handles save-on-close, load-on-start | File system; Session Manager | Main |
| **conhost.exe** (OS) | Windows pseudo-console host; spawned by CreatePseudoConsole; bridges node-pty to shell | node-pty (pipes); shell process | OS child |
| **Shell Process** (OS) | User's shell (PowerShell, cmd, etc.) + any child processes it spawns | conhost (pseudo-console I/O) | OS grandchild |

## Data Flow

### Input Path (user types → shell)
```
User keystroke
  → xterm.js Terminal.onKey (Renderer)
  → ipcRenderer.send('terminal-input', { sessionId, data })
  → ipcMain.on('terminal-input') (Main)
  → ptyRegistry.get(sessionId).write(data)
  → ConPTY input pipe
  → conhost.exe
  → shell process
```

### Output Path (shell → screen)
```
Shell process writes output
  → conhost.exe
  → ConPTY output pipe
  → node-pty pty.on('data', chunk)
  → ipcMain emits to renderer (batched)
  → ipcRenderer receives chunk
  → xterm.write(chunk)
```

### Resize Path (UI resize → shell notification)
```
User resizes pane / window resize
  → LayoutEngine recalculates cols/rows
  → StateStore updates pane dimensions
  → ipcRenderer.send('terminal-resize', { sessionId, cols, rows })
  → ptyRegistry.get(sessionId).resize(cols, rows)
  → ConPTY resize notification
  → shell receives SIGWINCH equivalent
```

### Session Lifecycle Path
```
App starting
  → State Persistence reads sessions.json
  → PTY Session Manager restores session metadata (layouts, cwd, commands)
  → For each pane: spawn new node-pty + shell
  → IPC notifies renderer of restored sessions
  → LayoutEngine rebuilds split tree
  → TerminalPane components attach to restored sessions

App closing
  → before-quit event
  → PTY Session Manager collects state from all sessions
  → State Persistence writes sessions.json
  → (Based on restore strategy) kill or preserve PTY tree
  → App exits
```

## Patterns to Follow

### Pattern 1: One PTY Per Pane
**What:** Each pane gets exactly one node-pty instance. Tabs and panes are purely UI-level abstractions; the PTY layer only knows about individual sessions.
**When:** Always. Do NOT share a PTY across panes.
**Why:** Matches Windows Terminal's architecture (each pane = independent ConPTY). Enables independent shell processes, independent cwd tracking, independent recovery strategies per pane.
**Rationale vs alternatives:** tmux uses one PTY per pane too, but multiplexes views. Windows Terminal uses one ConPTY per pane. We follow the per-pane PTY model because it is simpler and matches our table-stakes requirements.

### Pattern 2: Session Manager as Single Source of Truth
**What:** A central `PtyRegistry` (or `SessionManager`) in the main process owns all PTY lifecycle. The renderer never touches node-pty directly.
**When:** Always.
**Why:** node-pty is a native module that can only run in Node.js (main process). Centralizing also simplifies orphan detection, batch save, and error recovery.
**Example:**
```typescript
// Main process: session manager
class PtyRegistry {
  private sessions: Map<string, PtySession> = new Map();

  spawn(sessionId: string, options: PtyOptions): PtySession {
    const pty = nodePty.spawn(options.shell, options.args, {
      name: 'xterm-256color',
      cols: options.cols,
      rows: options.rows,
      cwd: options.cwd,
      env: process.env,
      useConpty: true,  // Windows only
    });

    const session: PtySession = { id: sessionId, pty, ...options };
    this.sessions.set(sessionId, session);

    pty.onData((data) => {
      this.sendToRenderer(sessionId, data);
    });

    pty.onExit(({ exitCode, signal }) => {
      this.notifyExit(sessionId, exitCode, signal);
    });

    return session;
  }

  kill(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.pty.kill();
      this.sessions.delete(sessionId);
    }
  }
}
```

### Pattern 3: IPC Channel Isolation by Session
**What:** Use session-scoped IPC channels (`terminal-input:sessionId`, `terminal-output:sessionId`) rather than a single multiplexed channel.
**When:** Always for terminal I/O. Fine to share channels for non-real-time operations (settings, commands).
**Why:** Prevents output from one pane bleeding into another. Simplifies debugging. Matches how VS Code structures its terminal IPC.

### Pattern 4: Batched Output for Performance
**What:** Buffer PTY output in the main process and emit to renderer in batches (e.g., every 16ms / one frame), rather than emitting every single `data` event.
**When:** Under high-throughput scenarios (build logs, cat large files).
**Why:** Per-event IPC is expensive. node-pty + Electron IPC can become a bottleneck with many concurrent terminals. Batching reduces IPC overhead.
**Detection:** If output latency is noticeable with 4+ concurrent terminals, implement batching.

### Pattern 5: Graceful Shutdown with Strategy Enforcement
**What:** On app close, enforce the per-pane restore strategy before killing:
- `background-keep-alive`: Do NOT kill. The PTY process tree persists beyond app exit.
- `layout-only`: Kill PTY tree, preserve layout metadata.
- `auto-rerun`: Kill PTY tree, save command + cwd for re-execution.
- `remain-on-exit`: Kill PTY tree, preserve scrollback buffer.
**When:** Always on `before-quit`.
**Why:** This is the core differentiator of Termy. The restore strategy determines what survives app close.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Windows Service for Session Persistence
**What goes wrong:** Running a background Windows Service to keep ConPTY sessions alive when the app fully exits.
**Why bad:** ConPTY handles (HPCON) are process-local. You cannot transfer a live ConPTY handle from one process to another on Windows. Even if you could, the pipe handles (hConIn/hConOut) are also process-scoped. A separate service would need to own the PTY, but then the Electron app becomes just a thin viewer -- massive complexity for marginal benefit.
**Instead:** Use the `background-keep-alive` restore strategy: when the app closes, simply do NOT kill the ConPTY processes. They continue running under the Electron main process, which remains alive as long as it has active children. When the app restarts, spawn new PTY connections and attach to the existing shells. **Note:** True "reattach to existing PTY" is not possible on Windows; you can only spawn a new PTY and connect to the same shell process. The shell's scrollback and state are lost unless you captured them.

### Anti-Pattern 2: Renderer Directly Spawning node-pty
**What goes wrong:** Attempting to use node-pty from the renderer process via `nodeIntegration: true`.
**Why bad:** node-pty is a native module compiled against Node.js ABI, not the browser. It will crash in the renderer. Even if forced via context isolation bypass, it breaks Electron security model.
**Instead:** Always spawn in main process. IPC to renderer.

### Anti-Pattern 3: Single PTY for All Panes (tmux-style Multiplexing)
**What goes wrong:** Attempting to replicate tmux's model where one server owns multiple panes that share a PTY session.
**Why bad:** ConPTY does not support multiplexing views onto a single pseudo-console. Each ConPTY is a 1:1 relationship between terminal host and shell. You would need to implement your own VT-sequence fan-out, which is error-prone and defeats ConPTY's benefits.
**Instead:** One PTY per pane (Pattern 1). Implement tab/pane management at the UI layer.

### Anti-Pattern 4: Storing Terminal Buffer in State File
**What goes wrong:** Serializing xterm.js's full terminal buffer (every cell, attribute, line) to JSON for persistence.
**Why bad:** xterm.js buffers can be megabytes for active sessions. JSON serialization of `BufferLine` objects is slow and produces large files. Recovery of terminal state (cursor position, alternate screen mode, DEC private modes) is fragile.
**Instead:** For `remain-on-exit` strategy, capture visible buffer as plain text (lossy but sufficient). For other strategies, discard buffer. Only persist metadata (cwd, command, layout, exit code).

## Scalability Considerations

| Concern | At 1-4 panes | At 8-16 panes | At 32+ panes |
|---------|--------------|---------------|--------------|
| IPC throughput | No batching needed | Batch output (16ms window) | Consider binary IPC or SharedArrayBuffer |
| PTY memory | ~10MB per PTY | ~80-160MB total | Monitor for handle leaks |
| State file size | < 50KB JSON | < 200KB JSON | Split into per-session files |
| Startup time | < 2s | < 5s | Lazy-load sessions |
| conhost processes | 1-4 instances | 8-16 instances (visible in Task Manager) | May trigger AV heuristics |

## Suggested Build Order

Dependencies between components, what to build first, what to defer:

### Phase 1: PTY Foundation
**What:** Single terminal, xterm.js rendering, node-pty spawn/kill, bidirectional I/O via IPC.
**Why first:** This is the irreducible core. Nothing else matters until a terminal renders and accepts input.
**Dependencies:** None.
**Deferrable:** Layout, tabs, persistence, recovery.

### Phase 2: Multi-Pane + Layout
**What:** Split-pane UI (H/V), focus traversal, resize handles, layout state in store.
**Why second:** Once one terminal works, extending to multiple is a natural next step.
**Dependencies:** Phase 1 (PTY Foundation).
**Deferrable:** Persistence, recovery, keyboard shortcuts.

### Phase 3: Tab Management
**What:** Tab bar, create/close/rename tabs, tab-scoped layouts, active tab tracking.
**Why third:** Tabs add organizational structure on top of panes.
**Dependencies:** Phase 2 (Multi-Pane + Layout).
**Deferrable:** Persistence, recovery.

### Phase 4: Session Persistence
**What:** Save session state to JSON on `before-quit`, restore on startup, layout reconstruction.
**Why fourth:** Requires all UI components (tabs, panes, PTY) to exist so their state can be captured.
**Dependencies:** Phases 1-3 (PTY, Layout, Tabs).
**Deferrable:** Per-pane restore strategies, terminal buffer capture.

### Phase 5: Restore Strategies
**What:** Per-pane restore strategy (background / layout-only / auto-rerun / remain-on-exit), UI for configuring strategy, orphan detection.
**Why fifth:** This is the core differentiator but requires persistence infrastructure.
**Dependencies:** Phase 4 (Session Persistence).
**Deferrable:** Terminal buffer capture (remain-on-exit optimization).

### Phase 6: Keyboard Shortcuts + Polish
**What:** Keyboard-driven navigation, split, close, focus traversal, configurable keybindings.
**Why last:** Nice-to-have that layers on top of existing functionality.
**Dependencies:** Phases 1-5.
**Deferrable:** None (final polish).

### Phase Ordering Rationale

```
PTY Foundation → Multi-Pane → Tabs → Persistence → Restore Strategies → Shortcuts
      │              │           │         │              │                 │
      ▼              ▼           ▼         ▼              ▼                 ▼
   Core I/O      Layout       Org       Auto-save      Differentiator    UX Polish
```

Each phase depends on the previous. No phase can be meaningfully built without its predecessors. Phase 1 is the riskiest (native module compilation, ConPTY quirks) -- if it fails, the project pivots.

### Phase-Specific Research Flags

| Phase | Needs Deeper Research? | Reason |
|-------|----------------------|--------|
| Phase 1: PTY Foundation | MAYBE | node-pty + Electron native module build chain can be tricky; verify node-pty version compatibility with target Electron version |
| Phase 2: Multi-Pane | NO | Standard split-pane patterns, well-understood |
| Phase 3: Tabs | NO | Standard UI component pattern |
| Phase 4: Persistence | MAYBE | Concurrent access to state file (if multiple windows) needs consideration |
| Phase 5: Restore Strategies | YES | Per-pane strategy enforcement on shutdown; orphan detection on startup; "background keep alive" semantics need design |
| Phase 6: Shortcuts | NO | Standard keyboard handler pattern |

## Recovery / Orphan Detection Strategy

### On Startup: Detecting Orphaned Sessions
```
1. Read sessions.json from %APPDATA%/termy/
2. Check if the file has an "orphaned" flag (set when app crashed)
3. For each orphaned session:
   a. Check if the recorded PID is still alive (process.exists(pid))
   b. If alive → mark as "recoverable" (process still running)
   c. If dead → mark as "stale" (layout only)
4. Prompt user: "Found X orphaned sessions. Restore?"
   - Recoverable → show restored terminal (note: no ConPTY reconnection,
     shell is running but we can't capture its output until we spawn a new PTY)
   - Stale → restore layout only, show "session exited" message
```

### Key Limitation: No True PTY Reattachment on Windows
Unlike Unix where you can detach/reattach to a tmux session, Windows ConPTY does not support transferring a live pseudo-console to a new client. The implications:

- **background-keep-alive** strategy: The shell process continues running, but the new terminal instance gets a fresh PTY. The user cannot see the running process's output in the new terminal (the PTY output went to the old, now-closed pipe). This is a fundamental Windows limitation.
- **Mitigation:** For background processes, consider using a named pipe or file redirector that captures output independently of the PTY, so a new PTY connection can replay recent output.
- **Alternative:** For the "background keep alive" case, the realistic expectation is: the process survives, the user can `kill` it from Task Manager or send signals, but they cannot re-attach to its output stream. This is acceptable for long-running processes (servers, watchers) where the user only cares that the process didn't die.

### State File Format (Proposed)
```jsonc
// %APPDATA%/termy/sessions.json
{
  "version": 1,
  "savedAt": "2026-04-15T10:30:00Z",
  "crashed": false,
  "sessions": [
    {
      "id": "session-uuid",
      "name": "my-project",
      "tabs": [
        {
          "id": "tab-uuid",
          "label": "dev",
          "activePane": "pane-uuid-1",
          "layout": {
            "type": "split",
            "direction": "horizontal",
            "children": [
              {
                "type": "pane",
                "id": "pane-uuid-1",
                "size": 0.5,
                "shell": "pwsh",
                "cwd": "C:\\projects\\my-project",
                "command": null,
                "restoreStrategy": "background-keep-alive",
                "exitCode": null,
                "pid": 12345
              },
              {
                "type": "split",
                "direction": "vertical",
                "children": [
                  { "type": "pane", "id": "pane-uuid-2", "size": 0.5, ... },
                  { "type": "pane", "id": "pane-uuid-3", "size": 0.5, ... }
                ]
              }
            ]
          }
        }
      ]
    }
  ]
}
```

## Sources

- [Microsoft: Introducing ConPTY](https://devblogs.microsoft.com/commandline/windows-command-line-introducing-the-windows-pseudo-console-conpty/) -- HIGH confidence
- [Microsoft: Creating a Pseudoconsole Session](https://learn.microsoft.com/en-us/windows/console/creating-a-pseudoconsole-session) -- HIGH confidence
- [node-pty Electron Example](https://github.com/microsoft/node-pty/blob/main/examples/electron/README.md) -- HIGH confidence
- [Windows Terminal Process Model 2.0 Spec](https://github.com/microsoft/terminal/blob/main/doc/specs/%235000%20-%20Process%20Model%202.0/%234472%20-%20Windows%20Terminal%20Session%20Management.md) -- HIGH confidence
- [Windows Terminal ConptyConnection.cpp](https://github.com/microsoft/terminal/blob/master/src/cascadia/TerminalConnection/ConptyConnection.cpp) -- HIGH confidence
- [Windows Terminal In-process ConPTY Spec](https://github.com/microsoft/terminal/blob/main/doc/specs/%2313000%20-%20In-process%20ConPTY.md) -- HIGH confidence
- [WezTerm Multiplexing Docs](https://wezterm.org/multiplexing.html) -- HIGH confidence
- [WezTerm Unix Domains Config](https://wezterm.org/config/lua/config/unix_domains.html) -- HIGH confidence
- [tmux Architecture Overview](https://github.com/tmux/tmux/wiki/Getting-Started) -- HIGH confidence
- [tmux Server/Client Model](https://tao-of-tmux.readthedocs.io/en/latest/manuscript/04-server.html) -- HIGH confidence
- [VS Code terminalProcess.ts](https://github.com/microsoft/vscode/blob/main/src/vs/platform/terminal/node/terminalProcess.ts) -- HIGH confidence
- [VS Code terminalInstance.ts](https://github.com/microsoft/vscode/blob/master/src/vs/workbench/contrib/terminal/browser/terminalInstance.ts) -- HIGH confidence
- [node-pty Issue #382: Proper way to kill PTY](https://github.com/microsoft/node-pty/issues/382) -- MEDIUM confidence
- [node-pty Issue #827: Cannot resize PTY after exit](https://github.com/microsoft/node-pty/issues/827) -- HIGH confidence
- [node-pty Issue #892: Windows resize crash](https://github.com/microsoft/node-pty/issues/892) -- HIGH confidence
- [node-pty Issue #4050: ClosePseudoConsole lingering conhost](https://github.com/microsoft/terminal/issues/4050) -- MEDIUM confidence
- [Raymond Chen: Destroying child processes](https://devblogs.microsoft.com/oldnewthing/20131209-00/?p=2433) -- HIGH confidence
- [Windows Console Ecosystem Roadmap](https://learn.microsoft.com/en-us/windows/console/ecosystem-roadmap) -- HIGH confidence
- [Windows Terminal state.json](https://superuser.com/questions/1801278/what-does-windows-terminals-state-json-file-do) -- MEDIUM confidence
- [resurrect.wezterm Plugin](https://www.reddit.com/r/wezterm/comments/1ef7c94/plugin_resurrectwezterm_save_and_restore_your/) -- LOW confidence (community plugin, not official)
