# Phase 1: PTY Foundation - Research

**Researched:** 2026-04-15
**Domain:** Electron + node-pty + xterm.js terminal emulator stack on Windows 11
**Confidence:** HIGH

## Summary

This phase establishes the irreducible core of Termy: a single Electron window with a real Windows shell (PowerShell 7, Git Bash, or WSL) rendered through xterm.js with WebGL acceleration. The main process owns node-pty lifecycle (spawn, write, resize, kill), the renderer owns the xterm.js UI, and Electron IPC bridges them.

Three risk areas require attention:
1. **Native module compilation** — node-pty 1.1.0 must be rebuilt against Electron 41's Node.js v24 ABI. The build has a documented fallback path.
2. **xterm.js 6.0.0 Vite double-minification bug** — production builds crash when `vim` or similar TUI apps send DCS mode requests. A Vite config override is required.
3. **ConPTY process lifecycle on Windows 11 24H2** — `ClosePseudoConsole` can hang at the OS level. The mitigation is timeout-based taskkill.

**Primary recommendation:** Use electron-vite for build tooling with native module externalization, node-pty in the main process with dedicated per-PTY manager class, and xterm.js 6.0.0 in the renderer with WebGL addon mandatory.

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Default shell on first launch is PowerShell 7 (auto-detected, falls back to Windows PowerShell if PS7 not installed)
- **D-02:** User can switch between PowerShell 7, Git Bash, and WSL (Ubuntu) shells
- **D-03:** Shell choice is remembered per session restore (ties into Phase 3 persistence)
- **D-04:** cmd.exe is NOT included in v1 shell list — user can add custom shells via config later (Phase 5)
- **D-05:** Opening Termy directly pops up a terminal pane — no splash screen, no management UI first
- **D-06:** Shell selector is accessible via UI (dropdown or button) but default is always the last-used or first-time default (PowerShell 7)
- **D-07:** Phase 1 is single-window only — one Electron BrowserWindow with one terminal pane
- **D-08:** Multi-window support deferred to Phase 2+ (requires architectural changes to session management)
- **D-09:** Phase 1 begins with a native module build verification spike — confirm node-pty compiles with the target Electron version on Windows 11 before any feature work
- **D-10:** If node-pty 1.1.0 fails to build, fall back to `@lydell/node-pty` fork (1.2.0-beta.12)
- **D-11:** If both forks fail, design spike to evaluate direct ConPTY FFI via `ffi-napi` or `node-addon-api`
- **D-12:** Electron 41 (latest stable) — node-pty compatibility must be verified first (D-09)
- **D-13:** xterm.js 6.0.0 (@xterm scoped packages) with WebGL renderer addon mandatory
- **D-14:** node-pty 1.1.0 as primary PTY layer, wrapping Windows ConPTY API
- **D-15:** TypeScript strict mode enabled from the start
- **D-16:** Vite as build tool (faster HMR, better Electron integration via electron-vite)

### Claude's Discretion
- PTY process lifecycle management details (spawn/kill/error handling patterns)
- IPC channel naming and message schema design
- Error message wording and formatting

