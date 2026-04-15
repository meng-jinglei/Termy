# Requirements: Termy

**Defined:** 2026-04-15
**Core Value:** 在 Windows 上提供 tmux 级别的持久化会话体验——关掉终端，一切原地恢复，无需额外工具。

## v1 Requirements

### PTY Foundation

- [ ] **PTY-01**: 通过 Windows ConPTY API 启动 shell 进程（powershell/cmd/wsl）
- [ ] **PTY-02**: xterm.js 渲染终端输出（支持 ANSI 转义序列、256 色/true color）
- [ ] **PTY-03**: 键盘输入正确传递到 PTY 进程
- [ ] **PTY-04**: PTY 进程退出后正确显示退出状态
- [ ] **PTY-05**: 终端窗口 resize 时 PTY 输出正确重排

### Tab & Pane Management

- [ ] **TAB-01**: 创建、切换、关闭多个 tab
- [ ] **TAB-02**: 在单个 tab 内创建水平和垂直分屏（pane）
- [ ] **TAB-03**: 通过鼠标点击聚焦 pane
- [ ] **TAB-04**: 通过键盘快捷键导航 pane（方向键）
- [ ] **TAB-05**: 关闭 tab 时终止关联的 PTY 进程

### Session Persistence

- [ ] **SES-01**: 关闭应用时自动保存当前会话状态（JSON 文件）
- [ ] **SES-02**: 启动应用时自动恢复上次保存的会话
- [ ] **SES-03**: 保存内容包括：tab 布局、pane 分屏结构、每个 pane 的工作目录
- [ ] **SES-04**: 保存终端可见缓冲区内容（可选，默认开启）
- [ ] **SES-05**: 状态文件使用原子写入防止损坏

### Restore Strategies

- [ ] **RST-01**: 用户可配置每个 pane 的恢复策略（设置界面或右键菜单）
- [ ] **RST-02**: 策略一"后台保持运行"——关闭 UI 时 PTY 进程继续在后台运行
- [ ] **RST-03**: 策略二"仅恢复布局"——恢复 pane 布局和工作目录，进程需手动启动
- [ ] **RST-04**: 策略三"自动重新执行"——恢复布局并重新执行上次运行的命令
- [ ] **RST-05**: 策略四"remain-on-exit"——进程退出后 pane 保持打开，按空格重新启动

### UX Polish

- [ ] **UX-01**: 可配置的键盘快捷键（分屏、导航、关闭）
- [ ] **UX-02**: 鼠标滚轮支持回滚缓冲区浏览
- [ ] **UX-03**: 终端内文本搜索（Ctrl+F 或 Cmd+F）
- [ ] **UX-04**: 复制/粘贴支持（Ctrl+C/V 或系统剪贴板）
- [ ] **UX-05**: 自定义主题（前景色、背景色、光标色、选择色）
- [ ] **UX-06**: 自定义字体和字号

## v2 Requirements

### Advanced Features

- **ADV-01**: 命令面板（类似 VS Code Ctrl+Shift+P）
- **ADV-02**: 会话面板（查看所有活跃/保存的会话）
- **ADV-03**: 多窗口支持（多个独立的 Electron 窗口）
- **ADV-04**: 终端背景透明度
- **ADV-05**: Sixel 图像渲染支持
- **ADV-06**: 连字字体支持（Fira Code 等）

### Configuration

- **CFG-01**: 图形化设置界面
- **CFG-02**: JSON 配置文件（支持手动编辑）
- **CFG-03**: 多 Profile 支持（不同 shell、不同配色）
- **CFG-04**: 启动时选择恢复哪个会话（而非总是恢复最后一个）

## Out of Scope

| Feature | Reason |
|---------|--------|
| 跨平台支持 | 项目约束 Windows only，充分利用 ConPTY API |
| 远程 SSH 会话 | 不是远程终端管理器，专注本地终端体验 |
| AI 助手集成 | 避免 Warp 式膨胀，保持轻量 |
| 插件系统 | Windows Terminal 的投资，本项目不需要 |
| 移动端支持 | Windows 桌面应用 |
| 内联图像/附件 | 终端核心是文本，图像支持极低优先级 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PTY-01 | Phase 1 | Pending |
| PTY-02 | Phase 1 | Pending |
| PTY-03 | Phase 1 | Pending |
| PTY-04 | Phase 1 | Pending |
| PTY-05 | Phase 2 | Pending |
| TAB-01 | Phase 2 | Pending |
| TAB-02 | Phase 2 | Pending |
| TAB-03 | Phase 2 | Pending |
| TAB-04 | Phase 2 | Pending |
| TAB-05 | Phase 2 | Pending |
| SES-01 | Phase 3 | Pending |
| SES-02 | Phase 3 | Pending |
| SES-03 | Phase 3 | Pending |
| SES-04 | Phase 3 | Pending |
| SES-05 | Phase 3 | Pending |
| RST-01 | Phase 4 | Pending |
| RST-02 | Phase 4 | Pending |
| RST-03 | Phase 4 | Pending |
| RST-04 | Phase 4 | Pending |
| RST-05 | Phase 4 | Pending |
| UX-01 | Phase 4 | Pending |
| UX-02 | Phase 2 | Pending |
| UX-03 | Phase 4 | Pending |
| UX-04 | Phase 2 | Pending |
| UX-05 | Phase 4 | Pending |
| UX-06 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 26 total
- Mapped to phases: 26
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-15*
*Last updated: 2026-04-15 after initial definition*
