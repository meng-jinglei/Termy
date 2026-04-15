# Termy

## What This Is

Windows 上的终端模拟器，支持类似 tmux 的持久化会话管理。关掉应用再打开，所有 tab、pane、运行中的进程和终端缓冲区内容自动恢复。基于 Electron + xterm.js，用户可通过图形界面和键盘快捷键管理分屏、标签页和会话。核心差异点：用户可自主选择每个 pane 的进程恢复策略（后台保持运行 / 仅恢复布局 / 自动重新执行 / remain-on-exit 模式）。

## Core Value

在 Windows 上提供 tmux 级别的持久化会话体验——关掉终端，一切原地恢复，无需额外工具。

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] 终端渲染 — 基于 xterm.js 的全功能终端模拟（支持 ANSI 转义序列、颜色、光标等）
- [ ] ConPTY 后端 — 通过 Windows ConPTY API 运行 shell 进程，独立于 UI 生命周期
- [ ] 会话管理 — 创建、切换、关闭多个会话（session）
- [ ] Tab/Pane 管理 — 图形界面管理多个 tab 和 pane 分屏
- [ ] 自动保存 — 关闭应用时自动保存会话状态（布局、工作目录、进程信息）
- [ ] 自动恢复 — 重新打开应用时自动恢复上次保存的会话
- [ ] 进程恢复策略 — 用户可配置每个 pane 的恢复行为（后台运行 / 仅恢复布局 / 自动重执行 / remain-on-exit）
- [ ] 键盘快捷键 — 支持键盘驱动的分屏/导航操作（可选启用）
- [ ] 终端缓冲区持久化 — 保存和恢复终端可见内容（可选）

### Out of Scope

- 移动端支持 — 纯 Windows 桌面应用
- 远程 SSH 会话 — 不是远程终端管理器，是本地终端模拟器
- 跨平台 — Windows only，充分利用 Windows ConPTY API
- 开源商业化 — 个人工具，够用即可

## Context

- **技术栈：** Electron（主进程 Node.js + ConPTY via node-pty）+ xterm.js（渲染层）+ TypeScript
- **操作系统：** Windows 11（优先），利用 Windows 原生 ConPTY API
- **核心优势：** ConPTY 的 server（conhost）生命周期独立于终端窗口，进程在后台持续运行——天然支持 tmux detach/attach 语义
- **参考项目：**
  - [tmux](https://github.com/tmux/tmux) — 会话持久化架构参考
  - [tmux-resurrect](https://github.com/tmux-plugins/tmux-resurrect) — 快照恢复逻辑参考
  - [Windows Terminal](https://github.com/microsoft/terminal) — Windows 终端实现参考
  - [WezTerm](https://github.com/wez/wezterm) — 内置多路复用参考
  - [xterm.js](https://github.com/xtermjs/xterm.js) — 终端渲染引擎

## Constraints

- **Tech stack:** Electron + xterm.js + node-pty — 已选定
- **Platform:** Windows only — 使用 ConPTY API，不做跨平台
- **Architecture:** 单个 Electron 应用，不依赖外部服务或守护进程
- **Complexity:** 个人项目，避免过度工程化

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Electron 而非 Tauri | 开发速度快，TypeScript 全栈，生态成熟 | — Pending |
| xterm.js 作为渲染引擎 | VS Code 同款，成熟稳定，社区活跃 | — Pending |
| node-pty 作为 PTY 层 | Electron 原生支持，ConPTY 绑定成熟 | — Pending |
| 自动保存触发：应用关闭时 | 用户无感，体验最自然 | — Pending |
| 会话状态存储：本地 JSON 文件 | 简单可靠，便于调试和手动修改 | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-15 after initialization*
