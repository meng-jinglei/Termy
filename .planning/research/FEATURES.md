# Feature Landscape: Termy

**Domain:** Windows terminal emulator with tmux-like persistent session management
**Researched:** 2026-04-15

## Table Stakes

Features every terminal emulator must have. Without these, users leave immediately.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **ANSI escape sequence rendering** | Every CLI tool emits them; broken rendering = useless | Medium | xterm.js handles this out of the box. Must support: 256-color, true color (24-bit), cursor styles (block/bar/underline), bold/italic/underline/strikethrough, alternate screen buffer, bracketed paste mode |
| **Unicode & emoji rendering** | Modern shells use Unicode everywhere | Low | xterm.js + `@xterm/addon-unicode11`. Wide-character (CJK) support required |
| **Mouse event support** | vim/neovim mouse mode, tmux mouse selection, fzf | Low | xterm.js emits mouse events; must forward to ConPTY |
| **Scrollback buffer** | Users need to scroll up to see previous output | Low-Medium | xterm.js provides this. Configurable max lines. Memory grows with buffer size -- needs upper bound |
| **Copy/Paste** | Basic terminal interaction | Low | Ctrl+C/V (with bracketed paste awareness), right-click paste, clipboard integration via `@xterm/addon-clipboard` |
| **Multiple tabs** | Windows Terminal set this expectation on Windows | Medium | Tab bar UI, tab creation/closure/reordering. Windows Terminal users expect this as baseline |
| **Split panes** | Windows Terminal and WezTerm both ship this natively | Medium | Vertical/horizontal splits, resizable via drag or keyboard. Layout state must be serializable for persistence |
| **Multiple shell profiles** | PowerShell, CMD, WSL, Git Bash -- Windows users need choices | Low | Profile configuration: command, args, icon, color scheme, starting directory |
| **Color schemes / themes** | Users customize appearance | Low | Dark/light themes, custom color palette via settings. At minimum ship 3-4 built-in schemes |
| **Font configuration** | Users need Nerd Fonts, ligatures, custom sizing | Low | Font family, size, line height. Ligature support via `@xterm/addon-ligatures` |
| **Keyboard shortcuts** | Power users expect terminal-style navigation | Medium | Configurable key bindings. Must support tmux-style prefix key (Ctrl-b or configurable) |
| **Command palette** | Windows Terminal 1.24/1.25 ships this; users expect discoverability | Medium | Searchable command list, fuzzy matching |
| **Search in terminal** | VS Code integrated terminal has this; xterm.js provides `@xterm/addon-search` | Low | Find text in scrollback, highlight matches, navigate results |
| **Resize handling** | Window resize must propagate to PTY | Low | `@xterm/addon-fit` + ConPTY resize API |
| **Bracketed paste mode** | Modern shells rely on this to distinguish typed vs pasted input | Low | xterm.js supports; must not break paste behavior |
| **OSC 52 clipboard** | Tmux/vim use this for remote clipboard integration | Low | Escape-sequence-based copy/paste |
| **Terminal bell / visual bell** | Applications trigger bell; must be visible or audible | Low | Visual flash preferred (no system beep by default) |
| **Hyperlink detection** | Clickable URLs in terminal output | Low | `@xterm/addon-web-links` |
| **Process tracking (pane title)** | Showing what's running in each pane (bash, vim, node) | Medium | Parse OSC title sequences, track process name via ConPTY |

## Differentiators

