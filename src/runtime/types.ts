/**
 * Automaton Runtime Driver Interface
 *
 * Decouples agent execution, file operations, and sub-agent sandboxing
 * from any proprietary cloud provider (Conway Cloud).
 * Supports both Docker Container isolation and safe Local Host execution.
 */

import type { ExecResult, PortInfo, SandboxInfo, CreateSandboxOptions } from "../types.js";

export type RuntimeDriverType = "docker" | "local";

export interface SandboxInstance {
  id: string;
  name: string;
  type: RuntimeDriverType;
  containerId?: string;
  workspacePath: string;
  status: "starting" | "running" | "stopped" | "failed";
  createdAt: string;
}

export interface AgentRuntimeDriver {
  readonly type: RuntimeDriverType;

  /**
   * Check if the runtime engine is ready (e.g. Docker daemon reachable)
   */
  isAvailable(): Promise<boolean>;

  /**
   * Execute a command inside the designated sandbox / container
   */
  exec(
    command: string,
    options?: {
      timeoutMs?: number;
      sandboxId?: string;
      cwd?: string;
      env?: Record<string, string>;
    },
  ): Promise<ExecResult>;

  /**
   * Write a file inside the sandbox workspace
   */
  writeFile(
    filePath: string,
    content: string,
    sandboxId?: string,
  ): Promise<void>;

  /**
   * Read a file from the sandbox workspace
   */
  readFile(
    filePath: string,
    sandboxId?: string,
  ): Promise<string>;

  /**
   * Create / spin up a sandboxed environment for a sub-agent worker
   */
  createSandbox(
    options: CreateSandboxOptions & { name?: string; workspacePath?: string },
  ): Promise<SandboxInfo>;

  /**
   * Teardown and cleanup a sandbox container / worker
   */
  deleteSandbox(sandboxId: string): Promise<void>;

  /**
   * List all currently active sandboxes
   */
  listSandboxes(): Promise<SandboxInfo[]>;

  /**
   * Expose a local port from the application
   */
  exposePort(port: number, slug?: string): Promise<PortInfo>;

  /**
   * Remove an exposed port
   */
  removePort(port: number): Promise<void>;
}