### Deferred Ideas (OUT OF SCOPE)
- cmd.exe support — deferred to Phase 5 (custom shell config)
- Custom shell profiles — deferred to Phase 5
- Terminal themes and fonts — deferred to Phase 5
- Multi-window support — deferred to Phase 2+
- Command palette — deferred to Phase 5

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| PTY process spawn/kill | API / Backend (Electron Main) | — | node-pty requires Node.js native module access; cannot run in renderer |
| PTY data read/write | API / Backend (Electron Main) | — | Pipe I/O through node-pty belongs in main process |
| Terminal rendering | Browser / Client (Renderer) | — | xterm.js runs in Chromium, DOM/WebGL output |
| Keyboard input capture | Browser / Client (Renderer) | — | xterm.js `onData` captures keystrokes in renderer |
| IPC transport | Both | — | Electron IPC bridges renderer key events to main PTY writes, and main PTY output to renderer `write` |
| Shell path detection | API / Backend (Electron Main) | — | File system and PATH lookups require Node.js |
| Window lifecycle (BrowserWindow) | API / Backend (Electron Main) | — | Main process owns Electron window creation |
| Terminal resize propagation | Browser / Client (Renderer) | API / Backend (Main) | Fit addon detects DOM size change, IPCs to main which calls pty.resize() |
| Exit status display | API / Backend (Main) | Browser / Client (Renderer) | Main detects process exit via `onExit`, IPCs status to renderer for display |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| electron | 41.2.0 | Desktop shell, Chromium 146 + Node.js v24.14 | Ships Node.js v24.14.0 which node-pty 1.1.0 targets; latest stable as of 2026-04 [VERIFIED: npm registry] |
| @xterm/xterm | 6.0.0 | Terminal rendering engine | VS Code's choice, most mature web terminal renderer, full ANSI/VT escape support [VERIFIED: npm registry] |
| node-pty | 1.1.0 | PTY process management via ConPTY | Microsoft-maintained, used by VS Code Terminal, wraps Windows ConPTY natively [VERIFIED: npm registry] |
| typescript | 5.x | Language | xterm.js and node-pty both ship TS types, full-stack type safety [VERIFIED: npm registry] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @xterm/addon-fit | 0.11.0 | Fit terminal to container DOM element | Always — required for responsive resize handling [VERIFIED: npm registry] |
| @xterm/addon-webgl | 0.19.0 | GPU-accelerated rendering via WebGL2 | Always — DOM renderer is unusably slow for high-throughput output [VERIFIED: npm registry] |
| @xterm/addon-search | 0.16.0 | In-terminal text search | Always — PTY-03 requirement, table-stakes for terminal [VERIFIED: npm registry] |
| @xterm/addon-ligatures | 0.10.0 | Font ligature rendering (Fira Code, Cascadia Code) | Deferred to Phase 5 (UX-06 fonts) — do NOT install for Phase 1 [VERIFIED: npm registry] |
| electron-vite | latest | Build tool (Vite + Electron) | Always — D-16 locked, handles 3-process build pipeline [VERIFIED: web search] |
| electron-builder | 26.8.1 | Packaging, native module rebuild | Always — packages the app, handles node-pty asar unpacking [VERIFIED: npm registry] |
| @electron/rebuild | 4.0.3 | Rebuild native modules for Electron ABI | Always — required because node-pty is a native module compiled against Electron's Node.js ABI [VERIFIED: npm registry] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| node-pty 1.1.0 | @lydell/node-pty 1.2.0-beta.12 | Community fork, smaller distribution, known bug "Cannot resize a pty that has already exited" on Node.js v22+ (issue #827, #854) — **use as fallback only** [VERIFIED: GitHub issues] |
| node-pty 1.1.0 | node-pty-prebuilt-multiarch 0.10.1-pre.5 | Prebuilt binaries, but older version line, less maintained |
| electron-vite | electron-forge | More complex config, different plugin ecosystem, no proven advantage for this stack |
| direct ConPTY FFI | ffi-napi + node-addon-api | High complexity risk — would need to implement CreatePseudoConsole, ResizePseudoConsole, ClosePseudoConsole, pipe management manually [VERIFIED: Microsoft docs] |

**Installation:**
```bash
# Core dependencies
npm install electron @xterm/xterm @xterm/addon-fit @xterm/addon-webgl @xterm/addon-search

# Dev dependencies
npm install -D typescript electron-vite electron-builder @electron/rebuild @types/node
```

**Version verification:**
| Package | Verified Version | Verified Date |
|---------|-----------------|---------------|
| electron | 41.2.0 | 2026-04-15 [VERIFIED: npm registry] |
| @xterm/xterm | 6.0.0 | 2026-04-15 [VERIFIED: npm registry] |
| @xterm/addon-fit | 0.11.0 | 2026-04-15 [VERIFIED: npm registry] |
| @xterm/addon-webgl | 0.19.0 | 2026-04-15 [VERIFIED: npm registry] |
| @xterm/addon-search | 0.16.0 | 2026-04-15 [VERIFIED: npm registry] |
| @xterm/addon-ligatures | 0.10.0 | 2026-04-15 [VERIFIED: npm registry] |
| electron-builder | 26.8.1 | 2026-04-15 [VERIFIED: npm registry] |
| @electron/rebuild | 4.0.3 | 2026-04-15 [VERIFIED: npm registry] |
| node-pty | 1.1.0 | 2026-04-15 [VERIFIED: npm registry] |
| @lydell/node-pty | 1.2.0-beta.12 | 2026-04-15 [VERIFIED: npm registry] |

## Architecture Patterns

