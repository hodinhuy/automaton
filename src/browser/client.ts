/**
 * Browser Engine Client (TypeScript Bridge)
 * Communicates with the self-hosted browser service (Docker container or local Python process).
 */

import { spawn, type ChildProcess } from "child_process";
import path from "path";
import { createLogger } from "../observability/logger.js";
import type {
  BrowserActionRequest,
  BrowserActionResponse,
  BrowserClientConfig,
} from "./types.js";

const logger = createLogger("browser.client");

export class BrowserClient {
  private baseUrl: string;
  private timeoutMs: number;
  private autoSpawn: boolean;
  private spawnedProcess: ChildProcess | null = null;

  constructor(config: BrowserClientConfig = {}) {
    this.baseUrl =
      config.baseUrl ||
      process.env.BROWSER_SERVICE_URL ||
      `http://${process.env.BROWSER_HOST || "127.0.0.1"}:${process.env.BROWSER_PORT || "8765"}`;
    this.timeoutMs = config.timeoutMs || 45_000;
    this.autoSpawn = config.autoSpawn ?? true;
  }

  /**
   * Health check to see if the browser service is responding.
   */
  async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${this.baseUrl}/health`, {
        signal: controller.signal,
      });
      clearTimeout(id);
      if (!res.ok) return false;
      const data = (await res.json()) as any;
      return data?.status === "ok";
    } catch {
      return false;
    }
  }

  /**
   * Auto-spawn local Python service using uv or python if Docker is not hosting it.
   */
  private async ensureServiceRunning(): Promise<boolean> {
    if (await this.isAvailable()) {
      return true;
    }

    if (!this.autoSpawn) {
      return false;
    }

    logger.info("[BROWSER] Browser service not detected. Attempting to start local instance via uv...");

    try {
      const serverScript = path.resolve(process.cwd(), "src", "browser", "server.py");

      // Spawn in background
      this.spawnedProcess = spawn("uv", ["run", "python", serverScript], {
        detached: true,
        stdio: "ignore",
        env: {
          ...process.env,
          BROWSER_HEADLESS: process.env.BROWSER_HEADLESS || "true",
        },
      });

      this.spawnedProcess.unref();

      // Poll for readiness up to 10 seconds
      const startTime = Date.now();
      while (Date.now() - startTime < 10_000) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        if (await this.isAvailable()) {
          logger.info("[BROWSER] Local browser service started successfully.");
          return true;
        }
      }
    } catch (err: any) {
      logger.warn(`[BROWSER] Failed to auto-spawn local browser service: ${err.message}`);
    }

    return false;
  }

  /**
   * Execute a browser action (navigate, screenshot, extract text, or AI agent task).
   */
  async execute(request: BrowserActionRequest): Promise<BrowserActionResponse> {
    const isUp = await this.ensureServiceRunning();
    if (!isUp) {
      return {
        success: false,
        error: `Browser service is offline at ${this.baseUrl}. Please start it using 'docker compose -f src/browser/docker-compose.yml up -d' or 'pnpm run browser:start'.`,
      };
    }

    try {
      const controller = new AbortController();
      const timeoutSec = request.timeoutSeconds || Math.round(this.timeoutMs / 1000);
      const id = setTimeout(() => controller.abort(), (timeoutSec + 5) * 1000);

      const res = await fetch(`${this.baseUrl}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      clearTimeout(id);

      if (!res.ok) {
        const errorText = await res.text();
        return {
          success: false,
          error: `Browser service error HTTP ${res.status}: ${errorText}`,
        };
      }

      const result = (await res.json()) as BrowserActionResponse;
      return result;
    } catch (err: any) {
      return {
        success: false,
        error: `Failed to execute browser action: ${err.message}`,
      };
    }
  }
}
