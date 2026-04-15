# Technology Stack

**Project:** Termy — Windows terminal emulator with persistent session management
**Researched:** 2026-04-15

## Recommended Stack

### Core Framework
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Electron | 41.x (latest stable) | Desktop shell, Chromium renderer | Fastest dev velocity for this use case, full TypeScript across main+renderer, mature native module ecosystem (node-pty prebuilt support), proven at scale by VS Code's integrated terminal |
| TypeScript | 5.x | Language | Full-stack type safety, xterm.js and node-pty both ship TS types, eliminates IPC payload shape bugs |

### PTY Layer
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| node-pty | 1.1.0 (npm) | Fork pseudo-terminals via Windows ConPTY API | Maintained by Microsoft, used by VS Code Terminal, wraps ConPTY natively on Windows 10 1809+, clean TypeScript API, prebuilt binaries available via `@homebridge/node-pty-prebuilt-multiarch` as fallback |

### Rendering Layer
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| @xterm/xterm | 6.0.0 | Terminal rendering engine | VS Code's terminal engine, most mature web terminal renderer, full ANSI/VT escape support, active development |
| @xterm/addon-fit | 6.0.x | Fit terminal to container DOM element | Required for responsive resize handling |
| @xterm/addon-webgl | 6.0.x | GPU-accelerated rendering via WebGL2 | DOM renderer is unusably slow for high-throughput output; WebGL is mandatory for smooth scrolling, large scrollback buffers, and acceptable input latency |
| @xterm/addon-ligatures | 6.0.x | Font ligature rendering (Fira Code, Cascadia Code, etc.) | Users expect modern coding fonts to render correctly |
| @xterm/addon-search | 6.0.x | In-terminal text search | Table-stakes feature for any terminal |
| @xterm/addon-image | 6.0.x | Sixel/iTerm inline image protocol | Optional; known rendering bugs in 6.0 (Issue #5644 — parsed but not rendered to canvas). Defer until fixed. |

### Infrastructure
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| electron-builder | 26.x | Packaging, native module rebuild | Industry standard, auto-updates, handles node-pty native compilation |
| @electron/rebuild | 4.x | Rebuild native modules for Electron | Official Electron tool, required because node-pty is a native module that must be compiled against Electron's Node.js ABI |

### Supporting Libraries
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | 3.x | JSON schema validation for session state | Always — validate all saved/restored session files against schema |
| json-schema | draft-07/2020-12 | Formal schema for session persistence | Always — enables IDE autocomplete and manual editing of session files |
| electron-store | 9.x | Persistent config/settings storage | For app preferences (theme, font, keybindings, restore strategy defaults) |

## Alternatives Considered

### PTY Layer

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Windows PTY | node-pty (ConPTY) | winpty | **DEAD.** VS Code and node-pty removed winpty support entirely (Issue #284519, Dec 2025). Screen-scraping architecture, incomplete VT support, no longer maintained. |
| Windows PTY | node-pty (ConPTY) | @lydell/node-pty fork (1.2.0-beta) | Consider as **fallback only** if official node-pty has Electron 41 compatibility issues. Smaller distribution, community-maintained. |
| Windows PTY | node-pty (ConPTY) | Direct ConPTY via FFI/node-ffi-napi | Too much complexity. node-pty already handles the FFI layer correctly, manages pipe creation, process spawning, and encoding. Rolling your own FFI for CreatePseudoConsole/ResizePseudoConsole/ClosePseudoConsole is unnecessary risk. |
| Cross-platform PTY | node-pty | node-pty-prebuilt-multiarch | Use only if node-pty native compilation fails on target machines. Provides prebuilt binaries for Windows x64/ia32. |

### Rendering Layer

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Terminal renderer | @xterm/xterm | Custom canvas/DOM renderer | xterm.js has 10+ years of ANSI/VT escape compliance. Rolling your own means handling hundreds of escape sequences, cursor modes, charset mappings. Not worth it. |
| Terminal renderer | @xterm/xterm | libghostty WASM | Emerging (2025). xterm.js is exploring adopting libghostty for rendering, but it's not production-ready as a drop-in replacement yet. Watch for migration path in future xterm.js versions. |
| Terminal renderer | @xterm/xterm | terminal.js / jquery.terminal | Significantly less mature, fewer features, smaller ecosystem. xterm.js is the de facto standard. |
| GPU renderer | @xterm/addon-webgl | @xterm/addon-canvas | Canvas addon is fallback-only. WebGL is 2-5x faster for large buffers and smooth scrolling. Canvas is only needed as a fallback if WebGL is unavailable (e.g., restricted GPU drivers). |

### Framework Layer

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Desktop framework | Electron | Tauri 2 | Tauri uses Rust backend (requires learning curve), WebView2 on Windows has different behavior from Chromium (rendering inconsistencies, missing APIs), native module support is more complex. The Rust FFI for ConPTY would need to be written from scratch. Electron's Node.js main process natively supports node-pty. |
| Desktop framework | Electron | NeutralinoJS | Immature ecosystem, smaller community, no proven terminal emulator built on it. |
| Desktop framework | Electron | Pure WebView2 + Win32 host | Loses the dev velocity advantage. Would need to write a C++/C# host application, manage WebView2 lifecycle, and handle IPC manually. The productivity advantage of TypeScript full-stack outweighs the bundle size cost for a personal Windows-only tool. |

## Installation

```bash
# Core dependencies
npm install @xterm/xterm @xterm/addon-fit @xterm/addon-webgl @xterm/addon-ligatures @xterm/addon-search @xterm/addon-image
npm install node-pty
npm install electron electron-store zod

# Dev dependencies
npm install -D @electron/rebuild electron-builder typescript @types/node
```

### Native Module Setup (CRITICAL)

node-pty is a native module. It **must** be rebuilt against Electron's Node.js ABI:

```bash
# Option 1: electron-rebuild (recommended)
npx @electron/rebuild

# Option 2: electron-builder
npx electron-builder install-app-deps

# Option 3: If native build fails on Windows, use prebuilt fork
npm install @homebridge/node-pty-prebuilt-multiarch
```

**Known issue:** node-pty has Electron compatibility problems with certain versions (Issue #728, Nov 2024). If Electron 41 + node-pty 1.1.0 fails to build:
1. Try the `@lydell/node-pty` fork (1.2.0-beta.12)
2. Ensure Node.js 20.x or 22.x (some users report success downgrading to 20.12.1)
3. Install Visual Studio Build Tools with "Desktop development with C++" workload

## ConPTY Deep Dive

### Architecture

```
[Electron Main Process (Node.js)]
        |
    node-pty.spawn()
        |
    CreatePseudoConsole()  ← kernel32.dll
        |
    [conhost.exe / OpenConsole.exe]  ← runs headless
        |
    [pwsh.exe / cmd.exe / wsl.exe]   ← user shell
```

### Capabilities

- **VT sequence translation:** ConPTY translates Windows Console API calls to VT escape sequences, making legacy Windows apps (cmd, PowerShell) work with modern terminal emulators
- **Pipe-based I/O:** Clean input/output via anonymous pipes — no screen scraping
- **Resize support:** `ResizePseudoConsole()` adjusts buffer dimensions
- **Process hierarchy:** Shell and child processes run inside conhost, not under the Electron process
- **WSL integration:** Native WSL process support through ConPTY

### Limitations (CRITICAL for Termy)

1. **No true session detach/reattach:** Unlike Unix PTY + tmux/screen, ConPTY does **NOT** support detaching a running session and reattaching later. When `ClosePseudoConsole()` is called (or when the caller process that called `CreatePseudoConsole()` terminates), it sends `CTRL_CLOSE_EVENT` to all child processes and they **will terminate**. There is no equivalent to `tmux detach` on Windows.

2. **Processes do NOT survive UI crash:** If the Electron process crashes or is killed, the ConPTY pipe is broken, conhost receives EOF, and child processes are terminated. **This is the single biggest architectural constraint for this project.** The "persistent session" value proposition must be achieved through state snapshot + restore, NOT through actual process survival.

3. **Resize event bugs:** ConPTY emits duplicate `WINDOW_BUFFER_SIZE_EVENT` messages when restoring from maximize. When downsizing, ConPTY emits nothing to clear the right side — making it impossible to know which visible lines should be truncated.

4. **ClosePseudoConsole hangs:** Known issue (GitHub #17688, #1810) where `ClosePseudoConsole()` sometimes hangs indefinitely, especially with certain shell configurations.

5. **conhost.exe orphaning:** Known issue (GitHub #4564) where conhost/OpenConsole.exe processes can linger after all connected clients have terminated.

6. **No raw mouse/touch events:** Unlike the legacy winpty approach, ConPTY cannot capture raw mouse/touch events from the console subsystem in the same way. Mouse events must be handled through VT mouse tracking protocols.

7. **CreatePseudoConsole path bugs:** Known issue (GitHub #16860) where long paths to conpty.dll can cause crashes.

### Implications for Termy Architecture

The "persistent session" feature **cannot** rely on ConPTY process survival. Instead, it must:
1. **Snapshot state** on app close: layout, working directories, command history, visible buffer content
2. **Recreate sessions** on app open: spawn new ConPTY instances, cd to saved directories, replay history
3. **Provide configurable restore strategies:** background-keep-alive (only works while app is running), layout-only, auto-reexecute, remain-on-exit

The ConPTY lifecycle independence claim in the PROJECT.md ("conhost lifecycle independent of terminal window, processes continue running in background") is **partially true but misleading**. While conhost runs as a separate process, closing the pipe **does** terminate child processes. The independence only means that the terminal UI can be briefly disconnected without killing processes (e.g., tab switching within the same app lifecycle), NOT that processes survive app restarts.

## What NOT to Use

### winpty (Dead)
- **Status:** Deprecated and removed from node-pty and VS Code
- **Why:** Screen-scraping architecture, incomplete VT support, causes terminal rendering bugs, no maintenance since 2019
- **Use instead:** ConPTY via node-pty (requires Windows 10 1809+)

### xterm.js DOM renderer (Too slow)
- **Status:** Still available but deprecated as default
- **Why:** Extremely slow for high-throughput output, causes frame drops, unacceptable input latency
- **Use instead:** `@xterm/addon-webgl` with canvas as fallback

### Tauri for this specific project
- **Status:** Viable for general desktop apps
- **Why not here:** Rust backend requires writing ConPTY FFI bindings from scratch, WebView2 on Windows has subtle differences from Chromium (font rendering, WebGL support), no proven terminal emulator built on Tauri with the feature set we need, the Rust learning curve outweighs benefits for a personal Windows-only tool
- **Use instead:** Electron (Node.js main process has native node-pty support out of the box)

### node-pty with asar packaging (Broken)
- **Status:** Known incompatibility
- **Why:** node-pty cannot load its native binary when packed inside Electron's asar archive (Issue #372)
- **Use instead:** Configure electron-builder to exclude node-pty from asar: `"asarUnpack": ["**/node_modules/node-pty/**"]`

### Electron with nodeIntegration enabled
- **Status:** Security vulnerability
- **Why:** Exposes full Node.js API to renderer process — any XSS becomes full system compromise
- **Use instead:** `contextIsolation: true`, `nodeIntegration: false`, preload script with explicit IPC channel definitions

### Old xterm.js scoped packages
- **Status:** Deprecated
- **Why:** The old `xterm` package (v5.3.0) and `xterm-addon-*` packages are deprecated. All development has moved to `@xterm/*` scoped packages.
- **Use instead:** `@xterm/xterm`, `@xterm/addon-*`

### node-pty child_process fallback
- **Status:** Not a real PTY
- **Why:** Using `child_process.spawn()` without PTY gives you a plain pipe — no terminal semantics, no VT sequences, no interactive shell support, no cursor positioning
- **Use instead:** Always use node-pty for terminal emulation

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| xterm.js stack | HIGH | Verified via official GitHub releases and npm registry. Version 6.0.0 confirmed. |
| node-pty | HIGH | Official Microsoft-maintained package, version 1.1.0 confirmed via npm and GitHub. |
| ConPTY limitations | HIGH | Verified via Microsoft Learn documentation, Console-Docs GitHub repo, and multiple confirmed GitHub issues in microsoft/terminal. |
| ConPTY detach/reattach impossibility | HIGH | No API exists for this. Confirmed by absence in Microsoft documentation and by architectural design (pipe-based, no session persistence). |
| Electron IPC patterns | MEDIUM | Based on community best practices, xterm.js issue discussions, and general Electron IPC optimization guidance. Specific terminal-optimized patterns need validation during implementation. |
| State persistence JSON schema | MEDIUM | Pattern derived from tmux-resurrect (TSV format) and Kitty (JSON remote control protocol). Formal JSON schema needs to be designed for this project's specific requirements. |
| Electron 41 + node-pty 1.1.0 compatibility | MEDIUM-LOW | Known historical compatibility issues (Issue #728). Need to verify at build time. Fallback to @lydell/node-pty fork if needed. |
| @xterm/addon-image Sixel | LOW | Known rendering bug in 6.0 (Issue #5644). Status uncertain — may be fixed in patch releases. |

## Sources

- xterm.js releases: https://github.com/xtermjs/xterm.js/releases
- xterm.js npm (@xterm/xterm): https://www.npmjs.com/package/@xterm/xterm
- node-pty GitHub: https://github.com/microsoft/node-pty
- node-pty npm: https://www.npmjs.com/package/node-pty
- VS Code winpty removal: https://github.com/microsoft/vscode/issues/284519
- Microsoft ConPTY docs: https://learn.microsoft.com/en-us/windows/console/creating-a-pseudoconsole-session
- Console-Docs: https://github.com/Microsoft/Console-Docs
- ConPTY host lingers: https://github.com/microsoft/terminal/issues/4564
- ClosePseudoConsole hangs: https://github.com/microsoft/terminal/issues/17688
- xterm.js parser worker isolation: https://github.com/xtermjs/xterm.js/issues/3368
- xterm.js Sixel rendering bug: https://github.com/xtermjs/xterm.js/issues/5644
- node-pty Electron compatibility: https://github.com/microsoft/node-pty/issues/728
- node-pty asar incompatibility: https://github.com/microsoft/node-pty/issues/372
- Electron native modules: https://electronjs.org/docs/latest/tutorial/using-native-node-modules
- Electron IPC: https://electronjs.org/docs/latest/tutorial/ipc
- electron-builder: https://www.electron.build
- @electron/rebuild: https://github.com/electron/rebuild
- tmux-resurrect: https://github.com/tmux-plugins/tmux-resurrect
- Kitty sessions: https://sw.kovidgoyal.net/kitty/sessions/
- Windows Terminal state.json: https://superuser.com/questions/1801278/what-does-windows-terminals-state-json-file-do