### System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                     Electron App                              │
│                                                               │
│  ┌─────────────┐         Electron IPC         ┌─────────────┐ │
│  │   Main       │ ◄──────────────────────────► │  Renderer   │ │
│  │  Process     │                              │  Process    │ │
│  │             │                              │             │ │
│  │ PtyManager  │                              │  TerminalUI  │ │
│  │  ┌───────┐  │  1. onData (key events)      │  ┌────────┐ │ │
│  │  │node-pty│  │ ◄────────────────────────── │  │xterm.js│ │ │
│  │  │(ConPTY)│  │  2. write (pty output)      │  │+ WebGL │ │ │
│  │  └───┬───┘  │ ──────────────────────────►  │  └────────┘ │ │
│  │      │      │  3. onExit (exit code)       │  ┌────────┐ │ │
│  │      │      │ ◄──────────────────────────  │  │FitAddon│ │ │
│  │      │      │  4. resize (cols/rows)       │  └────────┘ │ │
│  │      │      │ ──────────────────────────►  │  ┌────────┐ │ │
│  │      ▼      │                              │  │Search  │ │ │
│  │  conhost.exe │                              │  │Addon   │ │ │
│  │  ┌───────┐  │                              │  └────────┘ │ │
│  │  │pwsh   │  │                              │             │ │
│  │  │/bash  │  │                              └─────────────┘ │
│  │  └───────┘  │                                                │
│  └─────────────┘                                                │
└──────────────────────────────────────────────────────────────┘
```

Data flow for primary use case (user types command):
1. User presses keys → xterm.js `onData` fires in renderer
2. Renderer sends `pty-write` IPC message with keystroke data to main
3. Main calls `pty.write(data)` → ConPTY translates to terminal input → shell processes
4. Shell outputs data → ConPTY translates to VT escape sequences → node-pty reads from pipe
5. Main sends `pty-data` IPC message with output string to renderer
6. Renderer calls `terminal.write(data)` → WebGL renders to canvas

### Recommended Project Structure
```
src/
├── main/              # Electron main process
│   ├── index.ts       # App entry, BrowserWindow lifecycle
│   ├── ipc.ts         # IPC channel registration
│   └── pty/
│       ├── manager.ts       # PtyManager: spawn/kill/resize per-PTY
│       ├── shell-detector.ts # Auto-detect pwsh.exe, bash, wsl
│       └── types.ts         # PTY session state types
├── preload/           # Preload script (contextBridge)
│   └── index.ts       # Expose terminal IPC channels safely
├── renderer/          # Electron renderer process
│   ├── index.html     # HTML entry
│   ├── main.ts        # Renderer entry, Terminal bootstrap
│   └── terminal/
│       ├── terminal-instance.ts  # xterm.js setup + addon loading
│       └── terminal-handlers.ts  # IPC listeners, key event forwarding
└── shared/            # Shared types between main/renderer
    └── ipc-channels.ts # Typed IPC channel names and message shapes
```

### Pattern 1: PTY Manager (Main Process)
**What:** Singleton class managing node-pty lifecycle — spawn, write, resize, kill, exit handling.

**When to use:** Always — this is the core abstraction between Electron main and node-pty.

**Example:**
```typescript
// Source: Adapted from VS Code TerminalProcess pattern + node-pty API
import * as pty from 'node-pty';
import { EventEmitter } from 'events';

interface PtySession {
  id: string;
  process: pty.IPty;
  shell: string;
  cwd: string;
  cols: number;
  rows: number;
}

export class PtyManager extends EventEmitter {
  private sessions: Map<string, PtySession> = new Map();

  spawn(id: string, shell: string, cwd: string, cols: number, rows: number): PtySession {
    const env = { ...process.env } as Record<string, string>;

    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd,
      env,
      useConpty: true, // Explicit: Windows ConPTY only
    });

    const session: PtySession = { id, process: ptyProcess, shell, cwd, cols, rows };
    this.sessions.set(id, session);

    ptyProcess.onData((data: string) => {
      this.emit('data', { sessionId: id, data });
    });

    ptyProcess.onExit(({ exitCode, signal }) => {
      this.emit('exit', { sessionId: id, exitCode, signal });
      this.sessions.delete(id);
    });

    return session;
  }

  write(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.process.write(data);
    }
  }

  resize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.process.resize(cols, rows);
      session.cols = cols;
      session.rows = rows;
    }
  }

  kill(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      // CRITICAL: ConPTY ClosePseudoConsole can hang on Win11 24H2
      // Use timeout-based fallback
      const timeout = setTimeout(() => {
        // Force kill the shell process tree if close hangs
        try {
          require('child_process').execSync(
            `taskkill /PID ${session.process.pid} /T /F`,
            { stdio: 'ignore' }
          );
        } catch { /* process already dead */ }
      }, 3000);

      session.process.kill();
      clearTimeout(timeout);
      this.sessions.delete(sessionId);
    }
  }
}
```

### Pattern 2: IPC Channel Design
**What:** Typed IPC channels between renderer and main process for terminal communication.

**When to use:** Always — this is the only way renderer can interact with PTY.

**Example:**
```typescript
// src/shared/ipc-channels.ts
// Channel names — single source of truth
export const IPC_CHANNELS = {
  // Renderer → Main
  PTY_SPAWN: 'pty:spawn',           // { shell, cwd, cols, rows }
  PTY_WRITE: 'pty:write',           // { sessionId, data }
  PTY_RESIZE: 'pty:resize',         // { sessionId, cols, rows }
  PTY_KILL: 'pty:kill',             // { sessionId }

  // Main → Renderer
  PTY_DATA: 'pty:data',             // { sessionId, data }
  PTY_EXIT: 'pty:exit',             // { sessionId, exitCode, signal }
} as const;

