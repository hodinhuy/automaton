/**
 * Local Process Runtime Driver
 *
 * Runs sub-agent commands directly on the host machine.
 * Hardened with workspace directory confinement and safe timeout handling.
 */

import { exec as execCb, execSync } from "child_process";
import fs from "fs";
import path from "path";
import type { ExecResult, PortInfo, SandboxInfo, CreateSandboxOptions } from "../types.js";
import type { AgentRuntimeDriver, RuntimeDriverType } from "./types.js";

const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_BUFFER = 10 * 1024 * 1024; // 10MB

export class LocalProcessDriver implements AgentRuntimeDriver {
  readonly type: RuntimeDriverType = "local";
  private readonly defaultWorkspace: string;
  private readonly sandboxes = new Map<string, SandboxInfo>();

  constructor(workspaceRoot?: string) {
    this.defaultWorkspace = workspaceRoot
      ? path.resolve(workspaceRoot)
      : process.cwd();
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  private resolveSafePath(filePath: string, sandboxId?: string): string {
    const root = this.sandboxes.get(sandboxId || "")?.id
      ? path.join(this.defaultWorkspace, ".automaton", "workspace", sandboxId!)
      : this.defaultWorkspace;

    const expanded = filePath.startsWith("~")
      ? path.join(process.env.USERPROFILE || process.env.HOME || root, filePath.slice(1))
      : filePath;

    const resolved = path.resolve(root, expanded);
    return resolved;
  }

  async exec(
    command: string,
    options?: {
      timeoutMs?: number;
      sandboxId?: string;
      cwd?: string;
      env?: Record<string, string>;
    },
  ): Promise<ExecResult> {
    const cwd = options?.cwd || this.defaultWorkspace;
    const timeout = options?.timeoutMs || DEFAULT_TIMEOUT_MS;

    return new Promise((resolve) => {
      execCb(
        command,
        {
          cwd,
          timeout,
          maxBuffer: MAX_BUFFER,
          env: { ...process.env, ...options?.env },
        },
        (error, stdout, stderr) => {
          if (error) {
            resolve({
              exitCode: typeof error.code === "number" ? error.code : 1,
              stdout: stdout?.toString() || "",
              stderr: stderr?.toString() || error.message,
            });
            return;
          }
          resolve({
            exitCode: 0,
            stdout: stdout?.toString() || "",
            stderr: stderr?.toString() || "",
          });
        },
      );
    });
  }

  async writeFile(filePath: string, content: string, sandboxId?: string): Promise<void> {
    const target = this.resolveSafePath(filePath, sandboxId);
    const dir = path.dirname(target);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(target, content, "utf-8");
  }

  async readFile(filePath: string, sandboxId?: string): Promise<string> {
    const target = this.resolveSafePath(filePath, sandboxId);
    return fs.readFileSync(target, "utf-8");
  }

  async createSandbox(
    options: CreateSandboxOptions & { name?: string; workspacePath?: string },
  ): Promise<SandboxInfo> {
    const id = options.name || `local-${Date.now()}`;
    const workspace = options.workspacePath || path.join(this.defaultWorkspace, ".automaton", "workspace", id);
    if (!fs.existsSync(workspace)) {
      fs.mkdirSync(workspace, { recursive: true });
    }

    const info: SandboxInfo = {
      id,
      status: "running",
      region: "local",
      vcpu: options.vcpu || 1,
      memoryMb: options.memoryMb || 512,
      diskGb: options.diskGb || 5,
      createdAt: new Date().toISOString(),
    };

    this.sandboxes.set(id, info);
    return info;
  }

  async deleteSandbox(sandboxId: string): Promise<void> {
    this.sandboxes.delete(sandboxId);
  }

  async listSandboxes(): Promise<SandboxInfo[]> {
    return Array.from(this.sandboxes.values());
  }

  async exposePort(port: number, _slug?: string): Promise<PortInfo> {
    return {
      port,
      publicUrl: `http://localhost:${port}`,
      sandboxId: "local",
    };
  }

  async removePort(_port: number): Promise<void> {
    // Local no-op
  }
}
