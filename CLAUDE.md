<!-- GSD:project-start source:PROJECT.md -->
## Project

**Termy**

Windows 上的终端模拟器，支持类似 tmux 的持久化会话管理。关掉应用再打开，所有 tab、pane、运行中的进程和终端缓冲区内容自动恢复。基于 Electron + xterm.js，用户可通过图形界面和键盘快捷键管理分屏、标签页和会话。核心差异点：用户可自主选择每个 pane 的进程恢复策略（后台保持运行 / 仅恢复布局 / 自动重新执行 / remain-on-exit 模式）。

**Core Value:** 在 Windows 上提供 tmux 级别的持久化会话体验——关掉终端，一切原地恢复，无需额外工具。

### Constraints

- **Tech stack:** Electron + xterm.js + node-pty — 已选定
- **Platform:** Windows only — 使用 ConPTY API，不做跨平台
- **Architecture:** 单个 Electron 应用，不依赖外部服务或守护进程
- **Complexity:** 个人项目，避免过度工程化
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

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
# Core dependencies
# Dev dependencies
### Native Module Setup (CRITICAL)
# Option 1: electron-rebuild (recommended)
# Option 2: electron-builder
# Option 3: If native build fails on Windows, use prebuilt fork
## ConPTY Deep Dive
### Architecture
### Capabilities
- **VT sequence translation:** ConPTY translates Windows Console API calls to VT escape sequences, making legacy Windows apps (cmd, PowerShell) work with modern terminal emulators
- **Pipe-based I/O:** Clean input/output via anonymous pipes — no screen scraping
- **Resize support:** `ResizePseudoConsole()` adjusts buffer dimensions
- **Process hierarchy:** Shell and child processes run inside conhost, not under the Electron process
- **WSL integration:** Native WSL process support through ConPTY
### Limitations (CRITICAL for Termy)
### Implications for Termy Architecture
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
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