// Preload script exposes these via contextBridge
// Renderer calls: window.terminalAPI.spawn(shell, cwd, cols, rows)
// Renderer listens: window.terminalAPI.onData(callback)
```

### Pattern 3: xterm.js Initialization (Renderer)
**What:** Bootstrap xterm.js with required addons, connect to IPC.

**When to use:** Always — this is the renderer entry point.

**Example:**
```typescript
// src/renderer/terminal/terminal-instance.ts
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { SearchAddon } from '@xterm/addon-search';
import type { ITerminalOptions } from '@xterm/xterm';

const OPTIONS: ITerminalOptions = {
  allowProposedApi: true,     // Required for some addon APIs
  cursorBlink: true,
  fontSize: 14,
  fontFamily: '"Cascadia Code", "Consolas", "Courier New", monospace',
  scrollback: 10000,          // Reasonable default, configurable later
  convertEol: true,           // Convert \n to \r\n for Windows PTY
};

export function createTerminal(container: HTMLElement) {
  const terminal = new Terminal(OPTIONS);

  // Load addons — order matters: fit before webgl for correct sizing
  const fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);

  const webglAddon = new WebglAddon();
  terminal.loadAddon(webglAddon);

  const searchAddon = new SearchAddon();
  terminal.loadAddon(searchAddon);

  terminal.open(container);
  fitAddon.fit();

  // Activate WebGL renderer (falls back to DOM if WebGL unavailable)
  try {
    webglAddon.activate(terminal);
  } catch {
    console.warn('WebGL unavailable, falling back to DOM renderer');
  }

  return { terminal, fitAddon, webglAddon, searchAddon };
}
```

### Pattern 4: Shell Detection (Main Process)
**What:** Auto-detect available shells on Windows, prioritize PS7.

**When to use:** On app startup to determine default shell.

**Example:**
```typescript
// src/main/pty/shell-detector.ts
import { existsSync } from 'fs';
import { join } from 'path';

export interface ShellProfile {
  id: string;
  label: string;
  path: string;
  args?: string[];
}

export function detectShells(): ShellProfile[] {
  const shells: ShellProfile[] = [];

  // 1. PowerShell 7 (pwsh.exe) — check default install path first
  const pwshPath = 'C:\\Program Files\\PowerShell\\7\\pwsh.exe';
  if (existsSync(pwshPath)) {
    shells.push({ id: 'pwsh', label: 'PowerShell 7', path: pwshPath });
  } else if (isInPath('pwsh.exe')) {
    shells.push({ id: 'pwsh', label: 'PowerShell 7', path: 'pwsh.exe' });
  }

  // 2. Windows PowerShell (powershell.exe) — always available
  shells.push({
    id: 'powershell',
    label: 'Windows PowerShell',
    path: 'powershell.exe',
  });

  // 3. Git Bash — check default install paths
  const gitBashPaths = [
    'C:\\Program Files\\Git\\bin\\bash.exe',
    'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
  ];
  for (const p of gitBashPaths) {
    if (existsSync(p)) {
      shells.push({ id: 'git-bash', label: 'Git Bash', path: p });
      break;
    }
  }

  // 4. WSL Ubuntu
  if (isWslAvailable()) {
    shells.push({
      id: 'wsl',
      label: 'WSL (Ubuntu)',
      path: 'wsl.exe',
      args: ['--distribution', 'Ubuntu'],
    });
  }

  return shells;
}

function isInPath(executable: string): boolean {
  const pathEnv = process.env.PATH || '';
  const paths = pathEnv.split(';');
  return paths.some(dir => existsSync(join(dir, executable)));
}

