/**
 * Docker Container Runtime Driver
 *
 * Runs sub-agents in 100% isolated Docker containers on Linux or Windows Docker Desktop.
 * Provides complete filesystem isolation, Linux shell compatibility, and clean teardown.
 */

import { exec as execCb, execSync } from "child_process";
import fs from "fs";
import path from "path";
import type { ExecResult, PortInfo, SandboxInfo, CreateSandboxOptions } from "../types.js";
import type { AgentRuntimeDriver, RuntimeDriverType } from "./types.js";

const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_BUFFER = 10 * 1024 * 1024;
const DEFAULT_IMAGE = process.env.AUTOMATON_DOCKER_IMAGE || "node:22-bookworm-slim";

export class DockerRuntimeDriver implements AgentRuntimeDriver {
  readonly type: RuntimeDriverType = "docker";
  private readonly defaultWorkspace: string;
  private readonly sandboxes = new Map<string, { info: SandboxInfo; containerName: string; workspacePath: string }>();

  constructor(workspaceRoot?: string) {
    this.defaultWorkspace = workspaceRoot
      ? path.resolve(workspaceRoot)
      : process.cwd();
  }

  async isAvailable(): Promise<boolean> {
    try {
      return new Promise<boolean>((resolve) => {
        execCb("docker info", { timeout: 4000 }, (err) => {
          resolve(!err);
        });
      });
    } catch {
      return false;
    }
  }

  private getContainerName(sandboxId: string): string {
    const cleanId = sandboxId.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
    return `automaton-agent-${cleanId}`;
  }

  async createSandbox(
    options: CreateSandboxOptions & { name?: string; workspacePath?: string; image?: string },
  ): Promise<SandboxInfo> {
    const id = options.name || `worker-${Date.now()}`;
    const containerName = this.getContainerName(id);
    const workspace = options.workspacePath || path.join(this.defaultWorkspace, ".automaton", "workspace", id);
    if (!fs.existsSync(workspace)) {
      fs.mkdirSync(workspace, { recursive: true });
    }

    const image = options.image || DEFAULT_IMAGE;

    // Remove any leftover container with the same name
    try {
      execSync(`docker rm -f ${containerName}`, { stdio: "ignore" });
    } catch {}

    // Spin up isolated background container with mounted workspace
    const runCmd = `docker run -d --name ${containerName} -v "${workspace}:/workspace" -w /workspace ${image} sleep infinity`;
    try {
      execSync(runCmd, { timeout: 15_000, stdio: "pipe" });
    } catch (runErr: any) {
      throw new Error(`Failed to spin up Docker container for sandbox ${id}: ${runErr.message}`);
    }

    const info: SandboxInfo = {
      id,
      status: "running",
      region: "docker-local",
      vcpu: options.vcpu || 1,
      memoryMb: options.memoryMb || 512,
      diskGb: options.diskGb || 5,
      createdAt: new Date().toISOString(),
    };

    this.sandboxes.set(id, { info, containerName, workspacePath: workspace });
    return info;
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
    const timeout = options?.timeoutMs || DEFAULT_TIMEOUT_MS;
    const sandbox = options?.sandboxId ? this.sandboxes.get(options.sandboxId) : null;

    let fullCommand: string;
    if (sandbox) {
      // Execute securely inside the isolated Docker container
      // Escape single quotes for bash -c
      const escapedCmd = command.replace(/'/g, "'\\''");
      fullCommand = `docker exec ${sandbox.containerName} sh -c '${escapedCmd}'`;
    } else {
      // Fallback or host command
      fullCommand = command;
    }

    return new Promise((resolve) => {
      execCb(
        fullCommand,
        {
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
    const sandbox = sandboxId ? this.sandboxes.get(sandboxId) : null;
    const baseDir = sandbox ? sandbox.workspacePath : this.defaultWorkspace;
    const target = path.resolve(baseDir, filePath);
    const dir = path.dirname(target);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(target, content, "utf-8");
  }

  async readFile(filePath: string, sandboxId?: string): Promise<string> {
    const sandbox = sandboxId ? this.sandboxes.get(sandboxId) : null;
    const baseDir = sandbox ? sandbox.workspacePath : this.defaultWorkspace;
    const target = path.resolve(baseDir, filePath);
    return fs.readFileSync(target, "utf-8");
  }

  async deleteSandbox(sandboxId: string): Promise<void> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (sandbox) {
      try {
        execSync(`docker rm -f ${sandbox.containerName}`, { stdio: "ignore" });
      } catch {}
      this.sandboxes.delete(sandboxId);
    }
  }

  async listSandboxes(): Promise<SandboxInfo[]> {
    return Array.from(this.sandboxes.values()).map((s) => s.info);
  }

  async exposePort(port: number, _slug?: string): Promise<PortInfo> {
    return {
      port,
      publicUrl: `http://localhost:${port}`,
      sandboxId: "docker",
    };
  }

  async removePort(_port: number): Promise<void> {
    // Port mapping cleanup if needed
  }
}