Features that make Termy stand out. These are the reason users would choose Termy over Windows Terminal.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Full session persistence (detach/attach)** | Core differentiator: close app, reopen, everything is exactly where you left it -- processes still running, scrollback intact. Windows Terminal does NOT do this. | High | ConPTY's conhost process lives independent of the Electron UI -- this is the architectural advantage. Must manage: PTY lifecycle, state serialization, auto-reattach on launch |
| **Per-pane process recovery strategy** | User chooses per-pane what happens on restore: (1) keep running in background, (2) restore layout only, (3) auto-re-execute command, (4) remain-on-exit (show output but don't restart). More granular than tmux-resurrect. | High | Requires parsing pane command at save time, user-configurable strategy per-pane or per-profile. Strategy engine + restore logic |
| **Automatic state save on close** | Zero-config persistence: user never manually saves, app saves on close, restores on open. Like tmux-continuum but transparent. | Medium | Hook into Electron before-quit, serialize session state (layout, working directories, pane commands, scrollback) to local JSON. Restore on app ready |
| **Session state visualization** | See what's saved: a "sessions" panel showing saved sessions, which processes are alive, last saved time. Something Windows Terminal and tmux don't offer. | Medium | UI component listing sessions, preview pane contents, ability to delete old saves |
| **Selective scrollback persistence** | User chooses whether to save scrollback per-pane (large buffers = big files). Toggle on/off per-pane or globally. | Medium | `@xterm/addon-serialize` for VT sequence export. Storage size management: scrollback can be MBs per pane |
| **Graceful orphan process management** | Show user when processes outlive the UI, let them choose to kill or keep. Windows Terminal silently leaves orphans. | Medium | Process tree tracking via Windows APIs, notification on relaunch: "3 processes survived from last session" |
| **Session naming and switching** | Named sessions like tmux (`dev`, `infra`, `monitoring`) -- switch between independent session groups, not just tabs. | Medium | Multiple named session states, fast switch UI, indicator showing active session |
| **Layout presets / templates** | Save a pane layout as a template ("my daily dev setup": 3 panes, specific directories, specific commands). One-click restore. | Medium | JSON template format, UI for creating/saving/loading templates |
| **Crash recovery** | If Electron crashes, processes survive (ConPTY) and UI auto-reconnects on next launch. More resilient than any competitor on Windows. | Medium | Detect unclean shutdown (lock file or timestamp), offer reconnect vs fresh start |

## Anti-Features

Things deliberately NOT built to avoid scope creep.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Remote SSH session management** | Not a remote terminal manager; WezTerm and Kitty have built-in SSH mux that adds huge complexity (authentication, network resilience, security surface). Termy is a local terminal emulator. | Users SSH via `ssh` command in a pane; ConPTY handles it like any other process |
| **Cross-platform support** | ConPTY is Windows-specific. Abstracting to macOS/Linux would require PTY implementations on each platform, doubling complexity. The value prop is "tmux persistence on Windows." | Windows only. If demand exists later, fork or add Unix PTY backend as separate build |
| **Built-in AI assistant** | Warp and others ship AI features; they're scope bloat for a terminal emulator, add latency, privacy concerns, and dependency on LLM APIs. | Users can run AI CLI tools (claude, cursor, codex) in panes. Terminal shouldn't be opinionated about AI |
| **Integrated file manager / tree view** | Not a VS Code replacement. Terminal should be a terminal. | Users run `ls`, `broot`, `ranger` (via WSL), or `lf` in a pane |
| **Terminal multiplexer protocol (tmux compatibility layer)** | Building a tmux-compatible protocol is massive scope. tmux control mode support is useful but not worth implementing as a full protocol. | If users want tmux inside Termy, they can run tmux in a pane. The persistence model replaces tmux for most use cases |
| **Plugin/extension system** | Windows Terminal is adding extensions (1.24/1.25); building a plugin API is a massive commitment and attack surface. | Ship enough built-in features. If users need customization, expose settings and key bindings |
| **Real-time collaboration / shared terminals** | Nice-to-have but huge complexity: sync state, conflict resolution, security, networking. Zero demand validated. | Not in scope for v1 |
| **Inline image rendering (Sixel/Kitty protocol)** | Niche use case; adds rendering complexity and dependencies. Alacritty explicitly defers this to external tools. | Defer. If validated demand later, `@xterm/addon-image` provides Sixel |
| **Cloud sync of sessions** | Privacy risk, adds backend infrastructure, network sync complexity. Sessions contain sensitive shell output. | Local JSON only. Users can sync via their own file-sync tool if needed |

## Feature Dependencies

```
Terminal Rendering (xterm.js)
  └── ANSI/Unicode/Mouse support
  └── Scrollback buffer
  └── Search addon
  └── Serialize addon (for scrollback persistence)
  └── WebGL/Canvas renderer
  └── Fit addon (resize)
  └── Clipboard addon

ConPTY Backend (node-pty)
  └── Process spawning
  └── Input/Output piping
  └── Resize propagation
  └── Process lifecycle management (critical for persistence)
  └── Process tree tracking

Session Management
  └── Tabs ← depends on ConPTY (each tab = 1+ PTY processes)
  └── Panes/Splits ← depends on Tabs (panes live inside tabs)
  └── Layout state ← depends on Panes (serialize pane positions)
  └── Session save/restore ← depends on Layout state + ConPTY lifecycle

Persistence Layer
  └── Auto-save on close ← depends on Session Management
  └── Auto-restore on open ← depends on Auto-save
  └── Process recovery strategies ← depends on Session save/restore
  └── Scrollback persistence ← depends on Serialize addon + Session save
  └── Crash recovery ← depends on Auto-save + Process lifecycle

UX Layer
  └── Tab bar UI ← depends on Tabs
  └── Pane split UI ← depends on Panes
  └── Command palette ← depends on all actions being registered
  └── Search UI ← depends on Search addon
  └── Session panel ← depends on Persistence Layer
  └── Settings/config UI ← depends on all configurable features
  └── Keyboard shortcuts ← depends on all user actions

Configuration
  └── Themes/color schemes ← independent
  └── Font settings ← independent
  └── Profile definitions ← depends on ConPTY (shell profiles)
  └── Key bindings ← depends on Keyboard shortcuts
```

## MVP Recommendation

**Phase 1 -- Core Terminal:** Ship a working terminal first. If it doesn't render bash properly, nothing else matters.
1. xterm.js rendering with ANSI, true color, Unicode, cursor modes
2. ConPTY backend via node-pty (spawn shell, I/O, resize)
3. Single tab, single pane -- proof that the stack works

**Phase 2 -- Multi-Pane + Basic Persistence:** The minimum "tmux-like" experience.
4. Multiple tabs
5. Split panes (vertical/horizontal)
6. Auto-save session state on close (layout + working directories + shell type)
7. Auto-restore on open

**Phase 3 -- Process Persistence (the differentiator):**
8. ConPTY lifecycle management: keep processes running after UI closes
9. Per-pane recovery strategies (keep running / layout only / re-execute / remain-on-exit)
10. Scrollback persistence (optional per-pane)
11. Session naming

**Phase 4 -- Polish & UX:**
12. Command palette
13. Search in terminal
14. Settings UI (themes, fonts, key bindings, profiles)
15. Session panel (visualize saved sessions)
16. Crash recovery
17. Layout templates

## User Pain Points from Reference Products

### Windows Terminal
- **No session persistence**: Close the app, lose everything. Tabs don't persist. This is the #1 gap Termy fills.
- **Settings require JSON editing**: Even with 1.25's GUI settings search, advanced config is still JSON-heavy. Termy should aim for a proper settings UI.
- **Lag on heavy output**: Users report stuttering with large outputs. WebGL renderer (xterm.js) should mitigate this.
- **No built-in process tracking**: Can't see what's running across tabs at a glance.
- **Kitty protocol bugs in 1.25**: Key recognition issues when using Kitty keyboard protocol over SSH.

### tmux
- **Steep learning curve**: tmux key bindings and concepts are non-intuitive for newcomers. Termy's GUI must make the concepts discoverable.
- **Scrollback capture is fragile**: tmux-resurrect's pane content capture is unreliable. Termy's serialize-based approach should be more robust.
- **No environment variable save/restore**: Open GitHub issue (#109) -- tmux-resurrect doesn't capture env vars. Termy should address this.
- **Complex shell-specific hacks**: tmux-resurrect needs per-shell (bash/fish/zsh) hacks for command detection. Termy can use Windows process APIs directly.
- **Terminal multiplexer + terminal emulator split**: Users must install both. WezTerm proved the combined model is preferred. Termy follows the WezTerm model.

### WezTerm
- **Multiplexer is "half-baked" compared to tmux**: Session persistence and workspace organization have gaps. Termy should be explicit about what persistence guarantees.
- **Configuration via Lua**: Powerful but intimidating. Termy should use JSON settings (consistent with PROJECT.md decision).
- **Unix domain socket complexity**: The mux-server/unix-domain model is powerful but confusing. Termy's single-app model (no separate server process) is simpler.
- **SSH domain requires matching WezTerm version on remote**: Version coupling is painful. Termy avoids this by not doing remote mux.

### Alacritty
- **No tabs, no splits, no scrollback**: Deliberately minimal. Users who want these features leave for WezTerm/Ghostty. This validates that tabs/splits/scrollback are table stakes.
- **Config file only, no GUI**: Some users want discoverable settings. Termy should have both: config file for power users, GUI for everyone else.
- **No multiplexer**: Follows Unix philosophy ("use tmux"). Termy's differentiator is being the all-in-one solution.

## Complexity Assessment Summary

| Complexity | Features |
|------------|----------|
| **High** | Full session persistence (ConPTY lifecycle management), per-pane recovery strategies |
| **Medium** | Split panes, tabs, command palette, settings UI, session naming, crash recovery, process tracking |
| **Low** | ANSI rendering, scrollback, copy/paste, search, themes, fonts, key bindings, hyperlink detection, terminal bell, OSC 52, bracketed paste |

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| **ConPTY process leak**: Orphaned processes consuming resources | High | Explicit process tree tracking, user notification, explicit kill option |
| **node-pty build issues on Electron**: Native module compilation | High | Pin versions, test Electron rebuild early, consider prebuilds |
| **Scrollback serialization size**: Large buffers = huge JSON files | Medium | Configurable limits, compression option, per-pane toggle |
| **xterm.js WebGL renderer bugs**: Rendering artifacts in Electron | Medium | Canvas fallback, test early, pin xterm.js version |
| **State file corruption**: Bad JSON on crash during save | Medium | Atomic writes (write to temp, then rename), backup last-good state |
| **Feature creep**: Trying to match WezTerm + tmux + Windows Terminal | High | Strict anti-features list, MVP scope enforcement |

## Sources

- [Windows Terminal 1.24/1.25 Release Notes (Microsoft DevBlogs)](https://devblogs.microsoft.com/commandline/windows-terminal-preview-1-25-release/) -- HIGH confidence
- [Windows Terminal Overview (Microsoft Learn)](https://learn.microsoft.com/en-us/windows/terminal/) -- HIGH confidence
- [tmux-resurrect GitHub](https://github.com/tmux-plugins/tmux-resurrect) -- HIGH confidence
- [tmux-resurrect restore.sh source](https://github.com/tmux-plugins/tmux-resurrect/blob/master/scripts/restore.sh) -- HIGH confidence
- [WezTerm Multiplexing Docs](https://wezterm.org/multiplexing.html) -- HIGH confidence
- [WezTerm SSH Docs](https://wezterm.org/ssh.html) -- HIGH confidence
- [Alacritty GitHub](https://github.com/alacritty/alacritty) -- HIGH confidence
- [xterm.js GitHub](https://github.com/xtermjs/xterm.js/) -- HIGH confidence
- [xterm.js 7.0.0 Milestone](https://github.com/xtermjs/xterm.js/milestone/81) -- HIGH confidence
- [node-pty GitHub](https://github.com/microsoft/node-pty) -- HIGH confidence
- [ConPTY Host Lingers (microsoft/terminal#4564)](https://github.com/microsoft/terminal/issues/4564) -- HIGH confidence
- [Console Virtual Terminal Sequences (Microsoft Learn)](https://learn.microsoft.com/en-us/windows/console/console-virtual-terminal-sequences) -- HIGH confidence
- [ANSI Escape Codes (Wikipedia)](https://en.wikipedia.org/wiki/ANSI_escape_code) -- HIGH confidence
- [ANSI Escape Codes Gist (fnky)](https://gist.github.com/fnky/458719343aabd01cfb17a3a4f7296797) -- HIGH confidence
- [Ghostty Session Manager Discussion (#3358)](https://github.com/ghostty-org/ghostty/discussions/3358) -- MEDIUM confidence
- ["you might not need tmux" (bower.sh)](https://bower.sh/you-might-not-need-tmux) -- MEDIUM confidence
- [Windows Terminal user complaints (HN #44338272)](https://news.ycombinator.com/item?id=44338272) -- MEDIUM confidence
- [TmuxAI Terminal Compatibility Matrix](https://tmuxai.dev/terminal-compatibility/) -- MEDIUM confidence