function isWslAvailable(): boolean {
  try {
    require('child_process').execSync('wsl --list --quiet', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
```

### Anti-Patterns to Avoid
- **Running node-pty in renderer:** Requires `nodeIntegration: true` which is a critical security vulnerability. Always keep PTY in main process.
- **Synchronous IPC for PTY data:** `ipcRenderer.sendSync` blocks the renderer. Always use async `ipcRenderer.invoke` or `ipcRenderer.send` + `ipcRenderer.on` for PTY data flow.
- **Bundling node-pty with Vite:** node-pty contains native `.node` binaries that Vite cannot bundle. Must be externalized via `build.externalizeDeps` in electron-vite config.
- **Using `child_process.spawn` instead of node-pty:** Plain spawn gives a pipe, not a PTY — no terminal semantics, no VT sequences, no interactive shell support.
- **Double-minification of xterm.js in Vite:** xterm.js 6.0.0 ships pre-minified. Vite's production build re-minifies, causing `ReferenceError: i is not defined` in `InputHandler.requestMode`. Must exclude from minification (see Pitfall 2).
- **Not handling ConPTY close hangs:** `ClosePseudoConsole` can hang indefinitely on Windows 11 24H2 (issue #17688). Always implement timeout-based fallback.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PTY process management | Direct ConPTY via FFI | node-pty | node-pty handles pipe creation, process spawning, encoding, resize, and exit detection correctly. Rolling your own FFI for CreatePseudoConsole/ResizePseudoConsole/ClosePseudoConsole is unnecessary risk and error-prone [VERIFIED: Microsoft docs] |
| Terminal rendering | Custom canvas/DOM renderer | @xterm/xterm | xterm.js has 10+ years of ANSI/VT escape compliance. Rolling your own means handling hundreds of escape sequences, cursor modes, charset mappings [VERIFIED: xterm.js docs] |
| GPU rendering | Custom WebGL shaders | @xterm/addon-webgl | WebGL addon is optimized, maintained, and handles texture atlas, glyph rendering correctly |
| Native module rebuild | Manual node-gyp invocation | @electron/rebuild | Handles Electron ABI matching, dist-url, headers download automatically [VERIFIED: electron docs] |
| Electron build pipeline | Custom webpack/vite config | electron-vite | Handles 3-process build (main/preload/renderer), dependency externalization, HMR out of the box [VERIFIED: electron-vite docs] |
| Shell path detection | Hardcoded paths | Runtime detection function | PowerShell 7 may not be installed, Git Bash may be in custom location, WSL distro name varies [VERIFIED: community patterns] |

**Key insight:** The terminal emulator domain has decades of accumulated edge cases in escape sequence handling, PTY lifecycle, and cross-version Windows compatibility. Every component in the standard stack exists because someone tried to build it from scratch and discovered the complexity.

## Common Pitfalls

### Pitfall 1: node-pty Native Module Build Failure
**What goes wrong:** `npm install` or `npm run build` fails because node-pty's native C++ code cannot be compiled or is compiled against the wrong Node.js ABI.

**Why it happens:** node-pty 1.1.0 was released when Electron shipped Node.js v20-v22. Electron 41 ships Node.js v24.14.0. The native module must be rebuilt against Electron's Node.js headers, not the system Node.js version.

**How to avoid:**
1. Install Visual Studio Build Tools 2022 with "Desktop development with C++" workload BEFORE running npm install
2. Ensure Python 3.x is available (node-gyp requirement)
3. Run `npx @electron/rebuild` after npm install to rebuild against Electron ABI
4. If build fails, try `@lydell/node-pty` fork as fallback (D-10)
5. Configure electron-builder `asarUnpack` for node-pty:
   ```json
   {
     "build": {
       "asarUnpack": ["**/node_modules/node-pty/**"]
     }
   }
   ```

**Warning signs:** `NODE_MODULE_VERSION` mismatch errors, `gyp ERR!` during install, `Cannot find module '../build/Release/pty.node'` at runtime.

### Pitfall 2: xterm.js 6.0.0 Vite Double-Minification Crash
**What goes wrong:** Production build of the app crashes when user opens `vim`, `htop`, `less`, or any TUI that sends DCS mode requests. Error: `ReferenceError: i is not defined at requestMode`.

**Why it happens:** xterm.js 6.0.0 ships pre-minified ESM at `lib/xterm.mjs`. Vite's production build runs esbuild which re-minifies already-minified code. esbuild's identifier-mangling pass renames a parameter inside `InputHandler.requestMode` but leaves a closure referencing the old name. [VERIFIED: GitHub issue xtermjs/xterm.js#5800]

**How to avoid:** Add to `electron.vite.config.ts`:
```typescript
export default defineConfig({
  renderer: {
    build: {
      rollupOptions: {
        // Exclude xterm.js from esbuild minification
        // This prevents double-minification scope corruption
      }
    },
    optimizeDeps: {
      exclude: ['@xterm/xterm', '@xterm/addon-fit', '@xterm/addon-webgl', '@xterm/addon-search']
    }
  }
})
```
If the issue persists in production builds, add esbuild override:
```typescript
renderer: {
  esbuild: {
    minifyIdentifiers: false  // Prevent identifier mangling on xterm.js
  }
}
```

**Warning signs:** Terminal works in `electron-vite dev` mode but crashes in packaged/production build when running interactive TUIs.

### Pitfall 3: ConPTY ClosePseudoConsole Hang on Windows 11 24H2
**What goes wrong:** App shutdown hangs indefinitely because `ClosePseudoConsole` blocks on the OS level.

**Why it happens:** Known Windows 11 24H2 bug — race condition in ConPTY teardown when `PSEUDOCONSOLE_INHERIT_CURSOR` flag is used. The hang is at the OS level, not fixable in application code. [VERIFIED: GitHub issue microsoft/terminal#17688]

**How to avoid:**
1. Implement timeout-based kill: start a 3-second timer before calling `pty.kill()`
2. If timeout fires, use `taskkill /PID <pid> /T /F` to force-kill the process tree
3. Do NOT use `PSEUDOCONSOLE_INHERIT_CURSOR` flag (node-pty doesn't expose it anyway)
4. In app `before-quit` handler, kill all PTY sessions with timeout, then proceed

**Warning signs:** App doesn't close on quit, stays in task manager with 0% CPU, no error messages.

### Pitfall 4: node-pty asar Packaging Incompatibility
**What goes wrong:** Packaged app crashes at startup with `Cannot find module` error for node-pty native binary.

**Why it happens:** node-pty cannot load its native binary when packed inside Electron's asar archive. The native `.node` file must be accessible as a real file on disk. [VERIFIED: GitHub issue microsoft/node-pty#372]

**How to avoid:** Configure electron-builder:
```json
{
  "build": {
    "asarUnpack": ["**/node_modules/node-pty/**"]
  }
}
```

**Warning signs:** Works in dev mode, crashes immediately in production with `Cannot find module` for `pty.node`.

### Pitfall 5: Orphaned conhost.exe Processes
**What goes wrong:** After Termy closes, `conhost.exe` and shell processes remain running as orphans.

**Why it happens:** ConPTY host process (conhost.exe) can outlive the Electron app if not properly killed. On crash or force-quit, no cleanup code runs. [VERIFIED: GitHub issue microsoft/terminal#9914]

**How to avoid:**
1. On app `before-quit`, iterate all active PTY sessions and call `kill()` with timeout fallback
2. On app startup, scan for orphaned processes from previous session and clean them up
3. Consider using Windows Job Objects with `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE` for automatic cleanup (requires node-pty to support this, or direct Win32 API call)

**Warning signs:** Task Manager shows multiple conhost.exe / pwsh.exe processes after closing Termy.

### Pitfall 6: Electron IPC Backpressure with High-Throughput Terminal Output
**What goes wrong:** Terminal output lags or drops characters during high-throughput scenarios (e.g., `cat` a large file, running build scripts with lots of output).

**Why it happens:** Electron IPC has a message size limit and serialization overhead. Flooding IPC with individual characters or small chunks creates queue buildup.

**How to avoid:**
1. Buffer PTY output and send in chunks (e.g., every 16ms or when buffer reaches 4KB)
2. Use `setTimeout` batching in node-pty `onData` handler
3. VS Code uses a similar buffering approach in their TerminalProcess

**Example:**
```typescript
// Buffer and batch PTY output
let buffer = '';
let scheduled = false;

ptyProcess.onData((data: string) => {
  buffer += data;
  if (!scheduled) {
    scheduled = true;
    setImmediate(() => {
      scheduled = false;
      if (buffer.length > 0) {
        mainWindow.webContents.send(PTY_DATA, { sessionId, data: buffer });
        buffer = '';
      }
    });
  }
});
```

### Pitfall 7: Missing Build Toolchain on Fresh Windows Setup
**What goes wrong:** Fresh clone of the project on a new machine fails to build because Visual Studio Build Tools, C++ workload, or Python are not installed.

**Why it happens:** node-pty requires native compilation on Windows. The build toolchain is not automatically installed by npm.

**How to avoid:**
1. Document prerequisites in README: Visual Studio Build Tools 2022, Python 3.x
2. Add a build verification script that checks for prerequisites
3. Phase 1 MUST begin with the build verification spike (D-09)
4. Provide a setup script or winget commands for one-click toolchain install:
   ```powershell
   winget install Microsoft.VisualStudio.2022.BuildTools --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
   winget install Python.Python.3.12
   ```

**Warning signs:** `gyp ERR! find VS` or `gyp ERR! find Python` during npm install.

## Code Examples

### electron.vite.config.ts
```typescript
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        external: ['node-pty'], // Ensure node-pty is not bundled
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    optimizeDeps: {
      exclude: [
        '@xterm/xterm',
        '@xterm/addon-fit',
        '@xterm/addon-webgl',
        '@xterm/addon-search',
      ],
    },
    esbuild: {
      // Prevent double-minification crash (Pitfall 2)
      // Only needed if Vite re-minifies xterm.mjs
      // minifyIdentifiers: false, // Uncomment if needed
    },
  },
});
```

### electron-builder.json
```json
{
  "appId": "com.termy.app",
  "productName": "Termy",
  "directories": {
    "output": "release"
  },
  "files": [
    "dist/**/*"
  ],
  "asarUnpack": [
    "**/node_modules/node-pty/**"
  ],
  "win": {
    "target": "nsis"
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true
  },
  "electronDownload": {
    "version": "41.2.0"
  }
}
```

### tsconfig.json (strict mode, D-15)
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "release"]
}
```

