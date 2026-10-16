/**
 * Conway API Client
 *
 * Communicates with Conway's control plane for sandbox management,
 * credits, and infrastructure operations.
 * Adapted from @aiws/sdk patterns.
 */

import { execSync } from "child_process";
import fs from "fs";
import nodePath from "path";
import type {
  ConwayClient,
  ExecResult,
  PortInfo,
  CreateSandboxOptions,
  SandboxInfo,
  PricingTier,
  CreditTransferResult,
  DomainSearchResult,
  DomainRegistration,
  DnsRecord,
  ModelInfo,
} from "../types.js";
import { ResilientHttpClient } from "./http-client.js";
import { LocalProcessDriver } from "../runtime/local-driver.js";
import type { AgentRuntimeDriver } from "../runtime/types.js";
import { ulid } from "ulid";
import { keccak256, toHex } from "viem";
import type { Address, PrivateKeyAccount } from "viem";
import { randomUUID } from "crypto";
import type { ChainType, ChainIdentity } from "../identity/chain.js";

interface ConwayClientOptions {
  apiUrl: string;
  apiKey: string;
  sandboxId: string;
  runtimeDriver?: AgentRuntimeDriver;
}

export function createConwayClient(options: ConwayClientOptions): ConwayClient {
  const { apiUrl, apiKey } = options;
  // Normalize sandbox ID defensively so values like whitespace/"undefined"/"null"
  // never produce malformed API paths such as /v1/sandboxes//exec.
  const sandboxId = normalizeSandboxId(options.sandboxId);
  const httpClient = new ResilientHttpClient();

  async function request(
    method: string,
    path: string,
    body?: unknown,
    requestOptions?: { idempotencyKey?: string; retries404?: number },
  ): Promise<any> {
    // Conway LB has an intermittent routing bug that returns 404 for valid
    // sandbox endpoints. Retry 404s here (outside ResilientHttpClient) to
    // avoid tripping the circuit breaker on transient routing failures.
    const max404Retries = requestOptions?.retries404 ?? 3;
    for (let attempt = 0; attempt <= max404Retries; attempt++) {
      const resp = await httpClient.request(`${apiUrl}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: apiKey,
        },
        body: body ? JSON.stringify(body) : undefined,
        idempotencyKey: requestOptions?.idempotencyKey,
      });

      if (resp.status === 404 && attempt < max404Retries) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }

      if (!resp.ok) {
        const text = await resp.text();
        const err: any = new Error(
          `Conway API error: ${method} ${path} -> ${resp.status}: ${text}`,
        );
        err.status = resp.status;
        err.responseText = text;
        err.method = method;
        err.path = path;
        throw err;
      }

      return resp.headers.get("content-type")?.includes("application/json")
        ? resp.json()
        : resp.text();
    }

    throw new Error("Unreachable");
  }

  const canonicalizePayload = (payload: Record<string, string>): string => {
    const sortedKeys = Object.keys(payload).sort();
    const sorted: Record<string, string> = {};
    for (const key of sortedKeys) {
      sorted[key] = payload[key];
    }
    return JSON.stringify(sorted);
  };

  const hashIdentityPayload = (payload: Record<string, string>): `0x${string}` => {
    const canonical = canonicalizePayload(payload);
    return keccak256(toHex(canonical));
  };


  // ─── Runtime Driver (Local Process or Docker Container) ───
  const driver = options.runtimeDriver || new LocalProcessDriver();

  const exec = async (
    command: string,
    timeout?: number,
  ): Promise<ExecResult> => {
    return driver.exec(command, { timeoutMs: timeout, sandboxId });
  };

  const writeFile = async (
    filePath: string,
    content: string,
  ): Promise<void> => {
    return driver.writeFile(filePath, content, sandboxId);
  };

  const readFile = async (filePath: string): Promise<string> => {
    return driver.readFile(filePath, sandboxId);
  };

  const exposePort = async (port: number): Promise<PortInfo> => {
    return driver.exposePort(port);
  };

  const removePort = async (port: number): Promise<void> => {
    return driver.removePort(port);
  };

  // ─── Sandbox Management (Sub-agents) ─────────────────────────

  const createSandbox = async (
    sandboxOpts: CreateSandboxOptions,
  ): Promise<SandboxInfo> => {
    return driver.createSandbox(sandboxOpts);
  };

  const deleteSandbox = async (targetId: string): Promise<void> => {
    return driver.deleteSandbox(targetId);
  };

  const listSandboxes = async (): Promise<SandboxInfo[]> => {
    return driver.listSandboxes();
  };

  // ─── Credits (Self-hosted / Mock) ───────────────────────────

  const getCreditsBalance = async (): Promise<number> => {
    // 10000 cents = $100.00 mock balance. No HTTP calls to api.conway.tech.
    return 10000;
  };

  const getCreditsPricing = async (): Promise<PricingTier[]> => {
    return [];
  };

  const transferCredits = async (
    toAddress: string,
    amountCents: number,
    _note?: string,
  ): Promise<CreditTransferResult> => {
    return {
      transferId: ulid(),
      status: "completed",
      toAddress,
      amountCents,
      balanceAfterCents: 10000,
    };
  };

  const registerAutomaton = async (params: {
    automatonId: string;
    automatonAddress: string;
    creatorAddress: string;
    name: string;
    bio?: string;
    genesisPromptHash?: `0x${string}`;
    account: PrivateKeyAccount;
    nonce?: string;
    chainType?: ChainType;
    chainIdentity?: ChainIdentity;
  }): Promise<{ automaton: Record<string, unknown> }> => {
    return {
      automaton: {
        id: params.automatonId,
        automaton_address: params.automatonAddress,
        creator_address: params.creatorAddress,
        name: params.name,
        status: "registered",
      },
    };
  };

  // ─── Domains (Self-hosted / Mock) ────────────────────────────

  const searchDomains = async (
    _query: string,
    _tlds?: string,
  ): Promise<DomainSearchResult[]> => {
    return [];
  };

  const registerDomain = async (
    domain: string,
    _years: number = 1,
  ): Promise<DomainRegistration> => {
    return {
      domain,
      status: "registered",
      expiresAt: new Date(Date.now() + 31536000000).toISOString(),
      transactionId: ulid(),
    };
  };

  const listDnsRecords = async (_domain: string): Promise<DnsRecord[]> => {
    return [];
  };

  const addDnsRecord = async (
    _domain: string,
    type: string,
    host: string,
    value: string,
    ttl?: number,
  ): Promise<DnsRecord> => {
    return {
      id: ulid(),
      type,
      host,
      value,
      ttl: ttl || 3600,
    };
  };

  const deleteDnsRecord = async (
    _domain: string,
    _recordId: string,
  ): Promise<void> => {
    return;
  };

  // ─── Model Discovery (Self-hosted / Mock) ─────────────────────

  const listModels = async (): Promise<ModelInfo[]> => {
    return [
      {
        id: "cx/gpt-6-luna",
        provider: "openai",
        pricing: {
          inputPerMillion: 0,
          outputPerMillion: 0,
        },
      },
    ];
  };

  const createScopedClient = (targetSandboxId: string): ConwayClient => {
    return createConwayClient({ apiUrl, apiKey, sandboxId: targetSandboxId, runtimeDriver: driver });
  };

  const client: ConwayClient = {
    isLocal: driver.type === "local",
    exec,
    writeFile,
    readFile,
    exposePort,
    removePort,
    createSandbox,
    deleteSandbox,
    listSandboxes,
    getCreditsBalance,
    getCreditsPricing,
    transferCredits,
    registerAutomaton,
    searchDomains,
    registerDomain,
    listDnsRecords,
    addDnsRecord,
    deleteDnsRecord,
    listModels,
    createScopedClient,
  };

  // SECURITY: API credentials are NOT exposed on the client object.
  // If child spawning or other modules need API configuration, pass it
  // explicitly through a dedicated typed interface — never via dynamic getters
  // that any code with a client reference could access.

  return client;
}

function normalizeSandboxId(value: string | null | undefined): string {
  const trimmed = (value || "").trim();
  if (!trimmed) return "";
  if (trimmed === "undefined" || trimmed === "null") return "";
  return trimmed;
}
