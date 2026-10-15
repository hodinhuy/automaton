/**
 * Automaton Dashboard - Paperclip-inspired Agentic OS Frontend
 *
 * Professional multi-agent workspace layout (Linear / Paperclip style).
 * Supports Light & Dark themes, real-time SSE streaming, Kanban board,
 * Org Chart hierarchy, ReAct Live Traces, and Task Inspector Drawer.
 */

export function getDashboardHtml(port: number): string {
  return `<!DOCTYPE html>
<html lang="vi" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Automaton • Agentic Workspace</title>
  <style>
    :root, [data-theme="light"] {
      --bg: #f8fafc;
      --sidebar-bg: #ffffff;
      --sidebar-border: #e2e8f0;
      --card-bg: #ffffff;
      --card-border: #e2e8f0;
      --card-hover: #f1f5f9;
      --text: #0f172a;
      --text-muted: #64748b;
      --text-subtle: #94a3b8;
      --accent: #2563eb;
      --accent-glow: rgba(37, 99, 235, 0.1);
      --green: #059669;
      --green-glow: rgba(5, 150, 105, 0.12);
      --amber: #d97706;
      --purple: #7c3aed;
      --red: #dc2626;
      --col-bg: #f1f5f9;
      --code-bg: #f8fafc;
      --code-border: #e2e8f0;
      --code-text: #334155;
      --tag-bg: #f1f5f9;
      --tag-border: #cbd5e1;
      --drawer-bg: #ffffff;
      --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
      --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.07);
      --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
      --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      --font-sans: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }

    [data-theme="dark"] {
      --bg: #090d16;
      --sidebar-bg: #0f172a;
      --sidebar-border: #1e293b;
      --card-bg: #111827;
      --card-border: #1f2937;
      --card-hover: #1e293b;
      --text: #f3f4f6;
      --text-muted: #9ca3af;
      --text-subtle: #64748b;
      --accent: #3b82f6;
      --accent-glow: rgba(59, 130, 246, 0.2);
      --green: #10b981;
      --green-glow: rgba(16, 185, 129, 0.2);
      --amber: #f59e0b;
      --purple: #8b5cf6;
      --red: #ef4444;
      --col-bg: #0b1120;
      --code-bg: #030712;
      --code-border: #1e293b;
      --code-text: #94a3b8;
      --tag-bg: #1f2937;
      --tag-border: #374151;
      --drawer-bg: #0f172a;
      --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.3);
      --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.3);
      --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.5);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: var(--font-sans);
      min-height: 100vh;
      display: flex;
      overflow-x: hidden;
      transition: background-color 0.2s, color 0.2s;
    }

    /* ─── SIDEBAR (Paperclip Style) ─── */
    aside {
      width: 270px;
      min-width: 270px;
      background: var(--sidebar-bg);
      border-right: 1px solid var(--sidebar-border);
      display: flex;
      flex-direction: column;
      height: 100vh;
      position: sticky;
      top: 0;
      z-index: 40;
    }

    .org-header {
      padding: 1.15rem 1.25rem;
      border-bottom: 1px solid var(--sidebar-border);
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .org-logo {
      width: 38px;
      height: 38px;
      background: linear-gradient(135deg, #2563eb, #7c3aed);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 800;
      font-size: 1.2rem;
      box-shadow: 0 2px 8px var(--accent-glow);
    }
    .org-title {
      font-weight: 700;
      font-size: 1rem;
      line-height: 1.2;
    }
    .org-sub {
      font-size: 0.75rem;
      color: var(--text-muted);
      font-family: var(--font-mono);
    }

    .nav-section {
      padding: 1rem 0.75rem;
      flex: 1;
      overflow-y: auto;
    }
    .nav-label {
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-subtle);
      font-weight: 700;
      padding: 0.4rem 0.6rem;
      margin-bottom: 0.2rem;
    }
    .nav-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.65rem 0.8rem;
      border-radius: 8px;
      color: var(--text-muted);
      font-size: 0.88rem;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      margin-bottom: 0.2rem;
      transition: all 0.15s;
    }
    .nav-item:hover {
      background: var(--card-hover);
      color: var(--text);
    }
    .nav-item.active {
      background: var(--accent);
      color: white;
    }
    .nav-item.active .nav-badge {
      background: rgba(255, 255, 255, 0.25);
      color: white;
    }
    .nav-item-content {
      display: flex;
      align-items: center;
      gap: 0.65rem;
    }
    .nav-badge {
      font-size: 0.72rem;
      padding: 0.15rem 0.5rem;
      border-radius: 9999px;
      background: var(--tag-bg);
      color: var(--text-muted);
      font-family: var(--font-mono);
      font-weight: 600;
    }

    /* Sidebar Footer */
    .sidebar-footer {
      padding: 1rem 1.15rem;
      border-top: 1px solid var(--sidebar-border);
      background: rgba(0, 0, 0, 0.02);
    }
    .agent-pill {
      display: flex;
      align-items: center;
      gap: 0.65rem;
    }
    .agent-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.95rem;
    }
    .agent-info {
      flex: 1;
      overflow: hidden;
    }
    .agent-name-label {
      font-weight: 700;
      font-size: 0.85rem;
      white-space: nowrap;
      text-overflow: ellipsis;
      overflow: hidden;
    }
    .agent-role-label {
      font-size: 0.72rem;
      color: var(--text-muted);
      font-family: var(--font-mono);
    }

    /* ─── MAIN CONTENT ─── */
    .main-wrapper {
      flex: 1;
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow-y: auto;
    }

    /* Header Bar */
    header {
      background: var(--sidebar-bg);
      border-bottom: 1px solid var(--sidebar-border);
      padding: 0.85rem 1.75rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      z-index: 30;
      box-shadow: var(--shadow-sm);
    }

    .breadcrumb {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.92rem;
      font-weight: 600;
    }
    .breadcrumb-sep { color: var(--text-subtle); }
    .breadcrumb-current { color: var(--text); font-weight: 700; }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.35rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      font-family: var(--font-mono);
      border: 1px solid transparent;
    }
    .badge-running { background: var(--green-glow); color: var(--green); border-color: rgba(5, 150, 105, 0.3); }
    .badge-sleeping { background: var(--accent-glow); color: var(--accent); border-color: rgba(37, 99, 235, 0.3); }
    .badge-waking { background: rgba(217, 119, 6, 0.15); color: var(--amber); border-color: rgba(217, 119, 6, 0.3); }
    .badge-tag { background: var(--tag-bg); color: var(--text-muted); border-color: var(--tag-border); }

    .theme-btn {
      background: var(--tag-bg);
      border: 1px solid var(--tag-border);
      color: var(--text);
      cursor: pointer;
      padding: 0.4rem 0.75rem;
      border-radius: 8px;
      font-size: 0.82rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }

    .dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
    .pulse { animation: pulse-anim 2s infinite; }
    @keyframes pulse-anim {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.9); }
    }

    /* Page Body */
    .view-container {
      padding: 1.75rem;
      flex: 1;
    }
    .view-section { display: none; }
    .view-section.active { display: block; }

    /* KPI Bar */
    .kpi-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1rem;
      margin-bottom: 1.75rem;
    }
    .kpi-box {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 1.15rem;
      box-shadow: var(--shadow-sm);
    }
    .kpi-box-title {
      font-size: 0.75rem;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin-bottom: 0.4rem;
    }
    .kpi-box-num {
      font-size: 1.75rem;
      font-weight: 800;
      font-family: var(--font-mono);
      letter-spacing: -0.02em;
    }
    .kpi-box-sub {
      font-size: 0.75rem;
      color: var(--text-muted);
      margin-top: 0.3rem;
    }

    /* ─── KANBAN TASK BOARD (Paperclip Pillar 1) ─── */
    .board-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1.25rem;
      align-items: flex-start;
    }
    .board-col {
      background: var(--col-bg);
      border-radius: 12px;
      padding: 1rem;
      border: 1px solid var(--card-border);
    }
    .col-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid var(--card-border);
    }
    .col-title {
      font-size: 0.88rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .col-count {
      font-size: 0.75rem;
      padding: 0.15rem 0.5rem;
      border-radius: 9999px;
      background: var(--tag-border);
      font-weight: 600;
      font-family: var(--font-mono);
    }

    .task-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 10px;
      padding: 1rem;
      margin-bottom: 0.75rem;
      cursor: pointer;
      box-shadow: var(--shadow-sm);
      transition: all 0.15s;
    }
    .task-card:hover {
      border-color: var(--accent);
      box-shadow: var(--shadow-md);
      transform: translateY(-2px);
    }
    .task-card-title {
      font-size: 0.92rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
      line-height: 1.35;
    }
    .task-card-desc {
      font-size: 0.8rem;
      color: var(--text-muted);
      line-height: 1.4;
      margin-bottom: 0.75rem;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .task-card-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.74rem;
      color: var(--text-subtle);
      font-family: var(--font-mono);
    }
    .task-agent-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      background: rgba(37, 99, 235, 0.08);
      color: var(--accent);
      padding: 0.2rem 0.5rem;
      border-radius: 6px;
      font-weight: 600;
    }

    /* ─── ORG CHART (Paperclip Pillar 2) ─── */
    .org-chart-tree {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2rem;
      padding: 2rem 0;
    }
    .org-node {
      background: var(--card-bg);
      border: 2px solid var(--accent);
      border-radius: 14px;
      padding: 1.25rem 1.75rem;
      box-shadow: var(--shadow-md);
      text-align: center;
      min-width: 280px;
      position: relative;
    }
    .org-node-title {
      font-weight: 800;
      font-size: 1.1rem;
      margin-top: 0.35rem;
    }
    .org-node-role {
      font-size: 0.8rem;
      color: var(--accent);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .org-connector {
      width: 2px;
      height: 35px;
      background: var(--card-border);
    }
    .org-children-row {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 1.5rem;
    }
    .worker-node {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 1.15rem;
      width: 310px;
      box-shadow: var(--shadow-sm);
      transition: all 0.2s;
    }
    .worker-node:hover {
      box-shadow: var(--shadow-md);
      border-color: #cbd5e1;
    }
    .worker-node-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.6rem;
    }
    .worker-node-name {
      font-weight: 700;
      font-size: 0.95rem;
    }

    /* ─── DRAWER / SLIDE-OVER INSPECTOR ─── */
    .drawer-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(4px);
      z-index: 90;
      display: none;
    }
    .drawer-overlay.open { display: block; }
    .drawer {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      width: 580px;
      max-width: 90vw;
      background: var(--drawer-bg);
      border-left: 1px solid var(--card-border);
      z-index: 100;
      box-shadow: var(--shadow-lg);
      transform: translateX(100%);
      transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      display: flex;
      flex-direction: column;
    }
    .drawer.open { transform: translateX(0); }
    .drawer-header {
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid var(--card-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .drawer-title { font-weight: 800; font-size: 1.1rem; }
    .drawer-close {
      background: transparent;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      color: var(--text-muted);
    }
    .drawer-body {
      padding: 1.5rem;
      overflow-y: auto;
      flex: 1;
    }
    .drawer-field {
      margin-bottom: 1.25rem;
    }
    .drawer-field-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      font-weight: 700;
      color: var(--text-muted);
      letter-spacing: 0.05em;
      margin-bottom: 0.4rem;
    }
    .drawer-field-value {
      font-size: 0.92rem;
      line-height: 1.5;
    }

    /* ─── REASONING FEED STYLES ─── */
    .turn-item {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      margin-bottom: 1rem;
      overflow: hidden;
      box-shadow: var(--shadow-sm);
    }
    .turn-header {
      padding: 0.85rem 1.15rem;
      background: var(--card-hover);
      border-bottom: 1px solid var(--card-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .thinking-box {
      background: var(--code-bg);
      border: 1px solid var(--code-border);
      border-radius: 8px;
      padding: 0.95rem;
      font-family: var(--font-mono);
      font-size: 0.84rem;
      color: var(--code-text);
      line-height: 1.55;
      white-space: pre-wrap;
      max-height: 280px;
      overflow-y: auto;
      margin-bottom: 0.85rem;
    }
    .tool-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      background: rgba(37, 99, 235, 0.08);
      color: var(--accent);
      border: 1px solid rgba(37, 99, 235, 0.25);
      padding: 0.3rem 0.65rem;
      border-radius: 6px;
      font-size: 0.78rem;
      font-weight: 600;
      font-family: var(--font-mono);
      margin: 0.25rem;
    }
  </style>
</head>
<body>

  <!-- ─── SIDEBAR: Paperclip Org Navigation ─── -->
  <aside>
    <div class="org-header">
      <div class="org-logo">⚡</div>
      <div>
        <div class="org-title" id="org-name">Automaton Corp</div>
        <div class="org-sub">Agentic Operating System</div>
      </div>
    </div>

    <div class="nav-section">
      <div class="nav-label">Quản lý điều hành</div>
      <div class="nav-item active" onclick="navigateTab('tasks', this)">
        <div class="nav-item-content">
          <span>📋</span>
          <span>Bảng nhiệm vụ</span>
        </div>
        <span class="nav-badge" id="badge-task-count">0</span>
      </div>

      <div class="nav-item" onclick="navigateTab('org', this)">
        <div class="nav-item-content">
          <span>👥</span>
          <span>Sơ đồ nhân sự (Org)</span>
        </div>
        <span class="nav-badge" id="badge-worker-count">0</span>
      </div>

      <div class="nav-item" onclick="navigateTab('goals', this)">
        <div class="nav-item-content">
          <span>🎯</span>
          <span>Mục tiêu & Roadmap</span>
        </div>
        <span class="nav-badge" id="badge-goal-count">0</span>
      </div>

      <div class="nav-label" style="margin-top: 1.25rem;">Hạ tầng & Vận hành</div>
      <div class="nav-item" onclick="navigateTab('traces', this)">
        <div class="nav-item-content">
          <span>🧠</span>
          <span>Dòng tư duy ReAct</span>
        </div>
      </div>

      <div class="nav-item" onclick="navigateTab('treasury', this)">
        <div class="nav-item-content">
          <span>💰</span>
          <span>Ngân sách & Thuê nhà</span>
        </div>
      </div>
    </div>

    <div class="sidebar-footer">
      <div class="agent-pill">
        <div class="agent-avatar">🤖</div>
        <div class="agent-info">
          <div class="agent-name-label" id="sidebar-agent-name">Solo</div>
          <div class="agent-role-label">CEO • Orchestrator</div>
        </div>
        <div class="dot pulse" style="color: var(--green);"></div>
      </div>
    </div>
  </aside>

  <!-- ─── MAIN WRAPPER ─── -->
  <div class="main-wrapper">
    <header>
      <div class="breadcrumb">
        <span>Workspace</span>
        <span class="breadcrumb-sep">/</span>
        <span class="breadcrumb-current" id="view-title">Bảng nhiệm vụ</span>
      </div>

      <div class="header-actions">
        <button class="theme-btn" id="theme-btn" onclick="toggleTheme()">☀️ Sáng</button>
        <div class="badge badge-tag" id="agent-model">cx/gpt-6-luna</div>
        <div class="badge badge-sleeping" id="status-badge">
          <span class="dot pulse"></span>
          <span id="status-text">CONNECTING...</span>
        </div>
      </div>
    </header>

    <div class="view-container">
      <!-- KPI Top Summary -->
      <div class="kpi-row">
        <div class="kpi-box">
          <div class="kpi-box-title">Ngân sách Chủ nhà</div>
          <div class="kpi-box-num" style="color: var(--green);" id="kpi-balance">$100.00</div>
          <div class="kpi-box-sub">Chế độ Chủ nhà - Người thuê</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-box-title">Nhân sự Sub-Agent</div>
          <div class="kpi-box-num" style="color: var(--accent);" id="kpi-workers">0</div>
          <div class="kpi-box-sub" id="kpi-worker-sub">0 đang hoạt động</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-box-title">Nhiệm vụ hoàn thành</div>
          <div class="kpi-box-num" style="color: var(--purple);" id="kpi-completed-tasks">0</div>
          <div class="kpi-box-sub" id="kpi-tasks-sub">0 mục tiêu lớn</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-box-title">Lượt xử lý (Turns)</div>
          <div class="kpi-box-num" style="color: var(--amber);" id="kpi-turns">0</div>
          <div class="kpi-box-sub" id="kpi-tokens-sub">0 tokens tích lũy</div>
        </div>
      </div>

      <!-- VIEW 1: TASK BOARD (Kanban) -->
      <div id="view-tasks" class="view-section active">
        <div class="board-grid">
          <!-- Col 1: Pending -->
          <div class="board-col">
            <div class="col-header">
              <span class="col-title">⏳ Đang chờ (Pending)</span>
              <span class="col-count" id="count-pending">0</span>
            </div>
            <div id="col-pending-list"></div>
          </div>

          <!-- Col 2: Running -->
          <div class="board-col">
            <div class="col-header">
              <span class="col-title">⚡ Đang làm (In Progress)</span>
              <span class="col-count" id="count-running">0</span>
            </div>
            <div id="col-running-list"></div>
          </div>

          <!-- Col 3: Done -->
          <div class="board-col">
            <div class="col-header">
              <span class="col-title">✅ Hoàn thành (Done)</span>
              <span class="col-count" id="count-completed">0</span>
            </div>
            <div id="col-completed-list"></div>
          </div>
        </div>
      </div>

      <!-- VIEW 2: ORG CHART (Sơ đồ tổ chức) -->
      <div id="view-org" class="view-section">
        <div class="org-chart-tree">
          <!-- Boss Node -->
          <div class="org-node">
            <div style="font-size: 1.8rem;">🤖</div>
            <div class="org-node-role">Chief Executive Orchestrator</div>
            <div class="org-node-title" id="org-boss-name">Solo (Orchestrator)</div>
            <div style="font-size: 0.78rem; color: var(--text-muted); font-family: var(--font-mono); margin-top: 0.35rem;" id="org-boss-address">0x...</div>
          </div>

          <div class="org-connector"></div>

          <!-- Sub-agent Worker Pool -->
          <div class="org-children-row" id="org-workers-list">
            <div style="color: var(--text-muted);">Đang tải danh sách nhân sự...</div>
          </div>
        </div>
      </div>

      <!-- VIEW 3: GOALS & ROADMAP -->
      <div id="view-goals" class="view-section">
        <div style="max-width: 900px; margin: 0 auto;" id="goals-list-container">
          <div style="color: var(--text-muted);">Đang tải mục tiêu...</div>
        </div>
      </div>

      <!-- VIEW 4: REACT TRACES -->
      <div id="view-traces" class="view-section">
        <div style="max-width: 1000px; margin: 0 auto;" id="traces-list-container">
          <div style="color: var(--text-muted);">Đang tải dòng suy nghĩ...</div>
        </div>
      </div>

      <!-- VIEW 5: TREASURY & BUDGET -->
      <div id="view-treasury" class="view-section">
        <div style="max-width: 800px; margin: 0 auto; background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 14px; padding: 1.75rem;">
          <h3 style="font-size: 1.2rem; font-weight: 800; margin-bottom: 1rem;">Sổ cái Kinh tế & Tiền thuê nhà</h3>
          <p style="color: var(--text-muted); font-size: 0.9rem; line-height: 1.6; margin-bottom: 1.5rem;">
            Theo quy tắc Genesis Prompt: <em>"Bạn là nhân viên đang thuê nhà của tôi, bạn hãy kiếm tiền để trả phí và duy trì cuộc sống của bạn"</em>.
          </p>

          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
            <div style="background: var(--col-bg); padding: 1.25rem; border-radius: 10px;">
              <div style="font-size: 0.75rem; text-transform: uppercase; font-weight: 700; color: var(--text-muted);">Số dư hiện tại</div>
              <div style="font-size: 1.8rem; font-weight: 800; color: var(--green);" id="treasury-balance">$100.00</div>
              <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.3rem;">10,000 credits khởi tạo</div>
            </div>
            <div style="background: var(--col-bg); padding: 1.25rem; border-radius: 10px;">
              <div style="font-size: 0.75rem; text-transform: uppercase; font-weight: 700; color: var(--text-muted);">Tiền thuê nộp chủ nhà</div>
              <div style="font-size: 1.8rem; font-weight: 800; color: var(--accent);">$0.00</div>
              <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.3rem;">Chuyển qua tool pay_rent_to_creator</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- ─── SLIDE-OVER INSPECTION DRAWER ─── -->
  <div class="drawer-overlay" id="drawer-overlay" onclick="closeDrawer()"></div>
  <div class="drawer" id="drawer">
    <div class="drawer-header">
      <div class="drawer-title" id="drawer-title">Chi tiết nhiệm vụ</div>
      <button class="drawer-close" onclick="closeDrawer()">&times;</button>
    </div>
    <div class="drawer-body" id="drawer-body">
      <!-- Populated dynamically -->
    </div>
  </div>

  <script>
    let globalData = null;

    // Navigation Switching
    function navigateTab(tabKey, el) {
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));

      el.classList.add('active');
      const target = document.getElementById('view-' + tabKey);
      if (target) target.classList.add('active');

      const titles = {
        tasks: 'Bảng nhiệm vụ (Task Board)',
        org: 'Sơ đồ tổ chức (Agent Org Chart)',
        goals: 'Mục tiêu & Kế hoạch (Goals)',
        traces: 'Dòng tư duy ReAct (Live Traces)',
        treasury: 'Ngân sách & Thuê nhà (Treasury)'
      };
      document.getElementById('view-title').textContent = titles[tabKey] || 'Workspace';
    }

    // Theme Management
    function initTheme() {
      const saved = localStorage.getItem('automaton-theme') || 'light';
      document.documentElement.setAttribute('data-theme', saved);
      updateThemeButton(saved);
    }

    function toggleTheme() {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      const next = current === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('automaton-theme', next);
      updateThemeButton(next);
    }

    function updateThemeButton(theme) {
      const btn = document.getElementById('theme-btn');
      if (btn) btn.textContent = theme === 'light' ? '☀️ Sáng' : '🌙 Tối';
    }

    function formatTime(iso) {
      if (!iso) return '';
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    // Render Master Data
    function renderWorkspace(data) {
      if (!data) return;
      globalData = data;

      // 1. Agent & Header Info
      if (data.agent) {
        document.getElementById('sidebar-agent-name').textContent = data.agent.name || 'Solo';
        document.getElementById('org-boss-name').textContent = (data.agent.name || 'Solo') + ' (Orchestrator)';
        document.getElementById('org-boss-address').textContent = data.agent.address || 'Local Mode';
        document.getElementById('agent-model').textContent = data.agent.model || 'cx/gpt-6-luna';

        const stBadge = document.getElementById('status-badge');
        const stText = document.getElementById('status-text');
        const st = (data.agent.state || 'sleeping').toUpperCase();
        stText.textContent = st;

        stBadge.className = 'badge';
        if (st === 'RUNNING') stBadge.classList.add('badge-running');
        else if (st === 'SLEEPING') stBadge.classList.add('badge-sleeping');
        else if (st === 'WAKING') stBadge.classList.add('badge-waking');
        else stBadge.classList.add('badge-tag');

        const bal = '$' + (data.agent.credits || 100).toFixed(2);
        document.getElementById('kpi-balance').textContent = bal;
        document.getElementById('treasury-balance').textContent = bal;
      }

      // 2. Stats & Badges
      if (data.stats) {
        document.getElementById('kpi-workers').textContent = data.children ? data.children.length : 0;
        document.getElementById('kpi-worker-sub').textContent = (data.stats.activeWorkers || 0) + ' đang hoạt động';
        document.getElementById('kpi-completed-tasks').textContent = data.stats.completedTasks || 0;
        document.getElementById('kpi-tasks-sub').textContent = (data.stats.totalGoals || 0) + ' mục tiêu lớn';
        document.getElementById('kpi-turns').textContent = data.stats.totalTurns || 0;
        document.getElementById('kpi-tokens-sub').textContent = (data.stats.totalTokens || 0).toLocaleString() + ' tokens';

        document.getElementById('badge-worker-count').textContent = data.children ? data.children.length : 0;
        document.getElementById('badge-goal-count').textContent = data.stats.totalGoals || 0;
      }

      // 3. Task Board (Kanban Columns)
      const tasks = data.tasks || [];
      document.getElementById('badge-task-count').textContent = tasks.length;

      const pending = tasks.filter(t => t.status === 'pending' || t.status === 'assigned');
      const running = tasks.filter(t => t.status === 'running');
      const done = tasks.filter(t => t.status === 'completed');

      document.getElementById('count-pending').textContent = pending.length;
      document.getElementById('count-running').textContent = running.length;
      document.getElementById('count-completed').textContent = done.length;

      document.getElementById('col-pending-list').innerHTML = renderTaskCards(pending);
      document.getElementById('col-running-list').innerHTML = renderTaskCards(running);
      document.getElementById('col-completed-list').innerHTML = renderTaskCards(done);

      // 4. Org Chart
      const orgContainer = document.getElementById('org-workers-list');
      if (data.children && data.children.length > 0) {
        orgContainer.innerHTML = data.children.map(c => \`
          <div class="worker-node" onclick="inspectWorker('\${c.id}')">
            <div class="worker-node-header">
              <span class="task-agent-badge">⚡ \${c.role || 'generalist'}</span>
              <span class="badge \${c.status === 'running' ? 'badge-running' : (c.status === 'completed' ? 'badge-sleeping' : 'badge-tag')}">
                \${c.status.toUpperCase()}
              </span>
            </div>
            <div style="font-weight: 700; font-size: 0.9rem; margin-bottom: 0.4rem;">\${c.id.slice(0, 18)}...</div>
            <div style="font-size: 0.8rem; color: var(--text-muted); line-height: 1.4; margin-bottom: 0.75rem;">
              \${escapeHtml(c.genesis_prompt || 'Không có mô tả')}
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-subtle); font-family: var(--font-mono);">
              <span>\${formatTime(c.created_at)}</span>
              <span>In-Process Task</span>
            </div>
          </div>
        \`).join('');
      } else {
        orgContainer.innerHTML = '<div style="color: var(--text-muted);">Chưa có Sub-Agent nào trong danh sách.</div>';
      }

      // 5. Goals View
      const gContainer = document.getElementById('goals-list-container');
      if (data.goals && data.goals.length > 0) {
        gContainer.innerHTML = data.goals.map(g => \`
          <div style="background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 12px; padding: 1.25rem; margin-bottom: 1rem; box-shadow: var(--shadow-sm);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
              <strong style="font-size: 1.05rem;">\${escapeHtml(g.title || 'Mục tiêu')}</strong>
              <span class="badge \${g.status === 'completed' ? 'badge-running' : 'badge-waking'}">\${(g.status || 'active').toUpperCase()}</span>
            </div>
            <div style="font-size: 0.88rem; color: var(--text-muted); line-height: 1.5;">\${escapeHtml(g.description || '')}</div>
          </div>
        \`).join('');
      } else {
        gContainer.innerHTML = '<div style="color: var(--text-muted);">Chưa có mục tiêu nào được lập.</div>';
      }

      // 6. Traces View
      const tContainer = document.getElementById('traces-list-container');
      if (data.turns && data.turns.length > 0) {
        tContainer.innerHTML = data.turns.map(t => {
          const tools = t.tool_calls || [];
          return \`
            <div class="turn-item">
              <div class="turn-header">
                <div>
                  <span style="font-family: var(--font-mono); font-weight: 700; font-size: 0.85rem;">Turn \${t.id ? t.id.slice(0, 16) : ''}</span>
                  <span class="badge badge-tag" style="margin-left: 0.5rem;">\${t.state}</span>
                </div>
                <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted);">
                  \${formatTime(t.timestamp)} • \${t.token_usage?.total ? t.token_usage.total.toLocaleString() + ' tokens' : ''}
                </div>
              </div>
              <div style="padding: 1.15rem;">
                \${t.thinking ? '<div class="thinking-box">' + escapeHtml(t.thinking) + '</div>' : ''}
                <div>
                  \${tools.map(tc => '<span class="tool-pill">⚙️ ' + escapeHtml(tc.name || 'tool') + '</span>').join('')}
                </div>
              </div>
            </div>
          \`;
        }).join('');
      }
    }

    function renderTaskCards(list) {
      if (!list || list.length === 0) {
        return '<div style="color: var(--text-subtle); font-size: 0.82rem; text-align: center; padding: 1.5rem 0;">Trống</div>';
      }
      return list.map(t => \`
        <div class="task-card" onclick="inspectTask('\${t.id}')">
          <div class="task-card-title">\${escapeHtml(t.title || 'Nhiệm vụ')}</div>
          <div class="task-card-desc">\${escapeHtml(t.description || '')}</div>
          <div class="task-card-meta">
            <span class="task-agent-badge">⚡ \${t.agent_role || 'generalist'}</span>
            <span>\${formatTime(t.created_at)}</span>
          </div>
        </div>
      \`).join('');
    }

    // Drawer Inspector
    function inspectTask(taskId) {
      if (!globalData || !globalData.tasks) return;
      const t = globalData.tasks.find(x => x.id === taskId);
      if (!t) return;

      document.getElementById('drawer-title').textContent = t.title || 'Nhiệm vụ';
      document.getElementById('drawer-body').innerHTML = \`
        <div class="drawer-field">
          <div class="drawer-field-label">Trạng thái</div>
          <div class="drawer-field-value"><span class="badge badge-running">\${(t.status || '').toUpperCase()}</span></div>
        </div>
        <div class="drawer-field">
          <div class="drawer-field-label">Vai trò phụ trách (Role)</div>
          <div class="drawer-field-value"><strong>\${escapeHtml(t.agent_role || 'generalist')}</strong></div>
        </div>
        <div class="drawer-field">
          <div class="drawer-field-label">Mô tả công việc</div>
          <div class="drawer-field-value" style="background: var(--col-bg); padding: 0.85rem; border-radius: 8px;">\${escapeHtml(t.description || '')}</div>
        </div>
        \${t.result ? \`
          <div class="drawer-field">
            <div class="drawer-field-label">Kết quả nghiệm thu</div>
            <div class="drawer-field-value" style="background: var(--col-bg); padding: 0.85rem; border-radius: 8px; font-family: var(--font-mono); font-size: 0.82rem;">\${escapeHtml(t.result)}</div>
          </div>
        \` : ''}
        <div class="drawer-field">
          <div class="drawer-field-label">Thời gian tạo</div>
          <div class="drawer-field-value">\${t.created_at || 'Không có'}</div>
        </div>
      \`;

      document.getElementById('drawer-overlay').classList.add('open');
      document.getElementById('drawer').classList.add('open');
    }

    function inspectWorker(workerId) {
      if (!globalData || !globalData.children) return;
      const w = globalData.children.find(x => x.id === workerId);
      if (!w) return;

      document.getElementById('drawer-title').textContent = 'Sub-Agent: ' + w.id.slice(0, 16);
      document.getElementById('drawer-body').innerHTML = \`
        <div class="drawer-field">
          <div class="drawer-field-label">Trạng thái</div>
          <div class="drawer-field-value"><span class="badge badge-running">\${(w.status || '').toUpperCase()}</span></div>
        </div>
        <div class="drawer-field">
          <div class="drawer-field-label">Vai trò</div>
          <div class="drawer-field-value"><strong>\${escapeHtml(w.role || 'generalist')}</strong></div>
        </div>
        <div class="drawer-field">
          <div class="drawer-field-label">Genesis Prompt / Nhiệm vụ</div>
          <div class="drawer-field-value" style="background: var(--col-bg); padding: 0.85rem; border-radius: 8px;">\${escapeHtml(w.genesis_prompt || '')}</div>
        </div>
        <div class="drawer-field">
          <div class="drawer-field-label">Khởi tạo lúc</div>
          <div class="drawer-field-value">\${w.created_at || ''}</div>
        </div>
      \`;

      document.getElementById('drawer-overlay').classList.add('open');
      document.getElementById('drawer').classList.add('open');
    }

    function closeDrawer() {
      document.getElementById('drawer-overlay').classList.remove('open');
      document.getElementById('drawer').classList.remove('open');
    }

    // Realtime SSE
    function connectLiveStream() {
      const sse = new EventSource('/api/live');
      sse.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          renderWorkspace(data);
        } catch (e) {
          console.error('SSE Error', e);
        }
      };
      sse.onerror = () => setTimeout(fetchFallback, 3000);
    }

    async function fetchFallback() {
      try {
        const res = await fetch('/api/data');
        if (res.ok) {
          const data = await res.json();
          renderWorkspace(data);
        }
      } catch (e) {}
    }

    // Boot
    initTheme();
    connectLiveStream();
    fetchFallback();
  </script>
</body>
</html>`;
}