### package.json scripts
```json
{
  "name": "termy",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "rebuild": "electron-rebuild",
    "package": "npm run build && electron-builder",
    "verify-build": "node scripts/verify-build-tools.js"
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| xterm (unscoped) + xterm-addon-* | @xterm/xterm + @xterm/addon-* | xterm.js 5.0 (2023) | Old packages deprecated, must use scoped packages |
| Canvas renderer (default) | WebGL renderer (mandatory) | xterm.js 6.0 (Dec 2025) | Canvas addon removed entirely, WebGL is the only GPU option |
| windowsMode option | Automatic ConPTY detection | xterm.js 5.x | windowsMode removed; ConPTY behavior is now automatic |
| webpack for Electron | electron-vite (Vite-based) | 2023-2024 | Faster dev builds, better DX, native HMR |
| electron-rebuild (CLI) | @electron/rebuild (programmatic) | 2024 | Official Electron tool, renamed from electron-rebuild |
| winpty (fallback on Windows) | ConPTY only (winpty dead) | VS Code 1.96 (Dec 2025) | winpty removed entirely from node-pty; requires Windows 10 1809+ |

**Deprecated/outdated:**
- `xterm` package (v5.3.0): Use `@xterm/xterm` instead
- `xterm-addon-*` packages: Use `@xterm/addon-*` instead
- `winpty`: Dead since Dec 2025, removed from node-pty and VS Code
- `nodeIntegration: true`: Security vulnerability, always use `contextIsolation: true`

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Node.js v24.14.0 (Electron 41) is compatible with node-pty 1.1.0 after rebuild | Standard Stack | If incompatible, entire Phase 1 blocked — fallback to @lydell/node-pty (D-10) |
| A2 | electron-vite can handle 3-process build (main/preload/renderer) without custom plugins for this stack | Architecture Patterns | May need additional config or plugin for proper native module handling |
| A3 | `optimizeDeps.exclude` in Vite config prevents the double-minification crash for xterm.js 6.0.0 | Pitfall 2 | If exclude doesn't work, need `esbuild.minifyIdentifiers: false` as additional override |
| A4 | WSL availability check via `wsl --list --quiet` is reliable on Windows 11 | Shell Detection Pattern | WSL may be installed but not have Ubuntu distro — need more robust detection |
| A5 | @xterm/addon-fit 0.11.0, @xterm/addon-webgl 0.19.0, @xterm/addon-search 0.16.0 are compatible with @xterm/xterm 6.0.0 | Standard Stack | Version incompatibility would cause runtime errors — must verify after install |

## Open Questions

1. **Electron 41 + node-pty 1.1.0 exact build outcome**
   - What we know: Issue #728 was CLOSED (was about Electron 33 + node-pty 1.0.0 on Linux); Electron 41 ships Node.js v24.14.0 which is newer than what node-pty 1.1.0 was tested against
   - What's unclear: Whether the rebuild succeeds on Windows 11 specifically with Electron 41
   - Recommendation: Phase 1 MUST start with build verification spike (D-09) — this is the first task

2. **@xterm/addon-image compatibility**
   - What we know: Known rendering bug in 6.0 (Issue #5644 — parsed but not rendered to canvas)
   - What's unclear: Whether a patch release (6.0.1+) has fixed it
   - Recommendation: Defer addon-image to Phase 2+ (v2 requirement ADV-05 Sixel)

3. **Vite + node-pty production bundling**
   - What we know: node-pty must be externalized (not bundled) because it contains native `.node` binaries
   - What's unclear: Whether electron-vite's `externalizeDepsPlugin` handles this automatically or needs explicit `external: ['node-pty']` in rollupOptions
   - Recommendation: Verify during build spike; add explicit external config as safety net

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All | ✓ | v24.13.1 | — |
| npm | All | ✓ | 11.8.0 | — |
| TypeScript | All | ✗ | — | npm install -D typescript |
| Visual Studio Build Tools 2022 | node-pty native build | ✗ | — | Blocker — MUST install before Phase 1 |
| Python 3.x | node-gyp (via node-pty build) | ✓ | 3.12.4 | — |
| cmake | Some native builds | ✗ | — | node-pty uses node-gyp, does NOT require cmake |
| WSL | WSL shell support | Unknown | — | Graceful degradation — skip WSL shell option |
| Git Bash | Git Bash shell support | Unknown | — | Graceful degradation — skip Git Bash option |

**Missing dependencies with no fallback:**
- Visual Studio Build Tools 2022 with "Desktop development with C++" workload — **BLOCKER for Phase 1**. Must be installed before any node-pty build attempt.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (recommended for Vite projects) + playwright (E2E) |
| Config file | None yet — see Wave 0 |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PTY-01 | ConPTY spawns shell process (pwsh/cmd/wsl) | unit | `vitest run src/main/pty/manager.test.ts` | Wave 0 |
| PTY-02 | xterm.js renders output with 256-color/true color | unit + visual | `vitest run src/renderer/terminal/terminal-instance.test.ts` | Wave 0 |
| PTY-03 | Keyboard input passes to PTY process | integration | `vitest run tests/pty-input.test.ts` | Wave 0 |
| PTY-04 | Process exit displays exit status | unit | `vitest run src/main/pty/manager.test.ts -t exit` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose` (unit tests only)
- **Per wave merge:** `npx vitest run` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `vitest` not installed — add as dev dependency
- [ ] `tests/` directory does not exist — create during Phase 1
- [ ] `playwright` for E2E — defer to Phase 2+ when UI is stable
- [ ] No `electron-vite` project scaffold — Phase 1 Task 1 must create this

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Phase 1 has no authentication |
| V3 Session Management | No | Phase 1 has no session management |
| V4 Access Control | No | Single-user desktop app, no multi-tenant access control |
| V5 Input Validation | Yes | Validate shell paths before spawning (no arbitrary command injection via shell selection) |
| V6 Cryptography | No | Phase 1 has no cryptographic operations |

