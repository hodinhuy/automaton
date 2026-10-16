/**
 * Automaton Runtime Driver Factory
 *
 * Automatically resolves the optimal runtime driver (Docker vs Local).
 * Provides seamless fallback to LocalProcessDriver if Docker is offline.
 */

import { DockerRuntimeDriver } from "./docker-driver.js";
import { LocalProcessDriver } from "./local-driver.js";
import type { AgentRuntimeDriver, RuntimeDriverType } from "./types.js";
import { createLogger } from "../observability/logger.js";

const logger = createLogger("runtime");

export interface RuntimeOptions {
  preferredType?: RuntimeDriverType;
  workspaceRoot?: string;
  dockerImage?: string;
}

export async function createRuntimeDriver(options: RuntimeOptions = {}): Promise<AgentRuntimeDriver> {
  const preferred = options.preferredType || (process.env.AUTOMATON_RUNTIME as RuntimeDriverType) || "docker";

  if (preferred === "docker") {
    const dockerDriver = new DockerRuntimeDriver(options.workspaceRoot);
    const isDockerUp = await dockerDriver.isAvailable();

    if (isDockerUp) {
      logger.info("[RUNTIME] Docker engine detected. Sub-agents will run in isolated Docker containers.");
      return dockerDriver;
    }

    logger.warn(
      "[RUNTIME] Docker engine is not reachable or still starting. Gracefully falling back to LocalProcessDriver (in-process sandbox).",
    );
  }

  logger.info("[RUNTIME] Using LocalProcessDriver (host-confined execution).");
  return new LocalProcessDriver(options.workspaceRoot);
}

export * from "./types.js";
export * from "./docker-driver.js";
export * from "./local-driver.js";
