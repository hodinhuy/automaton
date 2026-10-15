/**
 * Automaton Web Dashboard Server
 *
 * Lightweight, zero-external-dependency dashboard server using node:http.
 * Serves real-time metrics, Colony Tree, Reasoning logs, Goals & Tasks
 * on port 8386 (default).
 */

import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";
import { resolvePath, loadConfig } from "../config.js";
import { getDashboardHtml } from "./frontend.js";

const DEFAULT_PORT = 8386;

export interface DashboardServerOptions {
  port?: number;
  dbPath?: string;
  configPath?: string;
}

export function startDashboardServer(options: DashboardServerOptions = {}): {
  server: http.Server;
  port: number;
  close: () => Promise<void>;
} {
  const port = options.port || Number(process.env.DASHBOARD_PORT) || DEFAULT_PORT;
  const cfg = loadConfig();
  const dbFile = options.dbPath
    ? resolvePath(options.dbPath)
    : resolvePath(cfg?.dbPath || "~/.automaton/state.db");

  function getDbConnection() {
    if (!fs.existsSync(dbFile)) {
      return null;
    }
    try {
      const db = new Database(dbFile, { readonly: true, fileMustExist: true });
      db.pragma("journal_mode = WAL");
      return db;
    } catch {
      return null;
    }
  }

  function fetchDashboardData() {
    const db = getDbConnection();
    const config = loadConfig();

    if (!db) {
      return {
        status: "waiting_for_db",
        message: "Database not initialized yet.",
        agent: {
          name: config?.name || "Solo",
          address: config?.walletAddress || "",
          state: "offline",
          model: config?.inferenceModel || "cx/gpt-6-luna",
          credits: 100,
        },
        stats: { totalTurns: 0, totalTokens: 0, activeWorkers: 0, completedTasks: 0 },
        children: [],
        goals: [],
        tasks: [],
        turns: [],
      };
    }

    try {
      // 1. Identity & State
      const identityRows = db.prepare("SELECT key, value FROM identity").all() as { key: string; value: string }[];
      const identityMap = Object.fromEntries(identityRows.map((r) => [r.key, r.value]));

      const latestTurn = db
        .prepare("SELECT * FROM turns ORDER BY timestamp DESC LIMIT 1")
        .get() as any;

      // 2. Credits (virtual balance in KV or config)
      const creditRow = db.prepare("SELECT value FROM kv WHERE key = 'credits'").get() as { value: string } | undefined;
      const credits = creditRow ? parseFloat(creditRow.value) : 100.0;

      // 3. Children / Sub-agents
      let children: any[] = [];
      try {
        children = db
          .prepare(
            `SELECT id, name, address, sandbox_id, genesis_prompt, funded_amount_cents, status, created_at, last_checked,
                    COALESCE(role, 'generalist') as role
             FROM children ORDER BY created_at DESC LIMIT 30`
          )
          .all();
      } catch {
        // Fallback if role column not yet present
        try {
          children = db.prepare("SELECT * FROM children ORDER BY created_at DESC LIMIT 30").all();
        } catch {
          children = [];
        }
      }

      // 4. Goals & Tasks
      let goals: any[] = [];
      let tasks: any[] = [];
      try {
        goals = db.prepare("SELECT * FROM goals ORDER BY created_at DESC LIMIT 15").all();
      } catch {}
      try {
        tasks = db.prepare("SELECT * FROM task_graph ORDER BY created_at DESC LIMIT 40").all();
      } catch {}

      // 5. Recent Turns with tool calls
      const turns = (db
        .prepare(
          `SELECT id, timestamp, state, input, thinking, tool_calls, token_usage, cost_cents, created_at
           FROM turns ORDER BY timestamp DESC LIMIT 25`
        )
        .all() as any[]).map((t) => {
        let parsedTools = [];
        let parsedTokens = { prompt: 0, completion: 0, total: 0 };
        try {
          parsedTools = JSON.parse(t.tool_calls || "[]");
        } catch {}
        try {
          parsedTokens = JSON.parse(t.token_usage || "{}");
        } catch {}
        return {
          ...t,
          tool_calls: parsedTools,
          token_usage: parsedTokens,
        };
      });

      // 6. Aggregate Stats
      const turnCountRow = db.prepare("SELECT count(*) as count FROM turns").get() as { count: number };
      const toolCountRow = db.prepare("SELECT count(*) as count FROM tool_calls").get() as { count: number };

      let totalTokens = 0;
      for (const t of turns) {
        if (t.token_usage?.total) {
          totalTokens += t.token_usage.total;
        }
      }

      const activeWorkers = children.filter((c) => c.status === "running" || c.status === "spawning").length;
      const completedTasks = tasks.filter((tk) => tk.status === "completed").length;

      return {
        status: "ok",
        agent: {
          name: identityMap.name || config?.name || "Solo",
          address: identityMap.address || config?.walletAddress || "",
          creator: identityMap.creator || config?.creatorAddress || "",
          state: latestTurn ? latestTurn.state : "sleeping",
          model: config?.inferenceModel || "cx/gpt-6-luna",
          credits: credits,
          gateway: config?.openaiBaseUrl || "https://9router.hugorix.com/v1",
        },
        stats: {
          totalTurns: turnCountRow?.count || 0,
          totalToolsExecuted: toolCountRow?.count || 0,
          totalTokens,
          activeWorkers,
          completedTasks,
          totalGoals: goals.length,
        },
        children,
        goals,
        tasks,
        turns,
      };
    } finally {
      db.close();
    }
  }

  // SSE client connections
  const sseClients = new Set<http.ServerResponse>();

  // Polling loop for live broadcast
  let lastTurnId: string | null = null;
  const pollInterval = setInterval(() => {
    if (sseClients.size === 0) return;
    try {
      const data = fetchDashboardData();
      const currentLatestTurnId = data.turns?.[0]?.id || null;
      // Broadcast update
      const payload = `data: ${JSON.stringify(data)}\n\n`;
      for (const client of sseClients) {
        client.write(payload);
      }
      lastTurnId = currentLatestTurnId;
    } catch {
      // Ignore poll errors
    }
  }, 2000);

  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    // CORS Headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // ── API Endpoints ──
    if (url.pathname === "/api/data" || url.pathname === "/api/stats") {
      try {
        const data = fetchDashboardData();
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify(data));
      } catch (err: any) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // ── Server-Sent Events (Live Stream) ──
    if (url.pathname === "/api/live") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write(`data: ${JSON.stringify(fetchDashboardData())}\n\n`);
      sseClients.add(res);

      req.on("close", () => {
        sseClients.delete(res);
      });
      return;
    }

    // ── Main UI SPA ──
    if (url.pathname === "/" || url.pathname === "/index.html") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(getDashboardHtml(port));
      return;
    }

    // 404
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  });

  server.listen(port, () => {
    console.log(`\n🚀 [DASHBOARD] Automaton Web Dashboard active at http://localhost:${port}`);
  });

  return {
    server,
    port,
    close: () =>
      new Promise<void>((resolve) => {
        clearInterval(pollInterval);
        for (const client of sseClients) {
          client.end();
        }
        sseClients.clear();
        server.close(() => resolve());
      }),
  };
}

// Direct execution support
if (import.meta.url === `file://${process.argv[1]}`) {
  const customPort = Number(process.argv[2]) || DEFAULT_PORT;
  startDashboardServer({ port: customPort });
}