### Known Threat Patterns for Electron + xterm.js + node-pty

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Shell path injection via user config | Tampering | Validate shell path against allowlist of detected shells before spawn |
| XSS via terminal output (ANSI escape sequences) | Spoofing | xterm.js sanitizes output by default; ensure no innerHTML usage in renderer |
| node-pty native module RCE | Tampering | `contextIsolation: true`, `nodeIntegration: false`, preload only |
| Arbitrary PTY write from renderer | Elevation of Privilege | IPC channel validation — only allow `pty:write` with string data, not arbitrary commands |
| asar unpack exposure of native binaries | Information Disclosure | Expected behavior — node-pty MUST be unpacked; no secret data in native modules |

## Sources

### Primary (HIGH confidence)
- [node-pty npm 1.1.0](https://www.npmjs.com/package/node-pty) — version, dependencies (node-addon-api ^7.1.0) verified
- [@xterm/xterm npm 6.0.0](https://www.npmjs.com/package/@xterm/xterm) — version, package structure verified via npm pack
- [electron npm 41.2.0](https://www.npmjs.com/package/electron) — version, dependencies, Node.js v24.14.0 verified
- [Microsoft/node-pty GitHub](https://github.com/microsoft/node-pty) — official source, API patterns
- [xtermjs/xterm.js GitHub](https://github.com/xtermjs/xterm.js) — official source, 6.0.0 release
- [electron-vite docs](https://electron-vite.org/guide/) — build configuration, dependency handling
- [Electron native modules docs](https://electronjs.org/docs/latest/tutorial/using-native-modules) — native module handling
- [VS Code terminalProcess.ts](https://github.com/microsoft/vscode/blob/main/src/vs/platform/terminal/node/terminalProcess.ts) — reference implementation
- [VS Code Architecture](https://code.visualstudio.com/docs) — multi-process terminal architecture

### Secondary (MEDIUM confidence)
- [node-pty issue #728 (CLOSED)](https://github.com/microsoft/node-pty/issues/728) — Electron compatibility issue, resolved
- [node-pty issue #827 (OPEN)](https://github.com/microsoft/node-pty/issues/827) — @lydell/node-pty crash on Node.js v22+ on Windows
- [node-pty issue #854 (CLOSED)](https://github.com/microsoft/node-pty/issues/854) — @lydell/node-pty "Cannot resize a pty that has already exited"
- [node-pty issue #789 (CLOSED)](https://github.com/microsoft/node-pty/issues/789) — posix_spawnp failed in packaged Electron app
- [node-pty issue #471 (CLOSED)](https://github.com/microsoft/node-pty/issues/471) — conPty does not release stdin/terminal
- [node-pty issue #372](https://github.com/microsoft/node-pty/issues/372) — asar incompatibility
- [xterm.js issue #5800 (OPEN)](https://github.com/xtermjs/xterm.js/issues/5800) — Vite double-minification crash
- [xterm.js issue #5644](https://github.com/xtermjs/xterm.js/issues/5644) — Sixel parsing but not rendering
- [Windows Terminal issue #17688 (CLOSED)](https://github.com/microsoft/terminal/issues/17688) — ClosePseudoConsole hangs
- [Windows Terminal issue #9914](https://github.com/microsoft/terminal/issues/9914) — Orphaned processes on force-close
- [Electron 41 release blog](https://electronjs.org/blog/electron-41-0) — Node.js v24.14.0, Chromium 146
- [VS Code sandboxing migration](https://code.visualstudio.com/blogs/2022/11/28/vscode-sandbox) — multi-process architecture rationale

### Tertiary (LOW confidence)
- Specific electron-vite config for native module externalization with node-pty — needs verification during build spike
- Windows shell detection heuristics — edge cases (winget install paths, ARM64) not fully mapped
- WebSearch results for ConPTY job object patterns — need verification against official Microsoft docs during implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified via npm registry on 2026-04-15
- Architecture: HIGH — patterns verified against VS Code source code and official Electron/xterm.js/node-pty documentation
- Pitfalls: HIGH — each pitfall backed by specific GitHub issues with verified error messages and workarounds
- Electron 41 + node-pty compatibility: MEDIUM — build must be verified at runtime; fallback path documented

**Research date:** 2026-04-15
**Valid until:** 2026-05-15 (30 days — stable stack, but xterm.js 6.0.x patch releases may address known issues)
