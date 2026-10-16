# Self-Hosted Browser Engine Architecture

This document describes the design, deployment, and integration of the **Self-Hosted Browser Engine** for the Conway Automaton.

---

## 1. Overview & Dual-Mode Strategy

The Automaton utilizes a dedicated, self-hosted browser automation service powered by **Playwright** and **browser-use**. 

To maximize flexibility across environments, the service supports two execution modes:

```
                            ┌─────────────────────────────────┐
                            │     Automaton Agent (TS)        │
                            │      Tool: browser_action       │
                            └────────────────┬────────────────┘
                                             │ HTTP JSON (Port 8765)
                                             ▼
                            ┌─────────────────────────────────┐
                            │    Browser Bridge (FastAPI)     │
                            └────────┬───────────────┬────────┘
                                     │               │
               [Linux VPS / Cloud]   │               │ [Local / Windows Dev]
                                     ▼               ▼
                       ┌──────────────────────┐ ┌──────────────────────┐
                       │   Docker Container   │ │  Local Process (uv)  │
                       │  (Chromium + Xvfb)   │ │ (Headed or Headless) │
                       └──────────┬───────────┘ └──────────┬───────────┘
                                  │                        │
                                  └──────────┬─────────────┘
                                             ▼
                             ┌────────────────────────────────┐
                             │ ~/.automaton/browser_profile/  │
                             │ (Persistent Cookies & Session) │
                             └────────────────────────────────┘
```

1. **Docker Mode (Production / Linux VPS):**
   - Headless container packaged with Chromium and virtual display (`Xvfb`).
   - Zero host dependency issues on server Linux distros (Ubuntu, Debian, Alpine).
   - Start with: `pnpm run browser:docker` or `docker compose -f src/browser/docker-compose.yml up -d`.

2. **Local `uv` Mode (Development / Windows / macOS):**
   - Runs directly on host via Astral's `uv` package manager (`uv run python src/browser/server.py`).
   - Supports headed browsing (watch the browser interact in real-time) or headless.
   - Start with: `pnpm run browser:start` or `scripts/start-browser.ps1`.

3. **Persistent Session Directory (`~/.automaton/browser_profile/`):**
   - Both modes share the same persistent browser context.
   - Logged-in accounts (Facebook, Threads, Twitter, Discord Web, etc.) stay logged in across restarts.

---

## 2. API Specifications

The Python bridge service runs by default on `http://127.0.0.1:8765`.

### `GET /health`
Verifies server health and active configuration.
```json
{
  "status": "ok",
  "service": "automaton-browser",
  "profile_dir": "/root/.automaton/browser_profile",
  "screenshots_dir": "/root/.automaton/screenshots",
  "headless_default": true
}
```

### `POST /action`
Executes a browser operation.

**Request Schema:**
```json
{
  "action": "navigate" | "screenshot" | "extract" | "click" | "type" | "ai_task",
  "url": "https://example.com",
  "task": "Optional natural language goal or AI task description",
  "selector": "CSS selector for click/type",
  "text": "Text to fill for type action",
  "headless": true,
  "timeoutSeconds": 30
}
```

**Response Schema:**
```json
{
  "success": true,
  "url": "https://example.com/dashboard",
  "title": "Page Title",
  "content": "Rendered body text or AI task summary",
  "screenshotPath": "/root/.automaton/screenshots/screenshot_1729068000.png",
  "screenshotBase64": "...",
  "error": null
}
```

---

## 3. Agent Tool Integration

The agent accesses this engine via the `browser_action` tool registered in `src/agent/tools.ts`:

- **Name:** `browser_action`
- **Category:** `browser`
- **When used:**
  - Navigating dynamic single-page applications (React, Angular, Vue).
  - Capturing page screenshots requested by the creator.
  - Interacting with elements (clicking buttons, filling forms).
  - Executing autonomous web workflows via `ai_task`.

---

## 4. Quick Start Commands

### On Windows:
```powershell
# 1. Start browser service locally via uv
pnpm run browser:start

# Or use the convenience PowerShell script
./scripts/start-browser.ps1
```

### On Linux VPS:
```bash
# 1. Start browser service inside Docker
pnpm run browser:docker

# Or run the bash script
./scripts/start-browser.sh
```
