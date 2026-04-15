# Phase 1: PTY Foundation - Validation Strategy

**Phase:** 1
**Created:** 2026-04-15
**Source:** Validation Architecture section of 01-RESEARCH.md

## Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest (unit/integration) + playwright (E2E, deferred to Phase 2) |
| Config file | vitest.config.ts (created during Phase 1 execution) |
| Quick run | `npx vitest run --reporter=verbose` |
| Full suite | `npx vitest run` |

## Requirement → Test Map

| Req ID | Behavior | Test Type | Automated Check | Test File |
|--------|----------|-----------|----------------|-----------|
| PTY-01 | ConPTY spawns shell process (pwsh/cmd/wsl) | unit | `vitest run src/main/pty/manager.test.ts` | Created in Plan 01-02 |
| PTY-02 | xterm.js renders output with 256-color/true color | unit + visual | `vitest run src/renderer/terminal/terminal-instance.test.ts` | Created in Plan 01-03 |
| PTY-03 | Keyboard input passes to PTY process | integration | `vitest run tests/pty-input.test.ts` | Created in Plan 01-04 |
| PTY-04 | Process exit displays exit status | unit | `vitest run tests/pty-exit.test.ts` | Created in Plan 01-04 |

## Sampling Rate

- **Per task commit:** `npx vitest run --reporter=verbose` (unit tests only)
- **Per wave merge:** `npx vitest run` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

## Wave 0 Gaps (to be resolved during Phase 1)

- [ ] `vitest` not installed — add as dev dependency
- [ ] `tests/` directory does not exist — create during Phase 1
- [ ] `playwright` for E2E — defer to Phase 2+ when UI is stable
- [ ] No `electron-vite` project scaffold — Phase 1 Task 1 must create this

## Validation Gates

| Gate | Check | When |
|------|-------|------|
| 1 | `npx vitest run --reporter=verbose` passes | After each task commit |
| 2 | `npx vitest run` passes (full suite) | After each wave merge |
| 3 | Manual E2E verification (Task 2 checkpoint in Plan 01-04) | Phase gate before `/gsd-verify-work` |
| 4 | `npm run build` succeeds | Before phase completion |
