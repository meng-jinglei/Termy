# Domain Pitfalls: Windows Terminal Emulator with Electron + xterm.js + tmux-like Sessions

**Domain:** Windows terminal emulator with persistent session management
**Researched:** 2026-04-15

## Critical Pitfalls

Mistakes that cause rewrites, crashes, or fundamentally broken user experience.

---

### Pitfall 1: ConPTY ClosePseudoConsole Hangs on Windows 11 24H2 and Earlier

**What goes wrong:** The `ClosePseudoConsole` Windows API can hang indefinitely when closing a PTY session. This is a known Windows OS-level bug, not a node-pty bug. On Windows 11 24H2 (build 26100+), Microsoft removed the blocking wait from this API, but on all earlier versions (Windows 10 1809 through Windows 11 23H2), the call blocks until the conhost process finishes draining its output buffers. If the child process is stuck in an uninterruptible I/O operation, `ClosePseudoConsole` hangs forever, and your Electron app's main process freezes on shutdown.

**Why it happens:** ConPTY's `ClosePseudoConsole` implementation waits for the conhost server process to fully drain before returning. If the child process has pending I/O or is in a blocked state, this wait never completes.

**Consequences:**
- App shutdown hangs (user force-kills via Task Manager)
- Main process blocked in native code, cannot respond to UI
- State save may never complete if triggered during shutdown
- Orphaned conhost.exe and child processes left behind

