---
plan: 01-02
phase: 01-pty-foundation
status: complete
started: 2026-04-15T15:05:00Z
completed: 2026-04-15T15:10:00Z
self_check: PASSED
---

## Plan 01-02: PTY Layer (PTY-01)

**Status:** COMPLETE

### What was built
PTY layer in Electron main process — shell detection, PTY session manager, IPC channels, and preload API.

### Key files
- `src/shared/ipc-channels.ts` — 6 typed IPC channels + message interfaces
- `src/main/pty/types.ts` — ShellProfile, PtySession, PtyOptions
- `src/main/pty/shell-detector.ts` — detectShells() for pwsh, powershell, git-bash, wsl
- `src/main/pty/manager.ts` — PtyManager: spawn/write/resize/kill with EventEmitter, ConPTY 3s timeout fallback
- `src/main/ipc.ts` — IPC handlers with setImmediate output batching
- `src/main/index.ts` — integrates PtyManager, shell detection, before-quit cleanup
- `src/preload/index.ts` — typed terminalAPI via contextBridge

### Verification
- `npm run build` succeeds — main: 6.36kB, preload: 0.88kB
- All TypeScript strict mode checks pass
- Shell detection returns at minimum Windows PowerShell
- IPC batching prevents backpressure via setImmediate

### Notes
- Uses @lydell/node-pty fork (D-10 fallback) — import path `@lydell/node-pty`
- Shell path validation against detected shells prevents injection (T-01-05, T-01-06)
- ConPTY close hang mitigated with 3s taskkill timeout (Pitfall 3)
