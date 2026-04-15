# Phase 1: PTY Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-15
**Phase:** 1-pty-foundation
**Areas discussed:** Shell Support, Startup Behavior, Window Behavior, Build Risk Mitigation

---

## Shell Support

| Option | Description | Selected |
|--------|-------------|----------|
| PowerShell 7 | Windows 11 default shell, recommended | ✓ |
| cmd.exe | Windows built-in, backward compatibility | |
| WSL (Ubuntu etc) | Linux environment on Windows | ✓ |
| Git Bash | Git-provided bash shell | ✓ |

**User's choice:** PowerShell 7, Git Bash, WSL (multi-select)
**Notes:** cmd.exe explicitly excluded from v1 shell list. User can add custom shells via config in Phase 5.

## Startup Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Direct terminal (Recommended) | Open Termy → immediately see PowerShell terminal | ✓ |
| Management UI first | Show admin/management UI before opening terminal | |
| Remember last shell | Restore previously used shell on launch | |

**User's choice:** Direct terminal (Recommended)
**Notes:** Shell selector accessible via UI button but default is always last-used or PowerShell 7 on first launch.

## Window Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Single Window (Recommended) | Phase 1: one Electron window, one pane | ✓ |
| Multi-Window | Phase 1: support multiple OS windows | |

**User's choice:** Single Window (Recommended)
**Notes:** Multi-window deferred to Phase 2+.

## Build Risk Mitigation

| Option | Description | Selected |
|--------|-------------|----------|
| Verify First (Recommended) | Spike to confirm node-pty compiles with Electron before feature work | ✓ |
| Develop Directly | Trust node-pty works, fix if it breaks | |

**User's choice:** Verify First (Recommended)
**Notes:** Fallback chain: node-pty 1.1.0 → @lydell/node-pty fork → direct ConPTY FFI evaluation.

---

## Claude's Discretion

Areas where user deferred to Claude:
- PTY process lifecycle management details
- IPC channel naming and message schema design
- Error message wording and formatting

## Deferred Ideas

- cmd.exe support → Phase 5
- Custom shell profiles → Phase 5
- Terminal themes and fonts → Phase 5
- Multi-window support → Phase 2+
- Command palette → Phase 5