**Prevention:**
- Use a separate Node.js worker thread or child_process for each PTY lifecycle, so a hung `ClosePseudoConsole` does not block the Electron main process
- Implement a shutdown timeout: after N seconds of waiting for PTY cleanup, skip graceful close and proceed with state save + forceful process tree kill
- On Windows 26100+ (24H2+), this is less of a concern -- detect OS version and adjust strategy
- Always drop stdin pipe first before calling `ClosePseudoConsole` (node-pty issue #471, Microsoft terminal #15006)
- Use `taskkill /T /PID` as a fallback to kill the entire process tree

**Detection:**
- Monitor shutdown duration -- if app takes >5s to close, likely a ConPTY hang
- Log PTY close timestamps to identify which sessions cause hangs
- Warning sign: Task Manager shows multiple orphaned conhost.exe processes

**Phase to address:** Phase 2 (PTY Backend + ConPTY Integration) -- this must be solved before building session persistence, as it affects the entire lifecycle.

**Sources:**
- [microsoft/terminal #17688](https://github.com/microsoft/terminal/issues/17688) - "ConPty sometimes hangs when calling ClosePseudoConsole" (Aug 2024)
- [microsoft/node-pty #471](https://github.com/microsoft/node-pty/issues/471) - "conPty does not release stdin/terminal"
- [microsoft/terminal #15006](https://github.com/microsoft/terminal/discussions/15006) - proper ConPTY close sequence

---

### Pitfall 2: Orphaned PTY Processes After App Crash or Force Close

**What goes wrong:** When the Electron app crashes or is force-killed (Task Manager, power loss), the PTY processes (conhost.exe + child shell + all descendants) continue running in the background. Unlike Linux where the PTY master closing kills the slave, Windows ConPTY processes survive the terminal's death. On next launch, stale processes accumulate, consuming RAM and potentially causing port conflicts or file locks.

**Why it happens:** Windows does not automatically terminate the process tree when the ConPTY client disconnects. The conhost server process and all children persist independently.

**Consequences:**
- Memory leak across sessions (accumulating orphaned processes)
- "Stale session" detection becomes unreliable -- a process may be running but the user's working state is lost
- Session restore may try to attach to a PTY that no longer has a valid handle
- File locks from orphaned processes prevent user operations

**Prevention:**
- Implement a process registry on startup: enumerate all conhost.exe and known child processes, check if their parent PTY handles are still valid, and offer to clean up orphans
- Use Windows Job Objects to group PTY process trees -- when the Electron process dies, the OS automatically terminates all processes in the job
- On app startup, scan for and offer to clean up processes with no valid PTY parent (stale session detection)
- Store PTY PIDs in session state file for cross-launch orphan detection

**Detection:**
- On startup, check if session file PIDs match running processes
- Use `tasklist` or Windows API to detect processes with no valid console attachment
- Warning sign: increasing number of conhost.exe processes in Task Manager over time

**Phase to address:** Phase 3 (Session Persistence + State Management) -- orphan detection is part of the session restore flow.

**Sources:**
- [microsoft/node-pty #437](https://github.com/microsoft/node-pty/issues/437) - "Unable to kill pty process on Windows"
- [microsoft/node-pty #499](https://github.com/microsoft/node-pty/issues/499) - "VS Code leaks open file descriptors to subprocesses in terminal"
- [sst/opencode #5525](https://github.com/sst/opencode/issues/5525) - "git bash.exe processes on Windows get orphaned"

---

### Pitfall 3: Session State Corruption on Concurrent Save + Crash

**What goes wrong:** When saving session state (layout, working directory, process info) to a JSON file during app shutdown, if the app crashes mid-write, the state file becomes partially written / corrupted JSON. On next launch, the app cannot parse the state file and either crashes itself or silently loses all session data.

**Why it happens:** `fs.writeFile` (or equivalent) is not atomic. A crash during write leaves a partial file. Unlike tmux which uses a socket-based server that persists independently, this is a single Electron app where the UI and state storage share the same process.

**Consequences:**
- Complete loss of all session data on crash
- App may crash on startup trying to parse corrupt JSON
- User loses trust in the "persistent session" promise

**Prevention:**
- Use atomic file writes: write to a temp file first, then `fs.rename` (atomic on NTFS) to the target path
- Implement a state file versioning scheme with a backup of the last known-good state
- Write a checksum/hash alongside the JSON; verify on read
- Use a small SQLite database instead of JSON for more robust concurrent access
- Save state incrementally (on each tab/pane change) rather than only at shutdown, reducing the amount of data at risk

**Detection:**
- On startup, always validate state file with JSON parse + checksum check
- If corrupt, fall back to the backup state file
- Log state save operations with timestamps for debugging

**Phase to address:** Phase 3 (Session Persistence + State Management)

**Sources:**
- [tmux-plugins/tmux-resurrect #395](https://github.com/tmux-plugins/tmux-resurrect/issues/395) - process restoration failures
- [tmux-plugins/tmux-resurrect #276](https://github.com/tmux-plugins/tmux-resurrect/issues/276) - zombie processes after restore

---

### Pitfall 4: node-pty Native Module Rebuild Failures on Electron Upgrade

**What goes wrong:** node-pty is a native Node.js module (C++ bindings to ConPTY). Every time Electron is upgraded, node-pty must be rebuilt against Electron's Node.js ABI version. Build failures are common on Windows due to missing Visual Studio Build Tools, Python version mismatches, node-gyp incompatibilities, or path issues with spaces in the installation path. This blocks development and breaks the app after Electron upgrades.

**Why it happens:** Electron bundles its own Node.js version with a different ABI than the system Node.js. Native modules compiled for system Node.js do not work in Electron and must be recompiled.

**Consequences:**
- Development blocked until native module builds successfully
- CI/CD pipeline failures on Windows runners (missing C++ build tools)
- App fails to launch with "Cannot find module '../build/Release/pty.node'"
- Cross-platform builds (building Windows binary on macOS/Linux) fail because native modules must be compiled on the target platform

**Prevention:**
- Pin specific Electron + node-pty version pairs that are known to work together (check VS Code's versions as reference)
- Use `@electron/rebuild` (not the deprecated `electron-rebuild`) with explicit version targeting
- Configure `electron-builder` with `"electronRebuild": true` for automatic rebuild during packaging
- Document exact prerequisites: Visual Studio Build Tools with "Desktop development with C++", Python 3.x, node-gyp
- Mark node-pty as external in bundler config (webpack/vite) to avoid bundling issues
- Test native module rebuild as part of every Electron version upgrade

**Detection:**
- Warning: node-pty issues #649, #728, #735, #744 are all installation/build failures on Windows
- If the error mentions `pty.node` or `conpty.node`, it is a native module rebuild issue
- `electron-builder` log will show node-gyp errors if rebuild fails

**Phase to address:** Phase 1 (Project Setup + Terminal Rendering) -- this must work before anything else.

**Sources:**
- [microsoft/node-pty #728](https://github.com/microsoft/node-pty/issues/728) - "node-pty does not work with latest versions of electron" (Nov 2024)
- [microsoft/node-pty #649](https://github.com/microsoft/node-pty/issues/649) - "Node-PTY does not install on Win11Pro, for a Electron project"
- [microsoft/node-pty #234](https://github.com/microsoft/node-pty/issues/234) - "Cannot find module '../build/Release/pty.node'"
- [electron-builder #8020](https://github.com/electron-userland/electron-builder/issues/8020) - "Build Windows Nsis node-pty on Mac" (Jan 2024)
- [nodejs/node-gyp #3091](https://github.com/nodejs/node-gyp/issues/3091) - "node-pty build error on Windows" (Nov 2024)

---

### Pitfall 5: xterm.js Scrollback Memory Growth Without Bounds

**What goes wrong:** Each xterm.js Terminal instance holds its entire scrollback buffer in JavaScript memory indefinitely. With multiple panes and long-running sessions (hours of terminal output), memory consumption grows linearly with output volume. A single pane running `npm install` or `cat` on a large file can consume hundreds of megabytes. With 4-8 panes, Electron's renderer process can easily exceed 1-2 GB, causing GC pressure, UI stutter, and eventually OOM crashes.

**Why it happens:** xterm.js stores every line of terminal output in a circular buffer in memory. Unlike native terminal emulators that can page scrollback to disk, xterm.js has no built-in disk-backed scrollback.

**Consequences:**
- Memory grows without bound over session lifetime
- UI becomes sluggish as GC fights with scrollback buffer
- Renderer process crashes with OOM on long sessions
- Session persistence must serialize massive buffers for save/restore

**Prevention:**
- Set a reasonable `scrollback` limit (e.g., 5000-10000 lines) per pane, not unlimited
- Implement optional disk-backed scrollback persistence: periodically flush scrollback chunks to disk, load on demand during scroll
- Use xterm.js `@xterm/addon-search` carefully -- searching large buffers is extremely slow (VS Code issue #147685)
- For session persistence, do NOT serialize full scrollback by default; make it an opt-in feature with size warnings
- Consider using `@xterm/addon-webgl` renderer which has lower memory overhead than DOM/canvas renderers for large buffers
- Monitor renderer memory with `process.memoryUsage()` and warn the user when approaching limits

**Detection:**
- Chrome DevTools Memory panel shows growing ArrayBuffer/TypedArray usage in renderer
- Warning sign: UI lag increases proportionally to terminal output volume
- VS Code issue #219555: terminal resize freezes with ~19000 lines of scrollback

**Phase to address:** Phase 2 (PTY Backend + ConPTY Integration) for scrollback limits; Phase 3 for disk-backed persistence.

**Sources:**
- [xtermjs/xterm.js #791](https://github.com/xtermjs/xterm.js/issues/791) - "Buffer performance improvements"
- [xtermjs/xterm.js #4902](https://github.com/xtermjs/xterm.js/issues/4902) - "Search is very slow when there is a lot of content and many wrapped lines"
- [microsoft/vscode #147685](https://github.com/microsoft/vscode/issues/147685) - "Searching in terminal with large scrollback is slow"
- [microsoft/vscode #219559](https://github.com/microsoft/vscode/issues/219559) - "Terminal resize freezes computer"
- [microsoft/vscode #276958](https://github.com/microsoft/vscode/issues/276958) - "Promise memory leak when creating terminal (pty-host)" (Nov 2025)

---

### Pitfall 6: Terminal Resize Race Conditions (xterm.js + node-pty + ConPTY Triple Mismatch)

**What goes wrong:** When the user resizes the Electron window, three separate systems must synchronize: (1) xterm.js recalculates rows/columns, (2) node-pty sends the new dimensions to ConPTY, and (3) ConPTY conhost reflows its text buffer. These three operations are asynchronous and have different latencies. During the resize window, data arriving from the PTY may be rendered at the wrong dimensions, causing text corruption, lost characters, or misplaced cursor positions. Rapid resize (dragging window edge) amplifies this into visible flickering and text duplication.

**Why it happens:** The resize control flow is a full roundtrip: `terminal.resize()` -> SIGWINCH to shell -> shell adjusts output -> data flows back -> xterm.js renders. Each step adds latency, and data arriving mid-resize is rendered at stale dimensions.

**Consequences:**
- Visible text corruption during and after resize
- Duplicated output lines (user sees `clear` as a common workaround)
- WebGL renderer shows blank/jittery frames during resize (GPU texture cleared)
- Canvas flicker when xterm.js is inside a responsive layout that shifts

**Prevention:**
- Debounce resize events (100-200ms) to avoid excessive resize calls during drag
- Use `requestAnimationFrame` for smooth resize updates
- Implement a resize guard: temporarily pause rendering during resize, then flush
- Use the FitAddon with correct container size calculation (avoid the known FitAddon dimension bugs: issues #4841, #3584)
- After resize completes, send a `clear` or redraw signal if the shell supports it (less invasive: rely on the shell's own SIGWINCH handling)
- Track the resize roundtrip state and buffer incoming PTY data until dimensions stabilize

**Detection:**
- Visible text duplication or corruption after resize
- WebGL canvas showing blank frames during resize
- Warning sign: users report "terminal looks broken after I resize the window"

**Phase to address:** Phase 2 (PTY Backend + ConPTY Integration) -- resize handling is fundamental to the terminal experience.

**Sources:**
- [xtermjs/xterm.js #1914](https://github.com/xtermjs/xterm.js/issues/1914) - "Terminal resize roundtrip"
- [xtermjs/xterm.js #4922](https://github.com/xtermjs/xterm.js/issues/4922) - "Canvas flickers when canvas position is moving"
- [xtermjs/xterm.js #5691](https://github.com/xtermjs/xterm.js/issues/5691) - "Images jitter when resizing the demo window" (Feb 2026)
- [xtermjs/xterm.js #4841](https://github.com/xtermjs/xterm.js/issues/4841) - "FitAddon resizes incorrectly"
- [xtermjs/xterm.js #1701](https://github.com/xtermjs/xterm.js/issues/1701) - "Resize from the left causes flickering and characters misplaced"
- [microsoft/vscode #58975](https://github.com/microsoft/vscode/issues/58975) - "Terminal resize slow with high CPU usage"
- [google-gemini/gemini-cli #6410](https://github.com/google-gemini/gemini-cli/issues/6410) - "The CLI flickers badly after terminal resize in VSC" (Aug 2025)
- [microsoft/vscode #303137](https://github.com/microsoft/vscode/issues/303137) - "Terminal performance degradation" (Mar 2026)

---

## Moderate Pitfalls

### Pitfall 7: CJK IME Input Broken or Mispositioned in Electron + xterm.js

**What goes wrong:** Chinese, Japanese, and Korean IME (Input Method Editor) composition windows appear at incorrect positions or characters fail to commit properly. This is a chronic issue in xterm.js + Electron, especially with Sogou Pinyin, Microsoft Pinyin, and Korean IMEs. The composition candidate window may appear at the far right of the screen, detached from the cursor, or characters may remain in pending state and never commit.

**Why it happens:** xterm.js uses a custom input handling layer that intercepts keyboard events. IME composition events (`compositionstart`, `compositionupdate`, `compositionend`) must be properly forwarded and the composition window positioned relative to the cursor, which requires careful coordination between Electron's Chromium IME support and xterm.js's rendering coordinates.

**Consequences:**
- CJK users cannot type properly -- a dealbreaker for a significant user population
- Characters silently dropped or committed to wrong position
- IME candidate window invisible or detached from editing position

**Prevention:**
- Use xterm.js's built-in IME support (`term.textarea` element for IME input) -- ensure it is not obscured or positioned off-screen
- Test with Microsoft Pinyin, Sogou Pinyin, and Korean IME on Windows 11
- Follow VS Code's IME fixes as reference (VS Code issue #301552, #24557)
- Pin to a xterm.js version where IME issues are resolved (check issue #4486 for current status)
- Position the IME textarea element at the cursor coordinates, update on every cursor move

**Detection:**
- Test with CJK IME input as part of the QA process
- Warning sign: IME composition window appears at wrong location or characters don't appear

**Phase to address:** Phase 2 (PTY Backend + ConPTY Integration) -- input handling is part of the core terminal.

**Sources:**
- [xtermjs/xterm.js #4486](https://github.com/xtermjs/xterm.js/issues/4486) - "Various problems with Chinese IMEs" (Dec 2024)
- [xtermjs/xterm.js #5734](https://github.com/xtermjs/xterm.js/issues/5734) - "IME composition window positioned incorrectly"
- [xtermjs/xterm.js #5454](https://github.com/xtermjs/xterm.js/issues/5454) - "Chinese IME shows input far from cursor" (Dec 2025)
- [xtermjs/xterm.js #3679](https://github.com/xtermjs/xterm.js/issues/3679) - "CJK IME input broken on Windows in Electron 13"
- [microsoft/vscode #301552](https://github.com/microsoft/vscode/issues/301552) - "Improved terminal IME composition experience" (Mar 2026)

---

### Pitfall 8: Unicode Rendering Discrepancies Between ConPTY and xterm.js

**What goes wrong:** ConPTY translates text to UTF-16 and processes it through conhost before sending to the PTY client. Some ANSI sequences are modified or stripped by conhost. Double-width characters (CJK, emoji) may be reported with different column widths by ConPTY vs what xterm.js expects. This causes cursor misalignment, text overlap, or missing characters.

**Why it happens:** ConPTY sits between the application and the terminal, processing and translating text. Some ANSI sequences are not passed through as-is (Microsoft terminal issue #10072). Double-width character handling was buggy until recent Windows Terminal fixes (issue #17809). Unicode Private Use Area characters caused crashes in the AtlasEngine (issue #17201).

**Consequences:**
- CJK characters display with wrong width, causing subsequent text to misalign
- Emoji render as boxes or wrong characters
- Some ANSI escape sequences silently dropped, breaking TUI applications
- Cursor position drift accumulates over time, making the display increasingly wrong

**Prevention:**
- Use WebGL renderer for better Unicode rendering (fewer font fallback issues)
- Set xterm.js `allowProposedApi: true` for newer terminal capabilities
- Test with double-width characters, emoji, and CJK text regularly
- Monitor xterm.js and Windows Terminal release notes for Unicode fixes
- Consider the in-band terminal resize sequence (2048 h) for better resize + Unicode interaction

**Detection:**
- Visible character misalignment in terminal display
- Warning sign: TUI applications (htop, nvim) show garbled layout after Unicode text output

**Phase to address:** Phase 2 (PTY Backend + ConPTY Integration)

**Sources:**
- [microsoft/terminal #10072](https://github.com/microsoft/terminal/issues/10072) - "Some ANSI sequences not output as-is"
- [microsoft/terminal #17809](https://github.com/microsoft/terminal/discussions/17809) - "ConPTY Cursor Movement on Double-Width Lines" (fixed v1.22.2362.0)
- [microsoft/terminal #17201](https://github.com/microsoft/terminal/discussions/17201) - "AtlasEngine Unicode PUA Crash"
- [microsoft/terminal #17738](https://github.com/microsoft/terminal/issues/17738) - "Input Sequences Split Across Buffer Boundary" (fixed v1.22.2362.0)
- [microsoft/terminal #3088](https://github.com/microsoft/terminal/issues/3088) - "WSL Terminal Line Endings (the exact wrap bug)"

---

### Pitfall 9: node-pty Exit Code/Signal Undefined on Windows

**What goes wrong:** On Windows, the `pty.onExit` callback may fire with `exitCode` and `signal` both `undefined`. This makes it impossible to distinguish between a clean process exit, a crash, or a PTY closure. For session persistence, this means you cannot reliably detect whether a process ended normally or was killed, which affects restoration decisions.

**Why it happens:** Windows does not have Unix-style signals. The exit event handling in node-pty's Windows implementation has edge cases where the exit information is lost, particularly during abnormal termination paths.

**Consequences:**
- Cannot determine if a process exited cleanly vs crashed
- Session restore may try to restart a process that intentionally exited
- "remain-on-exit" mode behavior becomes unreliable
- Zombie process detection becomes harder without reliable exit information

**Prevention:**
- Implement a heartbeat/watchdog mechanism: periodically check if the process PID is still alive via Windows API
- Do not rely solely on `onExit`; also monitor the PTY read stream for EOF
- For session persistence, store process state snapshots periodically, not just at exit
- Use Windows Job Object notifications for process termination events as a secondary signal

**Detection:**
- Log all `onExit` events with their exitCode/signal values
- Warning sign: processes appear "running" in session state but are actually dead

**Phase to address:** Phase 3 (Session Persistence + State Management)

**Sources:**
- [microsoft/node-pty #753](https://github.com/microsoft/node-pty/discussions/753) - "Exit Code and Signal can be undefined" (Jan 2025)
- [microsoft/node-pty #671](https://github.com/microsoft/node-pty/issues/671) - "Assertion in conpty.cc Line 110 when exiting VS Code" (Mar 2024)

---

### Pitfall 10: xterm.js @xterm/addon-image (Sixel) Is Beta-Quality and Third-Party Maintained

**What goes wrong:** If you plan to support inline images (Sixel, IIP) in the terminal, the `@xterm/addon-image` package is explicitly marked as "beta quality" for Sixel and "alpha stage" for IIP. It is maintained by a third party (jerch), not the core xterm.js team. Known issues include: Sixel images parsed but not rendered in xterm.js 6.0 (#5644), serialization not supported (#47), and compatibility breaks with xterm.js version upgrades (#38).

**Why it happens:** Sixel is a niche terminal graphics protocol with limited adoption. The addon has a small maintainer base and lags behind xterm.js core development.

**Consequences:**
- Image display may break on xterm.js version upgrades
- Sixel images not saved during session serialization (breaks scrollback persistence)
- Memory pressure from large inline images in scrollback
- Full-width sixel not supported (unlike native terminals)

**Prevention:**
- If inline images are not core to your product, disable the addon entirely
- If needed, pin specific xterm.js + addon-image version pairs and test upgrades carefully
- Set `pixelLimit` and `sixelPaletteLimit` to prevent memory exhaustion from large images
- Do not rely on Sixel images surviving session save/restore

**Detection:**
- Monitor xterm.js release notes for addon-image compatibility
- Test Sixel rendering after every xterm.js upgrade

**Phase to address:** Phase 2 (PTY Backend + ConPTY Integration) -- decide early whether to include image support.

**Sources:**
- [xtermjs/xterm.js #5644](https://github.com/xtermjs/xterm.js/issues/5644) - "Sixel images parsed but not rendered with xterm.js 6.0" (Jan 2026)
- [jerch/xterm-addon-image #38](https://github.com/jerch/xterm-addon-image/issues/38) - "xterm.js 5.1 compat"
- [jerch/xterm-addon-image #47](https://github.com/jerch/xterm-addon-image/issues/47) - "images aren't serialized"
- [npm @xterm/addon-image](https://www.npmjs.com/package/@xterm/addon-image) - quality status documentation

---

### Pitfall 11: IPC Performance Bottleneck Between Electron Main and Renderer for PTY Data

**What goes wrong:** PTY output data flows from the native node-pty process (main process) to the xterm.js renderer (renderer process) through Electron's IPC mechanism. High-throughput terminal output (e.g., `cat` on a large file, `npm install`, compilation output) can saturate the IPC channel, causing rendering lag, dropped characters, or backpressure that slows down the PTY itself.

**Why it happens:** Electron's IPC serializes and copies data between processes. PTY output can be megabytes per second. Each IPC message adds serialization/deserialization overhead.

**Consequences:**
- Terminal rendering lags behind actual output (user sees text appearing slowly)
- Backpressure causes the PTY to block, slowing down the running process
- Memory accumulates in IPC buffers during high-throughput periods
- Renderer process may become unresponsive during massive output bursts

**Prevention:**
- Batch PTY output into larger IPC messages rather than sending every data chunk individually
- Implement backpressure handling: if the renderer is falling behind, buffer in main process and apply rate limiting
- Consider xterm.js's parser worker isolation pattern (issue #3368): offload parsing to a Web Worker in the renderer to reduce main thread blocking
- Use `@xterm/addon-webgl` for faster rendering that can keep up with higher throughput
- Monitor IPC message queue depth and log when it exceeds thresholds

**Detection:**
- Visible delay between process output and terminal display
- Renderer process CPU spikes during high-throughput output
- Warning sign: terminal "catches up" in bursts after a period of heavy output

**Phase to address:** Phase 2 (PTY Backend + ConPTY Integration)

**Sources:**
- [xtermjs/xterm.js #3368](https://github.com/xtermjs/xterm.js/issues/3368) - "parser worker isolation considerations"
- [microsoft/vscode #202219](https://github.com/microsoft/vscode/issues/202219) - "Pty host is unresponsive after opening and closing terminal"
- [microsoft/vscode #204017](https://github.com/microsoft/vscode/issues/204017) - "connection to the terminal's pty host process is unresponsive"

---

### Pitfall 12: tmux-Resurrect-Style Process Restoration Cannot Actually Restore Process State

**What goes wrong:** A common misconception is that session persistence can "restore" running processes to their exact state (like hibernation). In reality, tmux-resurrect only saves the process command line and working directory, then re-executes the command on restore. Interactive programs (vim, htop, REPL sessions) lose their in-memory state entirely. Complex commands with pipes, redirects, or shell functions may not restore correctly.

**Why it happens:** Windows has no equivalent to Linux's CRIU (Checkpoint/Restore In Userspace). There is no way to serialize a running process's memory, file descriptors, and PTY state and restore it later.

**Consequences:**
- User expectation mismatch: "persistent session" does not mean "persistent process state"
- Interactive sessions (editors, REPLs) lose unsaved work
- Complex shell pipelines restore as separate, broken commands
- Zombie processes from failed restoration (tmux-resurrect issue #276)

**Prevention:**
- Clearly communicate in UI that only layout, working directory, and command line are restored -- not process memory state
- Implement per-pane restore strategies as planned (background keep-alive / layout only / re-execute / remain-on-exit)
- For interactive programs, implement heuristic detection: if the process is vim/nvim/emacs, warn the user before restoring
- Use `exec` in restore scripts to prevent zombie wrapper processes
- Save and restore environment variables alongside process commands

**Detection:**
- Monitor restore success rate: count how many processes successfully restart vs fail
- Log which process types fail to restore correctly
- Warning sign: increasing number of "zombie" or defunct processes after restore

**Phase to address:** Phase 3 (Session Persistence + State Management) -- this is the core design decision for the persistence feature.

**Sources:**
- [tmux-plugins/tmux-resurrect #276](https://github.com/tmux-plugins/tmux-resurrect/issues/276) - zombie processes after restore
- [tmux-plugins/tmux-resurrect #395](https://github.com/tmux-plugins/tmux-resurrect/issues/395) - processes not restoring

---

## Minor Pitfalls

### Pitfall 13: ConPTY Only Available on Windows 10 1809+ (Build 17763+)

**What goes wrong:** `CreatePseudoConsole()` API does not exist on Windows versions prior to 1809 (October 2018 Update). If the app runs on an older Windows version, it will crash on startup when node-pty tries to load the ConPTY API.

**Prevention:**
- Set minimum OS requirement to Windows 10 1809 (build 17763) in the app manifest
- At startup, check OS version and show a friendly error message if unsupported
- Since the project targets Windows 11 primarily, this is low risk but must be handled gracefully

**Phase to address:** Phase 1 (Project Setup + Terminal Rendering)

**Sources:**
- [Microsoft Console Docs - CreatePseudoConsole](https://github.com/Microsoft/Console-Docs/blob/main/docs/createpseudoconsole.md)
- [Microsoft Learn - CreatePseudoConsole function](https://learn.microsoft.com/en-us/windows/console/createpseudoconsole)

---

### Pitfall 14: Font Rendering Quality Differences Between xterm.js and Native Windows Console

**What goes wrong:** xterm.js renders text using Canvas/WebGL in a browser context, which uses different font rendering (DirectWrite via Chromium) than the native Windows console (GDI/DirectWrite via conhost). Font smoothing, ligatures, and character spacing may differ, making the terminal feel "off" compared to native Windows Terminal.

**Prevention:**
- Use `fontLigatures: true` and a font that supports ligatures (JetBrains Mono, Fira Code)
- Match Windows Terminal's font rendering settings: `letterSpacing`, `lineHeight`, `fontSize`
- Test font rendering at common sizes (12px, 14px, 16px) and compare with Windows Terminal
- Use WebGL renderer for crisper text rendering

**Phase to address:** Phase 1 (Project Setup + Terminal Rendering)

---

### Pitfall 15: Clipboard Handling Edge Cases (Rich Text, Large Selections, CRLF)

**What goes wrong:** Copy/paste in xterm.js has several edge cases: (1) copying large selections (>100KB) can freeze the renderer, (2) CRLF line endings may be converted incorrectly on paste, (3) bracketed paste mode must be correctly enabled/disabled for shell interaction, (4) rich text or HTML from clipboard may be pasted as raw escape sequences.

**Prevention:**
- Use xterm.js's built-in clipboard handling with `allowProposedApi: true`
- Implement a copy size limit with a warning dialog for large selections
- Ensure bracketed paste mode is correctly toggled based on terminal mode
- Test paste with CRLF, LF, and CR-only line endings
- Strip rich text/HTML from clipboard, paste as plain text only

**Phase to address:** Phase 2 (PTY Backend + ConPTY Integration)

---

### Pitfall 16: node-pty "Cannot resize a pty that has already exited" Crash on Windows

**What goes wrong:** A known bug in node-pty where calling `resize()` on a PTY that has already exited throws an uncaught error, crashing the Electron renderer or main process. This can happen during rapid window resize if a process exits between the resize event and the resize call.

**Why it happens:** Node.js v22+ on Windows has a regression where the PTY resize path does not check if the PTY is still valid before attempting to resize the console buffer.

**Prevention:**
- Wrap all `pty.resize()` calls in try/catch
- Check PTY alive state before calling resize
- Implement a resize queue that cancels pending resizes if the PTY exits
- Pin to a node-pty version where this is fixed or use the workaround from the Gemini CLI hotfix

**Detection:**
- Crash logs showing "Cannot resize a pty that has already exited"
- Correlated with window resize events

**Phase to address:** Phase 2 (PTY Backend + ConPTY Integration)

**Sources:**
- [microsoft/node-pty #854](https://github.com/microsoft/node-pty/issues/854) - "Cannot resize a pty that has already exited" (Dec 2025)
- [reddit r/GeminiAI](https://www.reddit.com/r/GeminiAI/comments/1q0y3ig/) - "HOTFIX Gemini CLI: Cannot resize a pty that has already exited"

---

### Pitfall 17: ConPTY ANSI Sequence Filtering Breaks Some TUI Applications

**What goes wrong:** ConPTY does not pass all ANSI escape sequences through unchanged. Some sequences are modified or stripped by conhost to support legacy console applications. This can break TUI applications that rely on specific escape sequences for color, cursor positioning, or terminal capabilities detection.

**Prevention:**
- Test with common TUI applications (htop alternatives, vim, nvim, lazygit, btop)
- Monitor Windows Terminal and conhost release notes for ANSI sequence passthrough improvements
- Use Windows Terminal's in-process ConPTY spec (#13000) as a reference for expected behavior
- If a specific TUI app breaks, check whether the issue is in ConPTY filtering or xterm.js interpretation

**Phase to address:** Phase 2 (PTY Backend + ConPTY Integration)

**Sources:**
- [microsoft/terminal #10072](https://github.com/microsoft/terminal/issues/10072) - "Some ANSI sequences not output as-is"
- [microsoft/terminal #13000](https://github.com/microsoft/terminal/blob/main/doc/specs/%2313000%20-%20In-process%20ConPTY.md) - In-process ConPTY spec

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Project Setup + Electron | node-pty native rebuild failures (Pitfall 4) | Pin versions, document prerequisites, test rebuild on every Electron upgrade |
| xterm.js Terminal Rendering | Scrollback memory growth (Pitfall 5), font rendering (Pitfall 14) | Set scrollback limits, test font quality, use WebGL renderer |
| ConPTY Integration | ClosePseudoConsole hangs (Pitfall 1), resize races (Pitfall 6), ANSI filtering (Pitfall 17), IPC bottleneck (Pitfall 11) | Worker-thread PTY lifecycle, debounce resize, batch IPC, test TUI apps |
| Session Persistence | State corruption (Pitfall 3), orphaned processes (Pitfall 2), process state misconception (Pitfall 12), undefined exit codes (Pitfall 9) | Atomic writes, Job Objects, clear UX about restore limits, heartbeat monitoring |
| UX Polish | IME input (Pitfall 7), clipboard edge cases (Pitfall 15), resize crash (Pitfall 16) | Test CJK input, implement copy limits, wrap resize calls |
| Image/TUI Support | Sixel addon instability (Pitfall 10), Unicode rendering (Pitfall 8) | Pin versions or disable, test Unicode regularly |
